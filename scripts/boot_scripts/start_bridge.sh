#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'USAGE'
Usage: bash scripts/start.sh bridge [BRIDGE_OPTIONS...]

Start the C++ bridge. Add --can-interface NAME to enable SocketCAN on an
already configured interface; without it, local runner/Dashboard IPC still run.
USAGE
  exit 0
fi

exec bash "${REPO_ROOT}/bridge/scripts/run_runner_bridge.sh" "$@"
