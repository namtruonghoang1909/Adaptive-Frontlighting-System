#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: bash tests/scripts/test_bridge.sh [MODULE...]

Run all bridge tests, or select a module, for example:
  bash tests/scripts/test_bridge.sh can encoder
  bash tests/scripts/test_bridge.sh unix_socket runner_bridge

The full bridge suite includes Unix-socket CTest cases and the headless CAN
frame smoke. The CAN smoke needs MetaDrive and cantools; see
tests/scripts/test_guide.md.
USAGE
  exit 0
fi
exec bash "$SCRIPT_DIR/test_component.sh" bridge "$@"
