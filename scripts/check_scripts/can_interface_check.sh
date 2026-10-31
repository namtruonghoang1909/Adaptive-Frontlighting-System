#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
	cat <<'USAGE'
Usage: bash scripts/check.sh can-up [INTERFACE]

Check a Linux SocketCAN interface and bring it up at the project bitrate
(500000 bit/s). The default interface is can0. A running interface is never
reconfigured or interrupted.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
	usage
	exit 0
fi

if (($# > 1)); then
	printf 'Error: expected at most one CAN interface name.\n' >&2
	usage >&2
	exit 2
fi

interface="${1:-can0}"
bitrate=500000

if [[ ! "${interface}" =~ ^[[:alnum:]][[:alnum:]_.-]{0,14}$ ]]; then
	printf 'Error: invalid network interface name: %s\n' "${interface}" >&2
	exit 2
fi

if ! command -v ip >/dev/null 2>&1; then
	printf 'Error: iproute2 is required (the ip command was not found).\n' >&2
	exit 2
fi

read_link_line() {
	ip -o link show dev "${interface}" 2>/dev/null
}

read_link_details() {
	ip -details link show dev "${interface}" 2>/dev/null
}

link_is_up() {
	local link_line="$1"
	local flags

	if [[ ! "${link_line}" =~ \<([^\>]*)\> ]]; then
		return 1
	fi
	flags="${BASH_REMATCH[1]}"
	[[ ",${flags}," == *,UP,* ]]
}

read_bitrate() {
	local details="$1"
	if [[ "${details}" =~ bitrate[[:space:]]+([0-9]+) ]]; then
		printf '%s' "${BASH_REMATCH[1]}"
	fi
}

run_ip_change() {
	if ((EUID == 0)); then
		ip "$@"
		return
	fi
	if ! command -v sudo >/dev/null 2>&1; then
		printf 'Error: sudo is required to configure or bring up %s.\n' "${interface}" >&2
		return 1
	fi
	sudo -- ip "$@"
}

link_line="$(read_link_line)" || {
	printf 'Error: CAN interface %s does not exist. Check USB detection and the CAN driver.\n' "${interface}" >&2
	exit 1
}

details="$(read_link_details)" || {
	printf 'Error: could not read details for %s.\n' "${interface}" >&2
	exit 1
}

if [[ "${details}" != *"link/can"* ]]; then
	printf 'Error: %s exists but is not a SocketCAN interface.\n' "${interface}" >&2
	exit 1
fi

current_bitrate="$(read_bitrate "${details}")"
if link_is_up "${link_line}"; then
	if [[ "${current_bitrate}" != "${bitrate}" ]]; then
		printf 'Error: %s is already UP at bitrate %s; expected %s.\n' \
			"${interface}" "${current_bitrate:-unknown}" "${bitrate}" >&2
		printf 'Stop CAN users and bring it down before changing its bitrate; this script will not interrupt it.\n' >&2
		exit 1
	fi
	printf '%s is already UP at %s bit/s; leaving its settings unchanged.\n' \
		"${interface}" "${bitrate}"
else
	printf 'Configuring %s for %s bit/s in normal CAN mode, then bringing it UP.\n' \
		"${interface}" "${bitrate}"
	run_ip_change link set dev "${interface}" type can bitrate "${bitrate}" loopback off
	run_ip_change link set dev "${interface}" up
fi

final_line="$(read_link_line)" || {
	printf 'Error: %s disappeared after configuration.\n' "${interface}" >&2
	exit 1
}
final_details="$(read_link_details)" || {
	printf 'Error: could not verify %s after configuration.\n' "${interface}" >&2
	exit 1
}

if ! link_is_up "${final_line}"; then
	printf 'Error: %s did not reach the UP state.\n' "${interface}" >&2
	exit 1
fi
if [[ "$(read_bitrate "${final_details}")" != "${bitrate}" ]]; then
	printf 'Error: %s is UP but its bitrate is not %s bit/s.\n' \
		"${interface}" "${bitrate}" >&2
	exit 1
fi

printf '\nFinal interface status:\n'
ip -details -statistics link show dev "${interface}"

if [[ "${final_details}" =~ can[[:space:]]state[[:space:]]([A-Z-]+) ]]; then
	can_state="${BASH_REMATCH[1]}"
	if [[ "${can_state}" != "ERROR-ACTIVE" ]]; then
		printf 'Warning: CAN state is %s; inspect bus wiring, bitrate, termination, and active ACK nodes.\n' \
			"${can_state}" >&2
	fi
fi
