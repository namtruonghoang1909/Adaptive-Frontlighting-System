#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
readonly METADRIVE_PYTHON="${METADRIVE_PYTHON:-$REPO_ROOT/simulation/metadrive/metadrive_venv/bin/python}"

if [[ ! -x "$METADRIVE_PYTHON" ]]; then
    printf 'MetaDrive Python was not found or is not executable: %s\n' "$METADRIVE_PYTHON" >&2
    printf 'Run the requirement checker for setup details:\n' >&2
    printf '  bash simulation_runner/scripts/check_simulation_requirements.sh --headless\n' >&2
    printf 'See simulation_runner/runner.md for requirements and run examples.\n' >&2
    exit 1
fi

export PYTHONPATH="$REPO_ROOT/simulation_runner/src${PYTHONPATH:+:$PYTHONPATH}"

exec "$METADRIVE_PYTHON" -m metadrive_runner "$@"
