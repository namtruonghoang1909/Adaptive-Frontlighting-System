#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
RUNNER_ENV="$REPO_ROOT/simulation/metadrive/metadrive_venv"
RUNNER_PYTHON="$RUNNER_ENV/bin/python"
METADRIVE_SOURCE="$REPO_ROOT/simulation/metadrive"
FIRMWARE_DIR="$REPO_ROOT/firmware"
FIRMWARE_ENV="$FIRMWARE_DIR/.venv"
SDK_ROOT="$FIRMWARE_DIR/.sdk"
SDK_DIR="$SDK_ROOT/zephyr-sdk-0.16.8"
DOWNLOAD_DIR="$FIRMWARE_DIR/.downloads"
COMPONENT=""
DRY_RUN=0

usage() {
	cat <<'USAGE'
Usage: bash scripts/setup_system.sh --component runner|firmware|tests|all [--dry-run]

Prepare dependencies inside project-managed directories. This script never
uses sudo, apt, or writes packages to system Python. System packages such as
CMake, a C++ compiler, Node.js, and USB utilities must be installed separately.

Components:
  runner    Install the local MetaDrive checkout and its assets into its venv.
  firmware  Set up west, Zephyr modules, and the Zephyr SDK under firmware/.
  tests     Set up runner dependencies and install the pinned cantools test tool.
  all       Set up runner, tests, and firmware dependencies.

Firmware setup can download and unpack several gigabytes. Use --dry-run to
preview the commands before changing project-local environments.
USAGE
}

while [ "$#" -gt 0 ]; do
	case "$1" in
		--component)
			if [ "$#" -lt 2 ] || [ -z "$2" ]; then
				printf 'Error: --component requires runner, firmware, tests, or all.\n' >&2
				usage >&2
				exit 2
			fi
			COMPONENT="$2"
			shift 2
			;;
		--dry-run)
			DRY_RUN=1
			shift
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			printf 'Error: unknown option: %s\n' "$1" >&2
			usage >&2
			exit 2
			;;
	esac
done

case "$COMPONENT" in
	runner|firmware|tests|all) ;;
	*)
		printf 'Error: select a component with --component runner|firmware|tests|all.\n' >&2
		usage >&2
		exit 2
		;;
esac

run() {
	if [ "$DRY_RUN" -eq 1 ]; then
		printf '[DRY RUN]'
		printf ' %q' "$@"
		printf '\n'
		return 0
	fi
	"$@"
}

run_in() {
	directory="$1"
	shift
	if [ "$DRY_RUN" -eq 1 ]; then
		printf '[DRY RUN] (cd %q &&' "$directory"
		printf ' %q' "$@"
		printf ' )\n'
		return 0
	fi
	(cd "$directory" && "$@")
}

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		printf 'Error: required system command is missing: %s\n' "$1" >&2
		printf 'Run bash scripts/check.sh system for the dependency report.\n' >&2
		exit 1
	fi
}

setup_runner() {
	printf '\n==> Set up the MetaDrive runner environment\n'
	if [ ! -d "$METADRIVE_SOURCE" ] || [ ! -f "$METADRIVE_SOURCE/setup.py" ]; then
		printf 'Error: local MetaDrive source was not found at %s.\n' "$METADRIVE_SOURCE" >&2
		printf 'Restore the ignored MetaDrive checkout before setting up the runner.\n' >&2
		return 1
	fi
	require_command python3.11
	if [ ! -x "$RUNNER_PYTHON" ]; then
		run python3.11 -m venv "$RUNNER_ENV"
	fi
	run "$RUNNER_PYTHON" -m pip install -e "$METADRIVE_SOURCE"
	run "$RUNNER_PYTHON" -m metadrive.pull_asset
	if [ "$DRY_RUN" -eq 0 ]; then
		bash "$REPO_ROOT/simulation_runner/scripts/check_simulation_requirements.sh" --headless
	fi
}

download_if_missing() {
	filename="$1"
	url="$2"
	if [ -s "$DOWNLOAD_DIR/$filename" ]; then
		printf 'Using cached archive: %s\n' "$DOWNLOAD_DIR/$filename"
	else
		run curl --fail --location --retry 3 --output "$DOWNLOAD_DIR/$filename" "$url"
	fi
}

setup_sdk() {
	arm_compiler="$SDK_DIR/arm-zephyr-eabi/bin/arm-zephyr-eabi-gcc"
	openocd="$SDK_DIR/sysroots/x86_64-pokysdk-linux/usr/bin/openocd"
	minimal_archive="zephyr-sdk-0.16.8_linux-x86_64_minimal.tar.xz"
	arm_archive="toolchain_linux-x86_64_arm-zephyr-eabi.tar.xz"
	release_url="https://github.com/zephyrproject-rtos/sdk-ng/releases/download/v0.16.8"

	if [ -x "$arm_compiler" ] && [ -x "$openocd" ]; then
		printf 'Zephyr SDK 0.16.8 and ARM compiler are already present.\n'
		return 0
	fi
	printf 'Zephyr SDK setup may download and unpack several large archives.\n'
	require_command curl
	require_command tar
	require_command sha256sum
	require_command grep
	require_command wc
	require_command wget
	require_command cmake
	run mkdir -p "$DOWNLOAD_DIR" "$SDK_ROOT"
	download_if_missing "$minimal_archive" "$release_url/$minimal_archive"
	download_if_missing "$arm_archive" "$release_url/$arm_archive"
	download_if_missing sha256.sum "$release_url/sha256.sum"
	if [ "$DRY_RUN" -eq 0 ]; then
		checksum_lines="$(grep -E "$minimal_archive|$arm_archive" "$DOWNLOAD_DIR/sha256.sum")"
		if [ "$(printf '%s\n' "$checksum_lines" | wc -l)" -ne 2 ]; then
			printf 'Error: expected both Zephyr SDK checksums in %s.\n' "$DOWNLOAD_DIR/sha256.sum" >&2
			return 1
		fi
		printf '%s\n' "$checksum_lines" | (cd "$DOWNLOAD_DIR" && sha256sum --check --)
	fi
	run tar --extract --file "$DOWNLOAD_DIR/$minimal_archive" --directory "$SDK_ROOT"
	run tar --extract --file "$DOWNLOAD_DIR/$arm_archive" --directory "$SDK_DIR"
	run "$SDK_DIR/setup.sh" -h
	if [ "$DRY_RUN" -eq 0 ] && { [ ! -x "$arm_compiler" ] || [ ! -x "$openocd" ]; }; then
		printf 'Error: Zephyr SDK setup completed without the expected compiler/OpenOCD binaries.\n' >&2
		return 1
	fi
}

setup_firmware() {
	printf '\n==> Set up the Zephyr ECU environment\n'
	require_command python3.11
	if [ ! -x "$FIRMWARE_ENV/bin/python" ]; then
		run python3.11 -m venv "$FIRMWARE_ENV"
	fi
	run "$FIRMWARE_ENV/bin/python" -m pip install -r "$FIRMWARE_DIR/requirements.txt"
	if [ ! -f "$FIRMWARE_DIR/.west/config" ]; then
		if [ -e "$FIRMWARE_DIR/.west" ]; then
			printf 'Error: %s exists without a west config; inspect it before reinitializing.\n' "$FIRMWARE_DIR/.west" >&2
			return 1
		fi
		run "$FIRMWARE_ENV/bin/west" init -l "$FIRMWARE_DIR/afs_ecu"
	fi
	run_in "$FIRMWARE_DIR" "$FIRMWARE_ENV/bin/west" update
	run "$FIRMWARE_ENV/bin/python" -m pip install -r "$FIRMWARE_DIR/zephyr/scripts/requirements.txt"
	setup_sdk
}

setup_tests() {
	printf '\n==> Set up the test-only DBC decoder\n'
	if [ ! -x "$RUNNER_PYTHON" ]; then
		setup_runner || return $?
	elif [ "$DRY_RUN" -eq 0 ] && ! "$RUNNER_PYTHON" -c 'import metadrive' >/dev/null 2>&1; then
		setup_runner || return $?
	fi
	run "$RUNNER_PYTHON" -m pip install -r "$REPO_ROOT/tests/requirements.txt"
}

case "$COMPONENT" in
	runner) setup_runner ;;
	firmware) setup_firmware ;;
	tests) setup_tests ;;
	all)
		setup_runner
		setup_tests
		setup_firmware
		;;
esac

if [ "$DRY_RUN" -eq 1 ]; then
	printf '\nDry run complete; no project files, environments, or downloads were changed.\n'
else
	printf '\nSelected project-local dependencies are set up. Run bash scripts/check.sh system to inspect readiness.\n'
fi
