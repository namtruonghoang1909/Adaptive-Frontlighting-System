#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
readonly METADRIVE_PYTHON="${METADRIVE_PYTHON:-$REPO_ROOT/simulation/metadrive/metadrive_venv/bin/python}"

if [[ ! -x "$METADRIVE_PYTHON" ]]; then
    printf 'MetaDrive Python was not found or is not executable: %s\n' "$METADRIVE_PYTHON" >&2
    exit 1
fi

export PYTHONPATH="$REPO_ROOT/simulation_runner/src${PYTHONPATH:+:$PYTHONPATH}"

exec "$METADRIVE_PYTHON" -c '
import sys

import metadrive
import metadrive_runner
import object_extraction

print("Python:", sys.executable)
print("MetaDrive:", metadrive.__file__)
print("MetaDrive runner:", metadrive_runner.__file__)
print("Object extraction:", object_extraction.__file__)
print("MetaDrive libraries are available.")
'
