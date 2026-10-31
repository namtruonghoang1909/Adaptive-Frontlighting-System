#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: bash tests/scripts/test_launchers.sh

Run root launcher argument and dispatch regression tests.
USAGE
  exit 0
fi
if (($#)); then
  echo "Usage: bash tests/scripts/test_launchers.sh" >&2
  exit 2
fi
exec bash "$SCRIPT_DIR/test_component.sh" launchers
