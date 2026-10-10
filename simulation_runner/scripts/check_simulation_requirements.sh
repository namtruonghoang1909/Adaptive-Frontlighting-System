#!/usr/bin/env bash

set -u

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
readonly METADRIVE_PYTHON="${METADRIVE_PYTHON:-$REPO_ROOT/simulation/metadrive/metadrive_venv/bin/python}"

mode="rendered"
check_scene_display="0"

usage() {
    cat <<'EOF'
Usage: bash simulation_runner/scripts/check_simulation_requirements.sh [OPTIONS]

Check whether this machine can start the simulation runner without starting
MetaDrive itself.

Options:
  --rendered   Require a graphical Linux session (default).
  --headless   Check requirements for a run without a window.
  --scene-display, --visualize
               Also require FastAPI and Uvicorn for the browser display.
  -h, --help   Show this help.

Set METADRIVE_PYTHON=/path/to/python to check another Python environment.
EOF
}

while (( $# )); do
    case "$1" in
        --rendered)
            mode="rendered"
            ;;
        --headless)
            mode="headless"
            ;;
        --scene-display|--visualize)
            check_scene_display="1"
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            printf '[FAIL] Unknown argument: %s\n' "$1" >&2
            usage >&2
            exit 2
            ;;
    esac
    shift
done

printf 'Simulation requirement check (%s mode)\n' "$mode"
printf 'Repository: %s\n' "$REPO_ROOT"
printf 'Python: %s\n' "$METADRIVE_PYTHON"

if [[ ! -x "$METADRIVE_PYTHON" ]]; then
    printf '[FAIL] Python interpreter was not found or is not executable.\n' >&2
    printf '       Set METADRIVE_PYTHON or create the local MetaDrive environment.\n' >&2
    exit 1
fi

export PYTHONPATH="$REPO_ROOT/simulation_runner/src${PYTHONPATH:+:$PYTHONPATH}"
export AFS_REQUIREMENT_MODE="$mode"
export AFS_CHECK_SCENE_DISPLAY="$check_scene_display"
export MPLCONFIGDIR="${MPLCONFIGDIR:-${TMPDIR:-/tmp}/afs-simulation-matplotlib-${UID:-user}}"
if ! mkdir -p -- "$MPLCONFIGDIR"; then
    printf '[FAIL] Could not create the runtime cache directory: %s\n' "$MPLCONFIGDIR" >&2
    exit 1
fi

"$METADRIVE_PYTHON" - <<'PY'
from __future__ import annotations

import importlib
import logging
import os
from pathlib import Path
import sys


failures = 0
logging.getLogger("matplotlib").setLevel(logging.ERROR)


def passed(message: str) -> None:
    print(f"[PASS] {message}")


def failed(message: str) -> None:
    global failures
    failures += 1
    print(f"[FAIL] {message}")


if sys.platform.startswith("linux"):
    passed(f"Linux platform detected ({sys.platform}).")
else:
    failed(f"Linux is required; detected {sys.platform}.")

if sys.version_info >= (3, 10):
    passed(f"Python {sys.version.split()[0]} satisfies the >=3.10 requirement.")
else:
    failed(f"Python >=3.10 is required; detected {sys.version.split()[0]}.")

loaded_modules: dict[str, object] = {}
required_modules = ["panda3d.core", "metadrive", "metadrive_runner", "object_extraction"]
if os.environ["AFS_CHECK_SCENE_DISPLAY"] == "1":
    required_modules.extend(("fastapi", "uvicorn", "scene_display"))

for module_name in required_modules:
    try:
        module = importlib.import_module(module_name)
    except Exception as exc:
        failed(f"Could not import {module_name}: {type(exc).__name__}: {exc}")
    else:
        loaded_modules[module_name] = module
        module_path = getattr(module, "__file__", None) or "built in"
        passed(f"Imported {module_name} from {module_path}.")

if "metadrive" in loaded_modules:
    try:
        from metadrive.engine.asset_loader import AssetLoader
        from metadrive.version import VERSION, asset_version

        asset_path = Path(AssetLoader.asset_path)
        installed_asset_version = asset_version()
        needs_update = AssetLoader.should_update_asset()
    except Exception as exc:
        failed(f"Could not validate MetaDrive assets: {type(exc).__name__}: {exc}")
    else:
        if not asset_path.is_dir():
            failed(f"MetaDrive asset directory is missing: {asset_path}")
        elif installed_asset_version != VERSION:
            failed(
                "MetaDrive assets do not match the package: "
                f"assets={installed_asset_version}, package={VERSION}."
            )
        elif needs_update:
            failed(f"MetaDrive assets are incomplete or need an update: {asset_path}")
        else:
            passed(f"MetaDrive {VERSION} assets are ready at {asset_path}.")

mode = os.environ["AFS_REQUIREMENT_MODE"]
if mode == "headless":
    passed("Headless mode does not require DISPLAY or WAYLAND_DISPLAY.")
elif os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"):
    display_name = os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")
    passed(f"A graphical display variable is available ({display_name}).")
else:
    failed(
        "Rendered mode requires DISPLAY or WAYLAND_DISPLAY. "
        "Use --headless when no graphical session is available."
    )

if failures:
    print(f"Requirement check failed with {failures} unmet requirement(s).")
    raise SystemExit(1)

print("All simulation requirements for this mode are ready.")
PY
