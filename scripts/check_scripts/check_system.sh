#!/usr/bin/env bash
set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
CAN_CHECK="$SCRIPT_DIR/check_can.sh"
STLINK_CHECK="$REPO_ROOT/firmware/scripts/check_stlink.sh"
SIMULATION_CHECK="$REPO_ROOT/simulation_runner/scripts/check_simulation_requirements.sh"
MODE="auto"
HARDWARE=0
CAN_INTERFACE="can0"
FAILURES=0
WARNINGS=0

usage() {
	cat <<'USAGE'
Usage: bash scripts/check.sh system [--headless|--rendered] [--can-interface NAME] [--hardware]

Check host dependencies and report read-only CAN/ST-Link USB visibility.
Hardware absence is a warning by default.

Options:
  --headless             Check MetaDrive requirements for headless operation.
  --rendered             Check MetaDrive requirements for a rendered window.
  --can-interface NAME   Select the CAN interface to inspect (default: can0).
  --hardware             Require CAN health and run the OpenOCD SWD reachability
                         check. OpenOCD resets, halts, and resumes the STM32;
                         it does not flash or erase it.
  -h, --help             Show this help without accessing hardware.
USAGE
}

while [ "$#" -gt 0 ]; do
	case "$1" in
		--headless) MODE="headless"; shift ;;
		--rendered) MODE="rendered"; shift ;;
		--can-interface)
			if [ "$#" -lt 2 ] || [ -z "$2" ]; then
				printf 'Error: --can-interface requires an interface name.\n' >&2
				exit 2
			fi
			CAN_INTERFACE="$2"
			shift 2
			;;
		--hardware) HARDWARE=1; shift ;;
		-h|--help) usage; exit 0 ;;
		*)
			printf 'Error: unknown option: %s\n' "$1" >&2
			usage >&2
			exit 2
			;;
	esac
done

pass() { printf '[PASS] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; WARNINGS=$((WARNINGS + 1)); }
fail() { printf '[FAIL] %s\n' "$1" >&2; FAILURES=$((FAILURES + 1)); }

check_command() {
	if command -v "$2" >/dev/null 2>&1; then
		pass "$1: $(command -v "$2")"
	else
		fail "$1: command '$2' is missing."
	fi
}

printf 'AFS system readiness check\n'
if [ "$(uname -s)" = "Linux" ]; then
	pass "Linux host detected."
else
	fail "Linux is required for MetaDrive runtime, SocketCAN, and firmware tools."
fi

check_command "C++ bridge build tool" cmake
check_command "C++ compiler" c++
check_command "Python runtime" python3
check_command "Network tools" ip

if command -v python3 >/dev/null 2>&1; then
	if python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)'; then
		pass "Python 3.10 or newer is available."
	else
		fail "Python 3.10 or newer is required."
	fi
fi

if [ "$MODE" = "auto" ]; then
	if [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; then
		MODE="rendered"
	else
		MODE="headless"
	fi
fi
if [ -f "$SIMULATION_CHECK" ]; then
	printf '\n==> Simulation runner requirements (%s mode)\n' "$MODE"
	if bash "$SIMULATION_CHECK" "--$MODE"; then
		pass "MetaDrive runner environment is ready."
	else
		fail "MetaDrive runner requirements are incomplete; run scripts/setup_system.sh --component runner."
	fi
else
	fail "Simulation requirement checker is missing at $SIMULATION_CHECK."
fi

DASHBOARD_PYTHON="${DASHBOARD_PYTHON:-$REPO_ROOT/simulation/metadrive/metadrive_venv/bin/python}"
if [ -x "$DASHBOARD_PYTHON" ]; then
	if "$DASHBOARD_PYTHON" -c 'import tkinter' >/dev/null 2>&1; then
		pass "Dashboard Python has Tkinter available."
	else
		fail "Dashboard Python cannot import Tkinter: $DASHBOARD_PYTHON"
	fi
else
	fail "Dashboard Python is missing: $DASHBOARD_PYTHON"
fi

if command -v node >/dev/null 2>&1; then
	pass "Node.js is available for System Visualization and its tests."
else
	warn "Node.js is missing; System Visualization JavaScript checks will not run."
fi
if command -v rg >/dev/null 2>&1; then
	pass "ripgrep is available for project checks."
else
	warn "ripgrep is missing; repository search and some test checks will not run."
fi

RUNNER_PYTHON="$REPO_ROOT/simulation/metadrive/metadrive_venv/bin/python"
if [ -x "$RUNNER_PYTHON" ] && "$RUNNER_PYTHON" -c 'import cantools' >/dev/null 2>&1; then
	pass "cantools is installed for the CAN DBC test smoke."
else
		warn "cantools is missing from the runner environment; run scripts/setup_system.sh --component tests."
fi

FIRMWARE_WEST="$REPO_ROOT/firmware/.venv/bin/west"
FIRMWARE_SDK="${ZEPHYR_SDK_INSTALL_DIR:-$REPO_ROOT/firmware/.sdk/zephyr-sdk-0.16.8}"
if [ -x "$FIRMWARE_WEST" ] && [ -d "$REPO_ROOT/firmware/zephyr" ] &&
	[ -x "$FIRMWARE_SDK/arm-zephyr-eabi/bin/arm-zephyr-eabi-gcc" ] &&
	[ -x "$FIRMWARE_SDK/sysroots/x86_64-pokysdk-linux/usr/bin/openocd" ]; then
	pass "Zephyr west workspace, ARM compiler, and OpenOCD are available."
else
	warn "Zephyr firmware development dependencies are incomplete; run scripts/setup_system.sh --component firmware."
fi

printf '\n==> Read-only hardware visibility\n'
if [ -x "$CAN_CHECK" ]; then
	if bash "$CAN_CHECK" "$CAN_INTERFACE"; then
		pass "CAN interface check passed."
	elif [ "$HARDWARE" -eq 1 ]; then
		fail "Required CAN interface check failed."
	else
		warn "CAN adapter/interface is not ready. Run scripts/check.sh can-up to configure a detected interface."
	fi
else
	fail "CAN read-only checker is missing at $CAN_CHECK."
fi

if command -v lsusb >/dev/null 2>&1; then
	STLINK_USB="$(lsusb -d 0483:3748 2>/dev/null || true)"
	if [ -n "$STLINK_USB" ]; then
		pass "ST-Link/V2 USB probe is visible: $STLINK_USB"
	elif [ "$HARDWARE" -eq 1 ]; then
		fail "ST-Link/V2 USB probe (0483:3748) is not visible to this Linux host."
	else
		warn "ST-Link/V2 USB probe is not visible; connect it to check ECU reachability."
	fi
else
	if [ "$HARDWARE" -eq 1 ]; then
		fail "lsusb is required for ST-Link detection; install usbutils."
	else
		warn "lsusb is missing; ST-Link USB visibility was not checked."
	fi
fi

if [ "$HARDWARE" -eq 1 ]; then
	printf '\n==> ST-Link to ECU reachability (OpenOCD reset/halt/resume)\n'
	if bash "$STLINK_CHECK"; then
		pass "OpenOCD reached and resumed the STM32 target."
	else
		fail "ST-Link is visible, but the OpenOCD SWD reachability check failed."
	fi
else
	printf '\n[INFO] OpenOCD/SWD target check skipped. Pass --hardware to reset, halt, and resume the STM32.\n'
fi

printf '\nCheck summary: %s failure(s), %s warning(s).\n' "$FAILURES" "$WARNINGS"
if [ "$FAILURES" -gt 0 ]; then
	exit 1
fi
