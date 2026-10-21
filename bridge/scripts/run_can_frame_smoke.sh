#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
readonly REQUESTED_BUILD_DIR="${AFS_BRIDGE_BUILD_DIR:-$REPO_ROOT/build/bridge}"
readonly BUILD_TYPE="${AFS_BRIDGE_BUILD_TYPE:-Release}"
readonly METADRIVE_PYTHON="${METADRIVE_PYTHON:-$REPO_ROOT/simulation/metadrive/metadrive_venv/bin/python}"
readonly CANTOOLS_PYTHON="${CANTOOLS_PYTHON:-$METADRIVE_PYTHON}"
readonly STEPS="${AFS_CAN_SMOKE_STEPS:-10}"

if [[ "$REQUESTED_BUILD_DIR" == /* ]]; then
    readonly BUILD_DIR="$REQUESTED_BUILD_DIR"
else
    readonly BUILD_DIR="$REPO_ROOT/$REQUESTED_BUILD_DIR"
fi

if [[ ! -x "$METADRIVE_PYTHON" ]]; then
    printf '[FAIL] MetaDrive Python was not found: %s\n' "$METADRIVE_PYTHON" >&2
    printf '       Set METADRIVE_PYTHON to the project simulation interpreter.\n' >&2
    exit 1
fi
if [[ -n "${CANTOOLS_PYTHONPATH:-}" ]]; then
    export PYTHONPATH="$CANTOOLS_PYTHONPATH${PYTHONPATH:+:$PYTHONPATH}"
fi
if ! "$CANTOOLS_PYTHON" -c 'import cantools' >/dev/null 2>&1; then
    printf '[FAIL] cantools is not importable by %s.\n' "$CANTOOLS_PYTHON" >&2
    printf '       Set CANTOOLS_PYTHON or CANTOOLS_PYTHONPATH, then retry.\n' >&2
    exit 1
fi

cmake -S "$REPO_ROOT/bridge" -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE="$BUILD_TYPE"
cmake --build "$BUILD_DIR" --target afs_can_frame_logger --parallel

readonly SMOKE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/afs-can-frame-smoke.XXXXXX")"
readonly SOCKET_PATH="$SMOKE_DIR/runner.sock"
readonly LOGGER_LOG="$SMOKE_DIR/can-frame-log.txt"
readonly CAPTURE_PATH="$SMOKE_DIR/can-frames.jsonl"
LOGGER_PID=""

cleanup() {
    if [[ -n "$LOGGER_PID" ]]; then
        kill -TERM "$LOGGER_PID" 2>/dev/null || true
        wait "$LOGGER_PID" 2>/dev/null || true
    fi
    rm -rf -- "$SMOKE_DIR"
}
trap cleanup EXIT

timeout --signal=TERM 15s "$BUILD_DIR/afs_can_frame_logger" \
    --socket "$SOCKET_PATH" --capture "$CAPTURE_PATH" >"$LOGGER_LOG" 2>&1 &
LOGGER_PID=$!

for ((attempt = 0; attempt < 400; ++attempt)); do
    if [[ -S "$SOCKET_PATH" ]]; then
        break
    fi
    if ! kill -0 "$LOGGER_PID" 2>/dev/null; then
        cat "$LOGGER_LOG" >&2
        printf '[FAIL] CAN frame logger exited before opening its socket.\n' >&2
        exit 1
    fi
    sleep 0.01
done
if [[ ! -S "$SOCKET_PATH" ]]; then
    cat "$LOGGER_LOG" >&2
    printf '[FAIL] CAN frame logger did not open its socket.\n' >&2
    exit 1
fi

export METADRIVE_PYTHON
if ! bash "$REPO_ROOT/simulation_runner/scripts/start_metadrive_simulation.sh" \
    --headless --realtime --max-steps "$STEPS" --bridge-socket "$SOCKET_PATH"; then
    cat "$LOGGER_LOG" >&2
    exit 1
fi

set +e
wait "$LOGGER_PID"
LOGGER_STATUS=$?
set -e
LOGGER_PID=""
if [[ "$LOGGER_STATUS" -ne 0 ]]; then
    cat "$LOGGER_LOG" >&2
    if [[ "$LOGGER_STATUS" -eq 124 ]]; then
        printf '[FAIL] CAN frame logger did not stop after runner disconnect.\n' >&2
    fi
    exit 1
fi

"$CANTOOLS_PYTHON" "$SCRIPT_DIR/verify_can_frame_capture.py" \
    "$CAPTURE_PATH" "$REPO_ROOT/bridge/can/afs.dbc"
cat "$LOGGER_LOG"
