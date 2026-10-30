#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'USAGE'
Usage: bash tests/scripts/test_can.sh [bridge [MODULE...] | ecu]

With no arguments, run bridge CAN tests and ECU host CAN-service tests.
Examples:
  bash tests/scripts/test_can.sh bridge encoder
  bash tests/scripts/test_can.sh bridge socketcan
  bash tests/scripts/test_can.sh ecu
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

case "${1:-}" in
  "")
    exec bash "$SCRIPT_DIR/test_component.sh" can
    ;;
  bridge)
    shift
    exec bash "$SCRIPT_DIR/test_component.sh" bridge can "$@"
    ;;
  ecu|firmware)
    shift
    if (($# == 0)); then
      set -- can_service
    fi
    exec bash "$SCRIPT_DIR/test_component.sh" ecu "$@"
    ;;
  *)
    echo "Error: expected 'bridge' or 'ecu', got '$1'." >&2
    usage >&2
    exit 2
    ;;
esac
