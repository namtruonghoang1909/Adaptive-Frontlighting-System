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

EXECUTED_MODES = {
    0: ("off", "Off"),
    1: ("safe_default", "Safe default"),
    2: ("low_beam_no_swivel", MODE_LABELS["low_beam_no_swivel"]),
    3: ("low_beam_swivel", MODE_LABELS["low_beam_swivel"]),
    4: ("high_beam_no_dimming", MODE_LABELS["high_beam_no_dimming"]),
    5: ("high_beam_dimming", MODE_LABELS["high_beam_dimming"]),
}
HEALTH_STATES = {0: ("ok", "OK"), 1: ("degraded", "Degraded"),
                 2: ("faulted", "Faulted"), 3: ("safe_fallback", "Safe fallback")}
ECU_FAULT_FLAGS = (
    ("steering_stale", "Steering input stale"),
    ("speed_stale", "Speed input stale"),
    ("object_stale", "Object data stale"),
    ("dashboard_stale", "Dashboard command stale"),
    ("servo_control_lost", "Servo control lost"),
    ("servo_mismatch", "Servo feedback mismatch"),
    ("beam_control_lost", "Beam control lost"),
    ("can_decode_fault", "CAN decode fault"),
)


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
        self._request_valid = False
        self._request_power = True
        self._request_mode = "high_beam_dimming"
        self._can_enabled = False
        self._ecu: dict[str, object] = {}
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
            request_valid = self._request_valid
            power = self._request_power
            mode = self._request_mode
            can_enabled = self._can_enabled
            ecu_status = deepcopy(self._ecu)
            result = dict(self._last_result)
            action = dict(self._last_action)
        snapshot["bridge"] = {
            "connected": connected,
            "label": "Bridge connected" if connected else "Bridge offline",
            "detail": ("SocketCAN enabled; waiting for ECU 0x500 status."
                       if can_enabled and not ecu_status.get("available") else
                       "SocketCAN status is available." if can_enabled else
                       "SocketCAN disabled; ECU values are simulated.") if connected
                      else "Waiting for Dashboard IPC socket.",
            "can_enabled": can_enabled,
        }
        if connected and request_present:
            snapshot["request"]["power_on"] = power
            snapshot["request"]["mode"] = mode
            snapshot["request"]["mode_label"] = MODE_LABELS[mode]
        snapshot["request"]["valid"] = request_valid
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
        if ecu_status.get("available") is True:
            self._apply_live_ecu(snapshot["ecu"], ecu_status)
        else:
            snapshot["ecu"]["source"] = (
                "Simulated ECU status; waiting for CAN 0x500" if can_enabled
                else "Simulated ECU status; CAN receive disabled")
        return snapshot

    @staticmethod
    def _apply_live_ecu(target: dict[str, object], status: dict[str, object]) -> None:
        executed = status["executed_mode"]
        health = status["health_state"]
        mode_key, mode_label = EXECUTED_MODES[executed]
        health_key, health_label = HEALTH_STATES[health]
        mask = status["applied_dim_sector_mask"]
        target.update({
            "source": ("Live ECU status · Fresh" if status["fresh"]
                       else "Live ECU status · Stale"),
            "status_available": True,
            "status_fresh": status["fresh"],
            "status_age_ms": status["age_ms"],
            "alive_counter": status["alive_counter"],
            "executed_mode": mode_key,
            "executed_mode_label": mode_label,
            "health": health_key,
            "health_label": health_label,
            "required_inputs_valid": status["required_inputs_valid"],
            "safe_fallback": status["safe_fallback"],
            "fault_present": status["fault_present"],
            "left_servo_feedback_deg": status["left_servo_feedback_deg"],
            "right_servo_feedback_deg": status["right_servo_feedback_deg"],
            "applied_dim_sector_mask": mask,
            "applied_dim_sectors": [sector for sector in range(10) if mask & (1 << sector)],
        })
        faults = [
            {"name": label, "detail": "Reported by ECU in AFS_Status (0x500)."}
            for key, label in ECU_FAULT_FLAGS if status[key]
        ]
        if status["fault_present"] and not faults:
            faults.append({"name": "ECU fault", "detail": "ECU reports a fault without a specific flag."})
        target["faults"] = faults

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
            message = ("Clear-fault pulse queued for CAN; ECU result is unconfirmed."
                       if accepted else f"Bridge rejected clear-fault request: {reason}.")
            with self._lock:
                if self._last_action["id"] == request["request_id"]:
                    self._last_action = {
                        "id": request["request_id"], "kind": "clear_fault",
                        "accepted": accepted, "message": message,
                    }

    def _apply_status(self, reply: dict[str, object]) -> None:
        if reply.get("type") != "status":
            raise ValueError("Unexpected bridge status response")
        runner = reply.get("runner")
        requested = reply.get("request")
        ecu = reply.get("ecu")
        can = reply.get("can")
        if (not isinstance(runner, dict) or not isinstance(requested, dict) or
                not isinstance(ecu, dict) or not isinstance(can, dict)):
            raise ValueError("Malformed bridge status")
        can_enabled = can.get("enabled")
        available = ecu.get("available")
        if not isinstance(can_enabled, bool) or not isinstance(available, bool):
            raise ValueError("Malformed CAN/ECU availability")
        if available:
            if not isinstance(ecu.get("fresh"), bool):
                raise ValueError("Malformed ECU freshness")
            if ecu.get("age_ms") is not None and (
                    isinstance(ecu["age_ms"], bool) or
                    not isinstance(ecu["age_ms"], (int, float)) or
                    not math.isfinite(ecu["age_ms"])):
                raise ValueError("Malformed ECU age")
            bool_fields = (
                "required_inputs_valid", "fault_present", "safe_fallback",
                "steering_stale", "speed_stale", "object_stale", "dashboard_stale",
                "servo_control_lost", "servo_mismatch", "beam_control_lost", "can_decode_fault",
            )
            if any(not isinstance(ecu.get(key), bool) for key in bool_fields):
                raise ValueError("Malformed ECU status flags")
            for key, maximum in (("alive_counter", 15), ("executed_mode", 5),
                                 ("health_state", 3), ("applied_dim_sector_mask", 1023)):
                value = ecu.get(key)
                if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= maximum:
                    raise ValueError("Malformed ECU status enum or mask")
            for key in ("left_servo_feedback_deg", "right_servo_feedback_deg"):
                value = ecu.get(key)
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                    raise ValueError("Malformed ECU servo feedback")
        present = requested.get("present") is True
        valid = requested.get("valid")
        if not isinstance(requested.get("present"), bool) or not isinstance(valid, bool):
            raise ValueError("Malformed bridge command validity")
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
            self._request_valid = valid
            self._request_power = power
            self._request_mode = mode
            self._can_enabled = can_enabled
            self._ecu = ecu
            self._connected = True

    def _mark_disconnected(self) -> None:
        with self._lock:
            self._connected = False
            self._runner = {}
            self._request_valid = False
            self._ecu = {}
            self._can_enabled = False
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
