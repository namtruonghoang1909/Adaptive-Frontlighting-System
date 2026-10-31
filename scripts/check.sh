#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
CHECK_DIR="${SCRIPT_DIR}/check_scripts"

usage() {
	cat <<'USAGE'
Usage: bash scripts/check.sh CHECK [OPTIONS...]

Check project dependencies or hardware. Select one check:

  system [OPTIONS...]       Check host dependencies and report hardware visibility.
  system --hardware         Require CAN readiness and test ST-Link-to-ECU SWD.
  can [INTERFACE]           Read-only USB-CAN recognition and online-state check.
  can-up [INTERFACE]        Configure a down CAN interface at 500 kbit/s and bring it up.
  ecu                       Check ST-Link USB access and ECU target reachability.

The ECU check resets, halts, and resumes the STM32 through OpenOCD; it does not
flash or erase firmware. See scripts/dialogue.md for selector and option details.
USAGE
}

if (($# == 0)); then
	printf 'Error: choose a check to run.\n' >&2
	usage >&2
	exit 2
fi

check="$1"
shift

case "${check}" in
	-h|--help)
		usage
		exit 0
		;;
	system)
		exec bash "${CHECK_DIR}/check_system.sh" "$@"
		;;
	can)
		exec bash "${CHECK_DIR}/check_can.sh" "$@"
		;;
	can-up)
		exec bash "${CHECK_DIR}/can_interface_check.sh" "$@"
		;;
	ecu)
		if (($#)); then
			printf 'Error: the ECU reachability check does not accept arguments.\n' >&2
			usage >&2
			exit 2
		fi
		exec bash "${REPO_ROOT}/firmware/scripts/check_stlink.sh"
		;;
	*)
		printf 'Error: unknown check: %s\n' "${check}" >&2
		usage >&2
		exit 2
		;;
esac
