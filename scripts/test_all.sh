#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: bash scripts/test_all.sh

Run every standard software suite. For a single component or module, use one
of the tests/scripts/test_*.sh component entrypoints instead.
USAGE
  exit 0
fi
if (($#)); then
  echo "Usage: bash scripts/test_all.sh" >&2
  exit 2
fi
TEST_DISPATCHER="$SCRIPT_DIR/../tests/scripts/test_components.sh"
for suite in runner bridge dashboard ecu visualization launchers test_runner; do
  bash "$TEST_DISPATCHER" "$suite"
done
