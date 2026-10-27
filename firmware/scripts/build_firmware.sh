#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FIRMWARE_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
SDK_DIR="${ZEPHYR_SDK_INSTALL_DIR:-${FIRMWARE_DIR}/.sdk/zephyr-sdk-0.16.8}"
WEST_BIN="${FIRMWARE_DIR}/.venv/bin/west"
BUILD_DIR="${FIRMWARE_DIR}/build"
APP_DIR="${FIRMWARE_DIR}/afs_ecu"

usage() {
  cat <<'USAGE'
Usage: bash firmware/scripts/build_firmware.sh [--pristine] [--no-ccache]

Build the black_f407ve Zephyr application. By default this uses an incremental
build. --pristine starts from a clean build directory; --no-ccache disables
Zephyr's ccache wrapper for this build.
USAGE
}

PRISTINE=false
NO_CCACHE=false
while (($# > 0)); do
  case "$1" in
    --pristine)
      PRISTINE=true
      ;;
    --no-ccache)
      NO_CCACHE=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

if [[ ! -x "${WEST_BIN}" ]]; then
  echo "Error: west was not found at ${WEST_BIN}. Set up firmware/.venv first." >&2
  exit 2
fi

if [[ ! -d "${SDK_DIR}" ]]; then
  echo "Error: Zephyr SDK was not found at ${SDK_DIR}." >&2
  echo "Install it or set ZEPHYR_SDK_INSTALL_DIR." >&2
  exit 2
fi

if [[ ! -f "${APP_DIR}/CMakeLists.txt" ]]; then
  echo "Error: Zephyr application is missing at ${APP_DIR}." >&2
  exit 2
fi

export ZEPHYR_SDK_INSTALL_DIR="${SDK_DIR}"
cd "${FIRMWARE_DIR}"

WEST_ARGS=(build -b black_f407ve -d "${BUILD_DIR}" "${APP_DIR}")
if [[ "${PRISTINE}" == true ]]; then
  WEST_ARGS=(build -p always -b black_f407ve -d "${BUILD_DIR}" "${APP_DIR}")
fi
if [[ "${NO_CCACHE}" == true ]]; then
  WEST_ARGS+=(-- -DUSE_CCACHE=0)
fi

exec "${WEST_BIN}" "${WEST_ARGS[@]}"
