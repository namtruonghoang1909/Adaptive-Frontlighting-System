#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: bash tests/scripts/test_visualization.sh [MODULE...]

Run visualization model tests and Code graph checks, or one model module such
as beam_model, beam_segments, can_messages, or code_timestamp.
USAGE
  exit 0
fi
exec bash "$SCRIPT_DIR/test_component.sh" visualization "$@"
