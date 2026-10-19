#!/usr/bin/env bash

set -euo pipefail

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
readonly METADRIVE_PYTHON="${METADRIVE_PYTHON:-$REPO_ROOT/simulation/metadrive/metadrive_venv/bin/python}"

check_mode="--rendered"
check_scene_display="0"
show_help="0"
for argument in "$@"; do
    case "$argument" in
        -h|--help)
            show_help="1"
            ;;
        --headless)
            check_mode="--headless"
            ;;
        --scene-display|--visualize)
            check_scene_display="1"
            ;;
    esac
done

if [[ "$show_help" == "0" ]]; then
    check_arguments=("$check_mode")
    if [[ "$check_scene_display" == "1" ]]; then
        check_arguments+=(--scene-display)
    fi

    bash "$SCRIPT_DIR/check_simulation_requirements.sh" "${check_arguments[@]}"
fi

export PYTHONPATH="$REPO_ROOT/simulation_runner/src${PYTHONPATH:+:$PYTHONPATH}"

exec "$METADRIVE_PYTHON" -m metadrive_runner "$@"
