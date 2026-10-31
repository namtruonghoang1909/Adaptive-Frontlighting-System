#!/usr/bin/env bash
set -uo pipefail

usage() {
	cat <<'USAGE'
Usage: bash scripts/check.sh can [INTERFACE]

Read-only check that a SocketCAN interface is recognized and online at the
project bitrate of 500000 bit/s. The default interface is can0. It does not
transmit a test frame or prove physical CANH/CANL communication.
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
expected_bitrate=500000
if [[ ! "${interface}" =~ ^[[:alnum:]][[:alnum:]_.-]{0,14}$ ]]; then
	printf 'Error: invalid network interface name: %s\n' "${interface}" >&2
	exit 2
fi
if ! command -v ip >/dev/null 2>&1; then
	printf 'Error: iproute2 is required; the ip command was not found.\n' >&2
	exit 2
fi

link_line="$(ip -o link show dev "${interface}" 2>/dev/null)"
if (($? != 0)); then
	printf 'FAIL: CAN interface %s is not present. Check USB enumeration and the SocketCAN driver.\n' "${interface}" >&2
	exit 1
fi

details="$(ip -details -statistics link show dev "${interface}" 2>/dev/null)"
if (($? != 0)); then
	printf 'FAIL: could not read details for %s.\n' "${interface}" >&2
	exit 1
fi
if [[ "${details}" != *"link/can"* ]]; then
	printf 'FAIL: %s exists but is not a SocketCAN interface.\n' "${interface}" >&2
	exit 1
fi
if [[ "${details}" != *"parentbus usb"* ]]; then
	printf 'FAIL: %s is a SocketCAN interface, but its USB adapter parent was not confirmed.\n' "${interface}" >&2
	printf 'Check that the project USB-CAN adapter is attached and recognized by Linux.\n' >&2
	exit 1
fi

if [[ "${link_line}" =~ \<([^\>]*)\> ]]; then
	flags="${BASH_REMATCH[1]}"
else
	flags=""
fi
if [[ ",${flags}," != *,UP,* ]]; then
	printf 'FAIL: %s is recognized as CAN but is DOWN. Run bash scripts/check.sh can-up %s to configure and bring it up.\n' \
		"${interface}" "${interface}" >&2
	exit 1
fi

if [[ "${details}" =~ bitrate[[:space:]]+([0-9]+) ]]; then
	bitrate="${BASH_REMATCH[1]}"
else
	bitrate="unknown"
fi
if [[ "${bitrate}" != "${expected_bitrate}" ]]; then
	printf 'FAIL: %s is UP at bitrate %s; expected %s bit/s.\n' \
		"${interface}" "${bitrate}" "${expected_bitrate}" >&2
	exit 1
fi

if [[ "${details}" =~ can[[:space:]]state[[:space:]]([A-Z-]+) ]]; then
	can_state="${BASH_REMATCH[1]}"
else
	can_state="unknown"
fi
if [[ "${can_state}" != "ERROR-ACTIVE" ]]; then
	printf 'FAIL: %s is UP at the expected bitrate but CAN state is %s. Check the physical bus, ACK node, and termination.\n' \
		"${interface}" "${can_state}" >&2
	ip -details -statistics link show dev "${interface}" >&2
	exit 1
fi

printf 'PASS: %s is present, UP, and ERROR-ACTIVE at %s bit/s.\n' \
	"${interface}" "${expected_bitrate}"
printf 'PASS: %s is recognized as a USB-backed SocketCAN adapter.\n' "${interface}"

if command -v ethtool >/dev/null 2>&1; then
	driver_info="$(ethtool -i "${interface}" 2>/dev/null)"
	if [[ "${driver_info}" =~ driver:[[:space:]]*([^[:space:]]+) ]]; then
		printf 'CAN driver: %s\n' "${BASH_REMATCH[1]}"
	else
		printf 'INFO: ethtool did not report a driver for %s.\n' "${interface}"
	fi
else
	printf 'INFO: ethtool is not installed; driver name was not checked.\n'
fi

printf '\nCurrent interface details:\n'
ip -details -statistics link show dev "${interface}"
