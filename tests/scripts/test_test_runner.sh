#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: bash tests/scripts/test_test_runner.sh

Test the central test-tree layout and component/module selector behavior.
USAGE
  exit 0
fi
if (($#)); then
  echo "Usage: bash tests/scripts/test_test_runner.sh" >&2
  exit 2
fi
exec bash "$SCRIPT_DIR/test_component.sh" test_runner
