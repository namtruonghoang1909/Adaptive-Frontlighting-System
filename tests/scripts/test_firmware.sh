#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: bash tests/scripts/test_firmware.sh [MODULE...]

Run ECU host tests and a Zephyr firmware build. Select can_service to run only
the host-side CAN service tests without rebuilding the board image.
USAGE
  exit 0
fi
exec bash "$SCRIPT_DIR/test_component.sh" ecu "$@"
