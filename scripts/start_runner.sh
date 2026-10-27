#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'USAGE'
Usage: bash scripts/start_runner.sh [METADRIVE_OPTIONS...]

Start MetaDrive through the simulation runner's component launcher.
USAGE
  exit 0
fi

exec bash "${REPO_ROOT}/simulation_runner/scripts/start_metadrive_simulation.sh" "$@"
