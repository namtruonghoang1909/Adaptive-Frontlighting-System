#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BOOT_DIR="${SCRIPT_DIR}/boot_scripts"

usage() {
	cat <<'USAGE'
Usage: bash scripts/start.sh COMPONENT [OPTIONS...]

Start one project process or the complete host system.

Components:
  system         Start the bridge, native Dashboard, and MetaDrive runner.
  bridge         Start the C++ bridge.
  runner         Start the MetaDrive simulation runner.
  dashboard      Open the native Dashboard.
  savvycan       Open SavvyCAN as an optional CAN monitor.
  visualization  Open the browser-based System Visualization tool.

Options after COMPONENT are passed to that component's launcher.
See scripts/dialogue.md for selector and option details.
USAGE
}

if (($# == 0)); then
	printf 'Error: choose a component to start.\n' >&2
	usage >&2
	exit 2
fi

component="$1"
shift

case "${component}" in
	-h|--help)
		usage
		exit 0
		;;
	system)
		exec bash "${BOOT_DIR}/start_system.sh" "$@"
		;;
	bridge)
		exec bash "${BOOT_DIR}/start_bridge.sh" "$@"
		;;
	runner)
		exec bash "${BOOT_DIR}/start_runner.sh" "$@"
		;;
	dashboard)
		exec bash "${BOOT_DIR}/start_dashboard.sh" "$@"
		;;
	savvycan)
		exec bash "${BOOT_DIR}/start_savvycan.sh" "$@"
		;;
	visualization)
		exec bash "${BOOT_DIR}/start_visualization.sh" "$@"
		;;
	*)
		printf 'Error: unknown component: %s\n' "${component}" >&2
		usage >&2
		exit 2
		;;
esac
