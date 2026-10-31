#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"
readonly REQUESTED_BUILD_DIR="${AFS_BRIDGE_BUILD_DIR:-$REPO_ROOT/build/bridge}"
readonly METADRIVE_PYTHON="${METADRIVE_PYTHON:-$REPO_ROOT/simulation/metadrive/metadrive_venv/bin/python}"

if [[ "$REQUESTED_BUILD_DIR" == /* ]]; then
    readonly BUILD_DIR="$REQUESTED_BUILD_DIR"
else
    readonly BUILD_DIR="$REPO_ROOT/$REQUESTED_BUILD_DIR"
fi

if ! command -v cmake >/dev/null 2>&1; then
    printf '[FAIL] cmake is required to build the bridge.\n' >&2
    exit 1
fi
if [[ ! -x "$METADRIVE_PYTHON" ]]; then
    printf '[FAIL] MetaDrive Python was not found: %s\n' "$METADRIVE_PYTHON" >&2
    printf '       Set METADRIVE_PYTHON to the project simulation interpreter.\n' >&2
    exit 1
fi

cmake -S "$REPO_ROOT/bridge" -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE=Release
cmake --build "$BUILD_DIR" --target afs_runner_bridge --parallel

readonly TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/afs-runner-ipc.XXXXXX")"
readonly SOCKET_PATH="$TEST_DIR/runner.sock"
readonly BRIDGE_LOG="$TEST_DIR/bridge.log"
BRIDGE_PID=""

cleanup() {
    if [[ -n "$BRIDGE_PID" ]]; then
        kill -TERM "$BRIDGE_PID" 2>/dev/null || true
        wait "$BRIDGE_PID" 2>/dev/null || true
    fi
    rm -rf -- "$TEST_DIR"
}
trap cleanup EXIT

"$BUILD_DIR/afs_runner_bridge" --socket "$SOCKET_PATH" >"$BRIDGE_LOG" 2>&1 &
BRIDGE_PID=$!

for ((attempt = 0; attempt < 400; ++attempt)); do
    if [[ -S "$SOCKET_PATH" ]]; then
        break
    fi
    if ! kill -0 "$BRIDGE_PID" 2>/dev/null; then
        cat "$BRIDGE_LOG" >&2
        printf '[FAIL] C++ bridge exited before opening its socket.\n' >&2
        exit 1
    fi
    sleep 0.01
done
if [[ ! -S "$SOCKET_PATH" ]]; then
    cat "$BRIDGE_LOG" >&2
    printf '[FAIL] C++ bridge did not open its socket.\n' >&2
    exit 1
fi

export METADRIVE_PYTHON
if ! bash "$REPO_ROOT/simulation_runner/scripts/start_metadrive_simulation.sh" \
    --headless --realtime --max-steps 10 --bridge-socket "$SOCKET_PATH"; then
    cat "$BRIDGE_LOG" >&2
    exit 1
fi

kill -TERM "$BRIDGE_PID"
if ! wait "$BRIDGE_PID"; then
    BRIDGE_PID=""
    cat "$BRIDGE_LOG" >&2
    printf '[FAIL] C++ bridge did not shut down cleanly.\n' >&2
    exit 1
fi
BRIDGE_PID=""

if ! python3 - "$BRIDGE_LOG" <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path

packets = []
for line in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
    if "runner scene received seq=" not in line or " json=" not in line:
        continue
    packets.append(json.loads(line.split(" json=", 1)[1]))

if not packets:
    raise SystemExit("no scene packets reached the C++ receiver")
session = packets[0]["runner_session"]
previous_sequence = 0
for packet in packets:
    if packet["protocol_version"] != 1 or packet["type"] != "scene":
        raise SystemExit("receiver accepted an unexpected packet type/version")
    if packet["runner_session"] != session:
        raise SystemExit("runner session changed within one simulation run")
    if packet["sequence"] <= previous_sequence:
        raise SystemExit("accepted scene sequence did not increase")
    previous_sequence = packet["sequence"]
    if packet["sample"]["source"] != "metadrive":
        raise SystemExit("scene source was not MetaDrive")
    if not isinstance(packet["objects"], list):
        raise SystemExit("surrounding objects field is not a list")
    if ("steering_deg" not in packet["ego"]
            or "max_steering_deg" not in packet["ego"]
            or "longitudinal_speed_mps" not in packet["ego"]):
        raise SystemExit("ego fields are missing")

if not any(packet["quality"]["ego_valid"] and packet["quality"]["objects_valid"] for packet in packets):
    raise SystemExit("receiver got no scene with valid ego and surrounding data")

print(f"Accepted {len(packets)} MetaDrive scenes; latest sequence {previous_sequence}.")
PY
then
    cat "$BRIDGE_LOG" >&2
    exit 1
fi
