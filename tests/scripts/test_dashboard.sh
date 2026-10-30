#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: bash tests/scripts/test_dashboard.sh [MODULE...]

Run all Dashboard tests or just one module, such as commands or gateway_status.
USAGE
  exit 0
fi
exec bash "$SCRIPT_DIR/test_component.sh" dashboard "$@"
