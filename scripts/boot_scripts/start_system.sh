#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
CAN_INTERFACE="${AFS_SYSTEM_CAN_INTERFACE:-}"
RUNNER_ARGS=()
CHILD_PIDS=()

usage() {
  cat <<'USAGE'
Usage: bash scripts/start.sh system [--can-interface NAME] [-- RUNNER_OPTIONS...]

Starts the C++ bridge, native Dashboard, and MetaDrive runner. The bridge starts
without SocketCAN unless --can-interface NAME is provided. Runner options after
-- are forwarded to the MetaDrive launcher.

Examples:
  bash scripts/start.sh system
  bash scripts/start.sh system --can-interface can0
  bash scripts/start.sh system -- --headless --max-steps 100

The STM32 firmware must already be flashed and powered; this script never
builds or flashes firmware. Press Ctrl+C to stop all host processes.
USAGE
}

while (($#)); do
  case "$1" in
    --can-interface)
      if (($# < 2)) || [[ -z "$2" ]]; then
        printf 'Error: --can-interface requires an interface name.\n' >&2
        usage >&2
        exit 2
      fi
      CAN_INTERFACE="$2"
      shift 2
      ;;
    --)
      shift
      RUNNER_ARGS=("$@")
      break
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Error: unknown system option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! command -v setsid >/dev/null 2>&1; then
  printf 'Error: setsid is required to manage the system processes.\n' >&2
  exit 1
fi

cleanup() {
  trap - EXIT INT TERM
  local pid
  for pid in "${CHILD_PIDS[@]}"; do
    kill -TERM -- "-${pid}" 2>/dev/null || true
  done
  for pid in "${CHILD_PIDS[@]}"; do
    wait "${pid}" 2>/dev/null || true
  done
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

start_child() {
  local name="$1"
  shift
  printf 'Starting %s...\n' "${name}"
  setsid --wait "$@" &
  CHILD_PIDS+=("$!")
}

printf 'Starting AFS host system'
if [[ -n "${CAN_INTERFACE}" ]]; then
  printf ' with CAN interface %s' "${CAN_INTERFACE}"
fi
printf '.\n'

BRIDGE_ARGS=()
if [[ -n "${CAN_INTERFACE}" ]]; then
  BRIDGE_ARGS+=(--can-interface "${CAN_INTERFACE}")
fi

start_child "C++ bridge" bash "${SCRIPT_DIR}/start_bridge.sh" "${BRIDGE_ARGS[@]}"
start_child "native Dashboard" bash "${SCRIPT_DIR}/start_dashboard.sh"
start_child "MetaDrive runner" bash "${SCRIPT_DIR}/start_runner.sh" "${RUNNER_ARGS[@]}"
printf 'All host components launched. Press Ctrl+C to stop them.\n'

set +e
wait -n "${CHILD_PIDS[@]}"
status=$?
set -e
printf 'A host component exited (status %s); stopping the others.\n' "${status}" >&2
exit "${status}"
