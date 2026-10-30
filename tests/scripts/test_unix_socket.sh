#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: bash tests/scripts/test_unix_socket.sh [MODULE...]

Run all cross-component Unix-socket tests, or select runner_bridge or
dashboard_bridge. These integration tests bind local Unix sockets.
USAGE
  exit 0
fi
exec bash "$SCRIPT_DIR/test_component.sh" unix_socket "$@"
