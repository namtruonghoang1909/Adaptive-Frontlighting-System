"""Reconnectable Dashboard client for the bridge's local Unix socket."""

from __future__ import annotations

from copy import deepcopy
import json
import math
import os
from pathlib import Path
from queue import Empty, Queue
import socket
from threading import Event, Lock, Thread
from uuid import uuid4

from afs_dashboard.models.state import DemoDashboardState, MODE_LABELS


MAX_PACKET_BYTES = 4096


def default_socket_path() -> str:
    configured = os.environ.get("AFS_DASHBOARD_SOCKET")
    if configured:
        return configured
    runtime = os.environ.get("XDG_RUNTIME_DIR")
    directory = Path(runtime) / "afs" if runtime else Path(f"/tmp/afs-{os.getuid()}")
    return str(directory / "dashboard-bridge.sock")


class GatewayDashboardState:
    """Presents bridge requests and runner fields with explicit demo fallbacks."""

    def __init__(self, socket_path: str | None = None) -> None:
        self.socket_path = socket_path or default_socket_path()
        self._demo = DemoDashboardState()
        self._demo.set_command(False, "low_beam_no_swivel")
        self._lock = Lock()
        self._stop = Event()
        self._outgoing: Queue[dict[str, object]] = Queue()
        self._connected = False
        self._runner: dict[str, object] = {}
        self._request_present = False
        self._request_power = True
        self._request_mode = "high_beam_dimming"
        self._last_result = {
            "id": "bridge-preset", "kind": "demo_preset", "accepted": False,
            "message": "No request has been accepted by the bridge.",
        }
        self._last_action = {
            "id": "bridge-0000", "kind": "clear_fault", "accepted": False,
            "message": "No clear-fault request sent yet.",
        }
        self._worker = Thread(target=self._run, name="afs-dashboard-ipc", daemon=True)
        self._worker.start()

    def close(self) -> None:
        self._stop.set()
        self._worker.join(timeout=1.5)

    def set_command(self, power_on: object, mode: object) -> dict[str, object]:
        if not isinstance(power_on, bool):
            raise ValueError("power_on must be a boolean")
        if not isinstance(mode, str) or mode not in MODE_LABELS:
            raise ValueError("unsupported headlight mode")
        request_id = uuid4().hex
        with self._lock:
            if not self._connected:
                self._last_result = {
                    "id": request_id, "kind": "headlight_request", "accepted": False,
                    "message": "Bridge offline; request was not sent.",
                }
            else:
                self._last_result = {
                    "id": request_id, "kind": "headlight_request", "accepted": False,
                    "message": "Waiting for bridge acceptance.",
                }
                self._outgoing.put({
                    "protocol_version": 1, "type": "command", "request_id": request_id,
                    "power_on": power_on, "mode": mode,
                })
            return dict(self._last_result)

    def clear_fault(self) -> dict[str, object]:
        request_id = uuid4().hex
        with self._lock:
            if not self._connected:
                self._last_action = {
                    "id": request_id, "kind": "clear_fault", "accepted": False,
                    "message": "Bridge offline; clear-fault request was not sent.",
                }
            else:
                self._last_action = {
                    "id": request_id, "kind": "clear_fault", "accepted": False,
                    "message": "Waiting for bridge response.",
                }
                self._outgoing.put({
                    "protocol_version": 1, "type": "clear_fault", "request_id": request_id,
                })
            return dict(self._last_action)

    def snapshot(self) -> dict[str, object]:
        snapshot = self._demo.snapshot()
        with self._lock:
            connected = self._connected
            runner = deepcopy(self._runner)
            request_present = self._request_present
            power = self._request_power
            mode = self._request_mode
            result = dict(self._last_result)
            action = dict(self._last_action)
        snapshot["bridge"] = {
            "connected": connected,
            "label": "Bridge connected" if connected else "Bridge offline",
            "detail": "Gateway IPC active; ECU CAN status unavailable." if connected
                      else "Waiting for Dashboard IPC socket.",
        }
        if connected and request_present:
            snapshot["request"]["power_on"] = power
            snapshot["request"]["mode"] = mode
            snapshot["request"]["mode_label"] = MODE_LABELS[mode]
        snapshot["request"]["result"] = result
        snapshot["request"]["last_action"] = action
        fresh = connected and runner.get("fresh") is True
        speed = runner.get("speed_kmh")
        steering = runner.get("steering_deg")
        heading = runner.get("heading_deg")
        position_x = runner.get("position_x_m")
        position_y = runner.get("position_y_m")
        speed_live = fresh and isinstance(speed, (int, float)) and not isinstance(speed, bool)
        steering_live = fresh and isinstance(steering, (int, float)) and not isinstance(steering, bool)
        heading_live = fresh and isinstance(heading, (int, float)) and not isinstance(heading, bool)
        position_live = (fresh and isinstance(position_x, (int, float))
                         and isinstance(position_y, (int, float))
                         and not isinstance(position_x, bool) and not isinstance(position_y, bool))
        if speed_live:
            snapshot["ego"]["speed_kmh"] = float(speed)
        if steering_live:
            snapshot["ego"]["steering_deg"] = float(steering)
        if heading_live:
            snapshot["ego"]["heading_deg"] = float(heading)
        if position_live:
            snapshot["ego"]["position_x_m"] = float(position_x)
            snapshot["ego"]["position_y_m"] = float(position_y)
        snapshot["ego"]["speed_live"] = speed_live
        snapshot["ego"]["steering_live"] = steering_live
        snapshot["ego"]["heading_live"] = heading_live
        snapshot["ego"]["position_live"] = position_live
        objects_live = fresh and runner.get("objects_valid") is True
        if objects_live:
            objects = runner["objects"]
            snapshot["ego"]["surrounding_objects"] = [
                {"label": f"CAR {index:02d}", **item}
                for index, item in enumerate(objects, start=1)
            ]
        snapshot["ego"]["objects_live"] = objects_live
        snapshot["ego"]["surround_source"] = (
            "Live runner vehicles · nearest 24 shown" if objects_live and runner.get("objects_limited")
            else "Live runner vehicles" if objects_live else "Simulated object positions"
        )
        snapshot["ego"]["source"] = (
            "Fresh bridge runner fields where available; proximity grid simulated"
            if speed_live or steering_live or heading_live or position_live
            else "Simulated ego fallback"
        )
        snapshot["ecu"]["source"] = "Simulated ECU status; CAN receive unavailable"
        return snapshot

    @staticmethod
    def _exchange(connection: socket.socket, payload: dict[str, object]) -> dict[str, object]:
        encoded = json.dumps(payload, separators=(",", ":"), allow_nan=False).encode("utf-8")
        if len(encoded) > MAX_PACKET_BYTES:
            raise ValueError("Dashboard IPC packet too large")
        if connection.send(encoded) != len(encoded):
            raise OSError("Incomplete Dashboard IPC packet")
        response = connection.recv(MAX_PACKET_BYTES + 1)
        if not response or len(response) > MAX_PACKET_BYTES:
            raise OSError("Bridge closed or oversized the Dashboard IPC response")
        message = json.loads(response)
        if not isinstance(message, dict) or message.get("protocol_version") != 1:
            raise ValueError("Invalid Dashboard IPC response")
        return message

    def _apply_result(self, request: dict[str, object], reply: dict[str, object]) -> None:
        if reply.get("type") != "command_result" or reply.get("request_id") != request["request_id"]:
            raise ValueError("Mismatched bridge command result")
        accepted = reply.get("accepted") is True
        reason = reply.get("reason")
        kind = request["type"]
        if kind == "command":
            message = "Bridge stored the request; ECU execution is unconfirmed." if accepted else f"Bridge rejected request: {reason}."
            with self._lock:
                if self._last_result["id"] == request["request_id"]:
                    self._last_result = {
                        "id": request["request_id"], "kind": "headlight_request",
                        "accepted": accepted, "message": message,
                    }
            if accepted:
                self._demo.set_command(request["power_on"], request["mode"])
        else:
            message = "Clear-fault request accepted by bridge." if accepted else "ECU unavailable; clear-fault request was rejected."
            with self._lock:
                if self._last_action["id"] == request["request_id"]:
                    self._last_action = {
                        "id": request["request_id"], "kind": "clear_fault",
                        "accepted": accepted, "message": message,
                    }
            if accepted:
                self._demo.clear_fault()

    def _apply_status(self, reply: dict[str, object]) -> None:
        if reply.get("type") != "status":
            raise ValueError("Unexpected bridge status response")
        runner = reply.get("runner")
        requested = reply.get("request")
        ecu = reply.get("ecu")
        if not isinstance(runner, dict) or not isinstance(requested, dict) or not isinstance(ecu, dict):
            raise ValueError("Malformed bridge status")
        if ecu.get("available") is not False:
            raise ValueError("Unsupported ECU status source")
        present = requested.get("present") is True
        power = requested.get("power_on")
        mode = requested.get("mode")
        if not isinstance(power, bool) or not isinstance(mode, str) or mode not in MODE_LABELS:
            raise ValueError("Malformed bridge request status")
        request_id = requested.get("request_id")
        if present and (not isinstance(request_id, str) or not request_id):
            raise ValueError("Malformed bridge request ID")
        if not isinstance(runner.get("fresh"), bool) or not isinstance(runner.get("connected"), bool):
            raise ValueError("Malformed bridge runner freshness")
        for key in ("speed_kmh", "steering_deg", "heading_deg", "position_x_m", "position_y_m"):
            value = runner.get(key)
            if value is not None and (isinstance(value, bool) or
                                      not isinstance(value, (int, float)) or not math.isfinite(value)):
                raise ValueError("Malformed bridge ego field")
        objects = runner.get("objects")
        if not isinstance(runner.get("objects_valid"), bool) or not isinstance(runner.get("objects_limited"), bool):
            raise ValueError("Malformed bridge object quality")
        if not isinstance(objects, list) or len(objects) > 24:
            raise ValueError("Malformed bridge object list")
        for item in objects:
            if not isinstance(item, dict):
                raise ValueError("Malformed bridge object")
            for key in ("x_forward_m", "y_left_m"):
                value = item.get(key)
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                    raise ValueError("Malformed bridge object position")
        if present:
            demo_request = self._demo.snapshot()["request"]
            if demo_request["power_on"] != power or demo_request["mode"] != mode:
                self._demo.set_command(power, mode)
        with self._lock:
            if present and self._last_result["id"] == request_id and not self._last_result["accepted"]:
                self._last_result = {
                    **self._last_result, "accepted": True,
                    "message": "Bridge confirms the stored request; ECU execution is unconfirmed.",
                }
            self._runner = runner
            self._request_present = present
            self._request_power = power
            self._request_mode = mode
            self._connected = True

    def _mark_disconnected(self) -> None:
        with self._lock:
            self._connected = False
            self._runner = {}
            if self._last_result["message"] == "Waiting for bridge acceptance.":
                self._last_result = {
                    **self._last_result, "accepted": False,
                    "message": "Bridge disconnected before accepting the request.",
                }
            if self._last_action["message"] == "Waiting for bridge response.":
                self._last_action = {
                    **self._last_action, "accepted": False,
                    "message": "Bridge disconnected before replying to clear fault.",
                }
        while True:
            try:
                self._outgoing.get_nowait()
            except Empty:
                break

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                with socket.socket(socket.AF_UNIX, socket.SOCK_SEQPACKET) as connection:
                    connection.settimeout(0.7)
                    connection.connect(self.socket_path)
                    hello = self._exchange(connection, {
                        "protocol_version": 1, "type": "hello", "role": "dashboard",
                    })
                    if hello.get("type") != "hello_ack" or hello.get("role") != "dashboard":
                        raise ValueError("Bridge rejected Dashboard hello")
                    self._apply_status(self._exchange(connection, {
                        "protocol_version": 1, "type": "get_status",
                    }))
                    while not self._stop.is_set():
                        try:
                            request = self._outgoing.get_nowait()
                        except Empty:
                            request = None
                        if request is not None:
                            self._apply_result(request, self._exchange(connection, request))
                        self._apply_status(self._exchange(connection, {
                            "protocol_version": 1, "type": "get_status",
                        }))
                        self._stop.wait(0.25)
            except (OSError, ValueError, json.JSONDecodeError):
                self._mark_disconnected()
                self._stop.wait(0.5)
