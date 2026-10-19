#!/usr/bin/env python3
"""Exercise the real Python publisher against the C++ bridge process."""

from __future__ import annotations

import json
import os
import queue
import stat
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from typing import Any

REPOSITORY = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPOSITORY / "simulation_runner" / "src"))

from ipc_adapter import publisher as publisher_module  # noqa: E402
from object_extraction import (  # noqa: E402
    EgoActionSnapshot,
    EgoKinematicsSnapshot,
    EgoSnapshot,
    SceneSnapshot,
    SingleObjectSnapshot,
    SurroundingSnapshot,
)


class BridgeProcess:
    def __init__(self, executable: str, socket_path: str) -> None:
        self.lines: queue.Queue[str] = queue.Queue()
        self.process = subprocess.Popen(
            [executable, "--socket", socket_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        self.reader = threading.Thread(target=self._read_output, daemon=True)
        self.reader.start()

    def _read_output(self) -> None:
        assert self.process.stdout is not None
        for line in self.process.stdout:
            self.lines.put(line.rstrip("\n"))

    def wait_until_listening(self, socket_path: str) -> None:
        deadline = time.monotonic() + 4.0
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                raise AssertionError(f"bridge exited early: {self._recent_output()}")
            try:
                mode = stat.S_IMODE(os.stat(socket_path).st_mode)
            except FileNotFoundError:
                time.sleep(0.01)
                continue
            if mode != 0o600:
                raise AssertionError(f"bridge socket mode is {mode:o}, expected 600")
            return
        raise AssertionError("bridge did not create its socket")

    def wait_for_scene(self, timeout: float = 5.0) -> dict[str, Any]:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                line = self.lines.get(timeout=min(0.1, deadline - time.monotonic()))
            except queue.Empty:
                if self.process.poll() is not None:
                    raise AssertionError(f"bridge exited before receiving a scene: {self._recent_output()}")
                continue
            if "runner scene received seq=" not in line or " json=" not in line:
                continue
            return json.loads(line.split(" json=", 1)[1])
        raise AssertionError(f"timed out waiting for a scene: {self._recent_output()}")

    def stop(self) -> None:
        if self.process.poll() is None:
            self.process.terminate()
        try:
            return_code = self.process.wait(timeout=4.0)
        except subprocess.TimeoutExpired:
            self.process.kill()
            return_code = self.process.wait(timeout=2.0)
            raise AssertionError(f"bridge did not shut down cleanly: {self._recent_output()}")
        if return_code != 0:
            raise AssertionError(f"bridge exited with {return_code}: {self._recent_output()}")

    def _recent_output(self) -> str:
        lines: list[str] = []
        while True:
            try:
                lines.append(self.lines.get_nowait())
            except queue.Empty:
                return "\n".join(lines[-8:])


def make_scene(state: dict[str, Any]) -> SceneSnapshot:
    timestamp = time.monotonic()
    ego = EgoSnapshot(
        valid=True,
        timestamp_monotonic_s=timestamp,
        kinematics=EgoKinematicsSnapshot(
            velocity_mps=(state["speed_mps"], 0.0), heading_rad=0.0
        ),
        action=EgoActionSnapshot(steering_deg=state["steering_deg"]),
        source="ipc-e2e-test",
        seed=31,
        episode_step=state["episode_step"],
        sim_time_s=state["episode_step"] * 0.02,
    )
    objects = tuple(
        SingleObjectSnapshot(
            object_id=item["id"],
            object_type="VEHICLE",
            world_position_m=(item["x"], item["y"]),
            world_velocity_mps=None,
            heading_rad=0.0,
            length_m=4.5,
            width_m=1.8,
            height_m=1.5,
            relative_position_m=(item["x"], item["y"]),
            relative_velocity_mps=None,
            relative_heading_rad=0.0,
            distance_m=(item["x"] ** 2 + item["y"] ** 2) ** 0.5,
            bearing_rad=0.0,
        )
        for item in state["objects"]
    )
    surrounding = SurroundingSnapshot(
        valid=True,
        timestamp_monotonic_s=timestamp,
        radius_m=100.0,
        objects=objects,
        source="ipc-e2e-test",
        seed=31,
        episode_step=state["episode_step"],
        sim_time_s=state["episode_step"] * 0.02,
    )
    return SceneSnapshot(ego=ego, surrounding=surrounding)


def run(executable: str) -> None:
    state_lock = threading.Lock()
    state: dict[str, Any] = {
        "episode_step": 4,
        "steering_deg": 12.5,
        "speed_mps": 8.0,
        "objects": [{"id": "vehicle-a", "x": 28.0, "y": -2.0}],
    }

    def latest_scene() -> SceneSnapshot:
        with state_lock:
            current = dict(state)
            current["objects"] = list(state["objects"])
        return make_scene(current)

    def update_scene(**updates: Any) -> None:
        with state_lock:
            state.update(updates)

    with tempfile.TemporaryDirectory(prefix="afs-ipc-e2e-") as directory:
        socket_path = str(Path(directory) / "runner.sock")
        publisher = publisher_module.RunnerPublisher(socket_path)
        original_reader = publisher_module.get_scene_snapshot
        bridge: BridgeProcess | None = None
        replacement: BridgeProcess | None = None
        publisher_module.get_scene_snapshot = latest_scene
        try:
            publisher.start()
            deadline = time.monotonic() + 2.0
            while publisher.last_error is None and time.monotonic() < deadline:
                time.sleep(0.01)
            if publisher.last_error is None:
                raise AssertionError("publisher did not attempt connection before bridge startup")

            bridge = BridgeProcess(executable, socket_path)
            bridge.wait_until_listening(socket_path)
            first = bridge.wait_for_scene()
            if first["sequence"] < 1 or first["sample"]["episode_step"] != 4:
                raise AssertionError(f"unexpected first scene sample: {first}")
            if first["ego"]["steering_deg"] != 12.5 or first["ego"]["longitudinal_speed_mps"] != 8.0:
                raise AssertionError(f"ego fields did not cross IPC correctly: {first['ego']}")
            if len(first["objects"]) != 1 or first["objects"][0]["id"] != "vehicle-a":
                raise AssertionError(f"surrounding objects did not cross IPC correctly: {first['objects']}")
            session = first["runner_session"]
            first_sequence = first["sequence"]

            bridge.stop()
            bridge = None
            update_scene(episode_step=5, steering_deg=-4.0, speed_mps=2.5, objects=[])

            replacement = BridgeProcess(executable, socket_path)
            replacement.wait_until_listening(socket_path)
            second = replacement.wait_for_scene()
            if second["runner_session"] != session or second["sequence"] <= first_sequence:
                raise AssertionError("publisher did not preserve session and increasing sequence after reconnect")
            if second["sample"]["episode_step"] != 5 or second["objects"] != []:
                raise AssertionError(f"replacement scene did not clear the old object: {second}")
            if second["ego"]["steering_deg"] != -4.0 or second["ego"]["longitudinal_speed_mps"] != 2.5:
                raise AssertionError(f"updated ego fields did not cross IPC after reconnect: {second['ego']}")
        finally:
            publisher.stop()
            publisher_module.get_scene_snapshot = original_reader
            if replacement is not None:
                replacement.stop()
            if bridge is not None:
                bridge.stop()


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {Path(sys.argv[0]).name} PATH_TO_AFS_RUNNER_BRIDGE", file=sys.stderr)
        return 2
    try:
        run(sys.argv[1])
    except Exception as error:
        print(f"runner IPC Python end-to-end test failed: {error}", file=sys.stderr)
        return 1
    print("runner IPC Python-to-C++ end-to-end checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
