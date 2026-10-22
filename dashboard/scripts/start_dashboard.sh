#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
readonly DASHBOARD_PYTHON="${DASHBOARD_PYTHON:-$REPO_ROOT/simulation/metadrive/metadrive_venv/bin/python}"

if [[ ! -x "$DASHBOARD_PYTHON" ]]; then
    printf 'Dashboard Python is unavailable: %s\n' "$DASHBOARD_PYTHON" >&2
    exit 1
fi

export PYTHONPATH="$REPO_ROOT/dashboard/src${PYTHONPATH:+:$PYTHONPATH}"
exec "$DASHBOARD_PYTHON" -m afs_dashboard "$@"
