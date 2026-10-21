"""Latest-scene publisher for the local C++ bridge."""

from __future__ import annotations

import json
import math
import os
import socket
import threading
import time
import uuid
from typing import Any

from metadrive_runner.snapshot_store import get_scene_snapshot

PROTOCOL_VERSION = 1
MAX_PACKET_BYTES = 64 * 1024
MAX_OBJECTS = 128
PUBLISH_PERIOD_S = 0.05
MAX_SOURCE_AGE_S = 0.250


def default_socket_path() -> str:
    """Return the configured socket path or the shared per-user bridge path."""
    explicit = os.environ.get("AFS_BRIDGE_SOCKET")
    if explicit:
        return explicit
    runtime_dir = os.environ.get("XDG_RUNTIME_DIR")
    if runtime_dir:
        return os.path.join(runtime_dir, "afs", "runner-bridge.sock")
    return os.path.join("/tmp", f"afs-{os.getuid()}", "runner-bridge.sock")


class RunnerPublisher:
    """Reconnectable, bounded-rate IPC client that always publishes the newest scene."""

    def __init__(self, path: str | None = None) -> None:
        self.path = path if path is not None else default_socket_path()
        if not os.path.isabs(self.path) or len(os.fsencode(self.path)) >= 108:
            raise ValueError("bridge socket path must be absolute and shorter than 108 bytes")
        self.session = str(uuid.uuid4())
        self._sequence = 0
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.last_error: str | None = None

    def start(self) -> None:
        if self._thread is not None:
            raise RuntimeError("publisher already started")
        self._thread = threading.Thread(target=self._run, name="runner-ipc", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None

    def _run(self) -> None:
        delay = 0.1
        while not self._stop.is_set():
            client: socket.socket | None = None
            try:
                client = socket.socket(socket.AF_UNIX, socket.SOCK_SEQPACKET)
                client.settimeout(0.5)
                client.connect(self.path)
                hello = {"protocol_version": PROTOCOL_VERSION, "type": "hello",
                         "role": "runner", "runner_session": self.session}
                client.sendall(_encode(hello))
                reply = json.loads(client.recv(MAX_PACKET_BYTES + 1))
                if reply.get("type") != "hello_ack" or reply.get("runner_session") != self.session:
                    raise ConnectionError("bridge rejected runner handshake")
                client.settimeout(0.05)
                self.last_error = None
                delay = 0.1
                self._publish_connected(client)
            except (OSError, ValueError, json.JSONDecodeError, ConnectionError) as exc:
                self.last_error = str(exc)
            finally:
                if client is not None:
                    client.close()
            self._stop.wait(delay)
            delay = min(delay * 2, 2.0)

    def _publish_connected(self, client: socket.socket) -> None:
        last_sent_ns = 0
        while not self._stop.wait(PUBLISH_PERIOD_S):
            scene = get_scene_snapshot()
            if scene is None:
                continue
            captured_ns = int(scene.timestamp_monotonic_s * 1_000_000_000)
            now_ns = time.monotonic_ns()
            if captured_ns == last_sent_ns or now_ns - captured_ns > int(MAX_SOURCE_AGE_S * 1e9):
                continue
            self._sequence += 1
            packet = scene_message(scene, self.session, self._sequence, captured_ns)
            client.sendall(_encode(packet))
            last_sent_ns = captured_ns


def scene_message(scene: Any, session: str, sequence: int, captured_ns: int) -> dict[str, Any]:
    ego = scene.ego
    surrounding = scene.surrounding
    velocity = ego.kinematics.velocity_mps
    heading = ego.kinematics.heading_rad
    longitudinal_speed = None
    if velocity is not None and heading is not None:
        longitudinal_speed = velocity[0] * math.cos(heading) + velocity[1] * math.sin(heading)
    selected = sorted(surrounding.objects, key=lambda item: (item.distance_m, item.object_id))
    truncated = len(selected) > MAX_OBJECTS
    selected = selected[:MAX_OBJECTS]
    return {
        "protocol_version": PROTOCOL_VERSION,
        "type": "scene",
        "runner_session": session,
        "sequence": sequence,
        "captured_monotonic_ns": captured_ns,
        "sample": {"source": ego.source, "seed": ego.seed,
                   "episode_step": ego.episode_step, "sim_time_s": ego.sim_time_s},
        "quality": {"ego_valid": ego.valid, "objects_valid": surrounding.valid,
                    "objects_degraded": surrounding.degraded or truncated,
                    "objects_truncated": truncated},
        "ego": {"steering_deg": ego.action.steering_deg,
                "max_steering_deg": ego.action.max_steering_deg,
                "longitudinal_speed_mps": longitudinal_speed},
        "objects": [{"id": item.object_id[:64], "type": item.object_type[:32],
                     "x_forward_m": item.relative_position_m[0],
                     "y_left_m": item.relative_position_m[1],
                     "length_m": item.length_m, "width_m": item.width_m,
                     "relative_heading_rad": item.relative_heading_rad}
                    for item in selected],
    }


def _encode(message: dict[str, Any]) -> bytes:
    encoded = json.dumps(message, separators=(",", ":"), allow_nan=False).encode("utf-8")
    if len(encoded) > MAX_PACKET_BYTES:
        raise ValueError("IPC packet exceeds 64 KiB")
    return encoded
