#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: bash tests/scripts/test_runner.sh [MODULE...]

Run all simulation-runner tests, or one module such as ego_extraction,
scene_display, or ipc_publisher.
USAGE
  exit 0
fi
exec bash "$SCRIPT_DIR/test_component.sh" runner "$@"
