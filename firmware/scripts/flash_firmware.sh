#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FIRMWARE_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
SDK_DIR="${ZEPHYR_SDK_INSTALL_DIR:-${FIRMWARE_DIR}/.sdk/zephyr-sdk-0.16.8}"
WEST_BIN="${FIRMWARE_DIR}/.venv/bin/west"
BUILD_DIR="${FIRMWARE_DIR}/build"
OPENOCD_CONFIG="${SCRIPT_DIR}/openocd_stm32f4_swd.cfg"

if [[ ! -x "${WEST_BIN}" ]]; then
  echo "Error: west was not found at ${WEST_BIN}. Set up firmware/.venv first." >&2
  exit 2
fi

if [[ ! -d "${SDK_DIR}" ]]; then
  echo "Error: Zephyr SDK was not found at ${SDK_DIR}." >&2
  echo "Install it or set ZEPHYR_SDK_INSTALL_DIR." >&2
  exit 2
fi

if [[ ! -r "${OPENOCD_CONFIG}" ]]; then
  echo "Error: project OpenOCD configuration is missing at ${OPENOCD_CONFIG}." >&2
  exit 2
fi

if [[ ! -f "${BUILD_DIR}/zephyr/zephyr.hex" ]]; then
  echo "Error: no built image at ${BUILD_DIR}/zephyr/zephyr.hex." >&2
  echo "Build it first with bash firmware/scripts/build_firmware.sh." >&2
  exit 2
fi

export ZEPHYR_SDK_INSTALL_DIR="${SDK_DIR}"
"${SCRIPT_DIR}/check_stlink.sh"

cd "${FIRMWARE_DIR}"
exec "${WEST_BIN}" flash -d "${BUILD_DIR}" --config "${OPENOCD_CONFIG}" "$@"
