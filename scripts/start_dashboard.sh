#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'USAGE'
Usage: bash scripts/start_dashboard.sh [DASHBOARD_OPTIONS...]

Open the native Dashboard through its component launcher. Set DASHBOARD_PYTHON
to select a Tkinter-capable Python interpreter.
USAGE
  exit 0
fi

exec bash "${REPO_ROOT}/dashboard/scripts/start_dashboard.sh" "$@"
