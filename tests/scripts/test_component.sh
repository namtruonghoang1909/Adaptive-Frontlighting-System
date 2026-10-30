#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'USAGE'
Usage: bash tests/scripts/test_component.sh SUITE [MODULE...]

Run one selected suite through the shared test runner. Component-specific
entrypoints in this directory provide shorter commands.

Example:
  bash tests/scripts/test_component.sh bridge can socketcan
USAGE
}

if (($# == 0)); then
  usage >&2
  exit 2
fi

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  usage
  exit 0
fi

suite="$1"
shift
while (($#)); do
  if [[ -z "$1" || "$1" == -* ]]; then
    echo "Error: invalid suite/module segment: $1" >&2
    usage >&2
    exit 2
  fi
  suite+="/$1"
  shift
done

exec bash "$SCRIPT_DIR/test_components.sh" "$suite"
