#!/usr/bin/env python3
"""Exercise bridge CAN transmit, receive, and Dashboard forwarding on vcan."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import socket
import struct
import subprocess
import tempfile
import time


CAN_RAW = getattr(socket, "CAN_RAW", 1)
SOL_CAN_RAW = getattr(socket, "SOL_CAN_RAW", 101)
CAN_RAW_FILTER = 1
CAN_SFF_MASK = 0x7FF
CAN_EFF_FLAG = 0x80000000
CAN_RTR_FLAG = 0x40000000
CAN_ERR_FLAG = 0x20000000


def can_socket(interface: str, identifiers: tuple[int, ...] = ()) -> socket.socket:
    if not hasattr(socket, "AF_CAN"):
        raise RuntimeError("Python on this host has no AF_CAN support")
    connection = socket.socket(socket.PF_CAN, socket.SOCK_RAW, CAN_RAW)
    connection.bind((interface,))
    if identifiers:
        filters = b"".join(struct.pack("=II", can_id, CAN_SFF_MASK | CAN_EFF_FLAG |
                                         CAN_RTR_FLAG | CAN_ERR_FLAG)
                           for can_id in identifiers)
        connection.setsockopt(SOL_CAN_RAW, CAN_RAW_FILTER, filters)
    return connection


def send_can(connection: socket.socket, can_id: int, payload: bytes) -> None:
    if len(payload) > 8:
        raise ValueError("Classical CAN payload cannot exceed eight bytes")
    frame = struct.pack("=IB3x8s", can_id, len(payload), payload.ljust(8, b"\0"))
    if connection.send(frame) != len(frame):
        raise RuntimeError("short write to CAN socket")


def receive_can(connection: socket.socket, deadline: float, wanted_id: int) -> bytes:
    while time.monotonic() < deadline:
        connection.settimeout(max(0.01, deadline - time.monotonic()))
        try:
            raw = connection.recv(16)
        except TimeoutError:
            break
        if len(raw) != 16:
            continue
        can_id, length, payload = struct.unpack("=IB3x8s", raw)
        if can_id & (CAN_EFF_FLAG | CAN_RTR_FLAG | CAN_ERR_FLAG):
            continue
        if can_id & CAN_SFF_MASK == wanted_id:
            return payload[:length]
    raise TimeoutError(f"timed out waiting for CAN ID 0x{wanted_id:03X}")


def exchange(connection: socket.socket, packet: dict[str, object]) -> dict[str, object]:
    connection.sendall(json.dumps(packet, separators=(",", ":")).encode())
    response = json.loads(connection.recv(4096))
    if not isinstance(response, dict) or response.get("protocol_version") != 1:
        raise RuntimeError("bridge returned malformed Dashboard IPC response")
    return response


def dashboard_command(connection: socket.socket, packet_type: str,
                      request_id: str, **fields: object) -> dict[str, object]:
    response = exchange(connection, {
        "protocol_version": 1, "type": packet_type,
        "request_id": request_id, **fields,
    })
    if response.get("type") != "command_result" or response.get("accepted") is not True:
        raise AssertionError(f"Dashboard request was not accepted: {response}")
    return response


def make_status(counter: int = 1) -> bytes:
    data = bytearray((counter & 0x0F | 0x10, 0x15, 0, 0xFD, 1, 0x18, 0, 0))
    for value in data[:7]:
        data[7] ^= value
    return bytes(data)


def assert_dashboard_status(connection: socket.socket) -> dict[str, object]:
    deadline = time.monotonic() + 2.0
    last: dict[str, object] = {}
    while time.monotonic() < deadline:
        last = exchange(connection, {"protocol_version": 1, "type": "get_status"})
        ecu = last.get("ecu")
        if isinstance(ecu, dict) and ecu.get("available") is True:
            return last
        time.sleep(0.03)
    raise AssertionError(f"decoded ECU status was not forwarded: {last}")


def run(binary: str, interface: str) -> None:
    with tempfile.TemporaryDirectory(prefix="afs-vcan-") as temporary:
        directory = Path(temporary)
        directory.chmod(0o700)
        runner_path = str(directory / "runner.sock")
        dashboard_path = str(directory / "dashboard.sock")
        monitor = can_socket(interface, (0x100, 0x200, 0x300, 0x400, 0x500))
        injector = can_socket(interface)
        process = subprocess.Popen(
            [binary, "--socket", runner_path, "--dashboard-socket", dashboard_path,
             "--can-interface", interface],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        dashboard: socket.socket | None = None
        try:
            deadline = time.monotonic() + 3.0
            while time.monotonic() < deadline and not os.path.exists(dashboard_path):
                if process.poll() is not None:
                    raise RuntimeError("bridge exited while starting; check CAN interface readiness")
                time.sleep(0.02)
            if not os.path.exists(dashboard_path):
                raise TimeoutError("bridge Dashboard socket did not appear")

            dashboard = socket.socket(socket.AF_UNIX, socket.SOCK_SEQPACKET)
            dashboard.settimeout(1.0)
            dashboard.connect(dashboard_path)
            hello = exchange(dashboard, {
                "protocol_version": 1, "type": "hello", "role": "dashboard",
            })
            if hello.get("type") != "hello_ack":
                raise AssertionError(f"Dashboard handshake failed: {hello}")
            exchange(dashboard, {"protocol_version": 1, "type": "get_status"})

            for can_id in (0x100, 0x200, 0x300):
                payload = receive_can(monitor, time.monotonic() + 2.0, can_id)
                if len(payload) != 8:
                    raise AssertionError(f"CAN ID 0x{can_id:03X} has unexpected DLC {len(payload)}")
            speed = receive_can(monitor, time.monotonic() + 2.0, 0x100)
            steering = receive_can(monitor, time.monotonic() + 2.0, 0x200)
            grid = receive_can(monitor, time.monotonic() + 2.0, 0x300)
            if speed[0] & 0x10 or steering[0] & 0x10 or grid[1] & 0x01:
                raise AssertionError("missing runner data was not encoded fail-closed")

            dashboard_command(dashboard, "command", "vcan-command-1",
                              power_on=True, mode="high_beam_dimming")
            deadline = time.monotonic() + 2.0
            valid_frame = None
            while time.monotonic() < deadline:
                payload = receive_can(monitor, deadline, 0x400)
                if payload[0] & 0x10:
                    valid_frame = payload
                    break
            if valid_frame is None:
                raise AssertionError("no valid 0x400 command was transmitted")
            if (len(valid_frame) != 3 or valid_frame[1] != 0x07 or
                    valid_frame[2] != (valid_frame[0] ^ valid_frame[1])):
                raise AssertionError(f"incorrect 0x400 command frame: {valid_frame.hex()}")

            dashboard_command(dashboard, "clear_fault", "vcan-clear-fault")
            pulse = receive_can(monitor, time.monotonic() + 2.0, 0x400)
            while not (pulse[0] & 0x20):
                pulse = receive_can(monitor, time.monotonic() + 2.0, 0x400)
            if pulse[2] != (pulse[0] ^ pulse[1]):
                raise AssertionError("clear-fault frame has invalid XOR checksum")
            next_frame = receive_can(monitor, time.monotonic() + 2.0, 0x400)
            if next_frame[0] & 0x20:
                raise AssertionError("clear-fault request lasted longer than one 50 ms frame")

            malformed_status = bytearray(make_status())
            malformed_status[7] ^= 0x01
            send_can(injector, 0x500, bytes(malformed_status))
            time.sleep(0.1)
            before_valid = exchange(dashboard, {
                "protocol_version": 1, "type": "get_status",
            })
            before_ecu = before_valid.get("ecu")
            if not isinstance(before_ecu, dict) or before_ecu.get("available") is not False:
                raise AssertionError(f"invalid 0x500 frame refreshed status: {before_valid}")

            send_can(injector, 0x500, make_status())
            status = assert_dashboard_status(dashboard)
            ecu = status["ecu"]
            assert isinstance(ecu, dict)
            if (ecu.get("executed_mode") != 5 or ecu.get("left_servo_feedback_deg") != -1.5 or
                    ecu.get("right_servo_feedback_deg") != 0.5 or
                    ecu.get("applied_dim_sector_mask") != 0x18 or ecu.get("fresh") is not True):
                raise AssertionError(f"forwarded 0x500 fields do not match: {ecu}")

            dashboard.close()
            dashboard = None
            deadline = time.monotonic() + 2.0
            invalid_frame = None
            while time.monotonic() < deadline:
                payload = receive_can(monitor, deadline, 0x400)
                if not (payload[0] & 0x10):
                    invalid_frame = payload
                    break
            if invalid_frame is None:
                raise AssertionError("CommandValid stayed set after Dashboard disconnect")
        finally:
            if dashboard is not None:
                dashboard.close()
            process.terminate()
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=2)
            monitor.close()
            injector.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bridge_binary")
    parser.add_argument("--interface", default="vcan0")
    arguments = parser.parse_args()
    try:
        run(arguments.bridge_binary, arguments.interface)
    except (OSError, RuntimeError, TimeoutError, AssertionError) as error:
        parser.error(str(error))
    print(f"SocketCAN end-to-end checks passed on {arguments.interface}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
