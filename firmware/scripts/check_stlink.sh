#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FIRMWARE_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
SDK_DIR="${ZEPHYR_SDK_INSTALL_DIR:-${FIRMWARE_DIR}/.sdk/zephyr-sdk-0.16.8}"
OPENOCD_BIN="${SDK_DIR}/sysroots/x86_64-pokysdk-linux/usr/bin/openocd"
OPENOCD_SCRIPTS="${SDK_DIR}/sysroots/x86_64-pokysdk-linux/usr/share/openocd/scripts"
OPENOCD_CONFIG="${SCRIPT_DIR}/openocd_stm32f4_swd.cfg"

if ! command -v lsusb >/dev/null 2>&1; then
  echo "Error: lsusb is required. Install the usbutils package." >&2
  exit 2
fi

if [[ ! -x "${OPENOCD_BIN}" ]]; then
  echo "Error: OpenOCD was not found at ${OPENOCD_BIN}." >&2
  echo "Install the Zephyr SDK or set ZEPHYR_SDK_INSTALL_DIR." >&2
  exit 2
fi

if [[ ! -d "${OPENOCD_SCRIPTS}" || ! -r "${OPENOCD_CONFIG}" ]]; then
  echo "Error: OpenOCD scripts or the project SWD config are missing." >&2
  exit 2
fi

STLINK_DEVICE="$(lsusb -d 0483:3748 2>&1 || true)"
if [[ "${STLINK_DEVICE}" != *"ID 0483:3748"* ]]; then
  echo "Error: ST-LINK/V2 (USB ID 0483:3748) is not visible to this Linux host." >&2
  echo "Check VMware USB passthrough, then reconnect the ST-LINK." >&2
  if [[ -n "${STLINK_DEVICE}" ]]; then
    printf '%s\n' "${STLINK_DEVICE}" >&2
  fi
  exit 2
fi

echo "USB probe found: ${STLINK_DEVICE}"
echo "Checking SWD with the project no-NRST configuration; no flash is written."

set +e
"${OPENOCD_BIN}" \
  -s "${OPENOCD_SCRIPTS}" \
  -f "${OPENOCD_CONFIG}" \
  -c "init; reset halt; targets; resume; shutdown"
OPENOCD_STATUS=$?
set -e

if [[ "${OPENOCD_STATUS}" -ne 0 ]]; then
  echo "OpenOCD reset/halt check failed with exit status ${OPENOCD_STATUS}." >&2
  echo "See firmware/docs/hardware_check.md for permission and SWD checks." >&2
  exit "${OPENOCD_STATUS}"
fi

echo "OpenOCD reset/halt check passed; the STM32 target was resumed."
