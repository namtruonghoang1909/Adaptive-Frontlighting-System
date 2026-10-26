#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FIRMWARE_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
SDK_DIR="${ZEPHYR_SDK_INSTALL_DIR:-${FIRMWARE_DIR}/.sdk/zephyr-sdk-0.16.8}"
OPENOCD_BIN="${SDK_DIR}/sysroots/x86_64-pokysdk-linux/usr/bin/openocd"
OPENOCD_SCRIPTS="${SDK_DIR}/sysroots/x86_64-pokysdk-linux/usr/share/openocd/scripts"
OPENOCD_CONFIG="${SCRIPT_DIR}/openocd_stm32f4_swd.cfg"
RTT_PORT="${AFS_RTT_PORT:-9090}"

if [[ ! "${RTT_PORT}" =~ ^[1-9][0-9]{0,4}$ ]] || ((RTT_PORT > 65535)); then
  echo "Error: AFS_RTT_PORT must be a TCP port from 1 to 65535." >&2
  exit 2
fi

if [[ ! -x "${OPENOCD_BIN}" || ! -d "${OPENOCD_SCRIPTS}" || ! -r "${OPENOCD_CONFIG}" ]]; then
  echo "Error: the Zephyr SDK OpenOCD or the project SWD configuration is missing." >&2
  echo "Install the SDK or set ZEPHYR_SDK_INSTALL_DIR." >&2
  exit 2
fi

if ! command -v nc >/dev/null 2>&1; then
  echo "Error: netcat (nc) is required to read the local RTT stream." >&2
  exit 2
fi

if nc -z 127.0.0.1 "${RTT_PORT}" >/dev/null 2>&1; then
  echo "Error: local TCP port ${RTT_PORT} is already in use. Set AFS_RTT_PORT to another port." >&2
  exit 2
fi

OPENOCD_LOG="$(mktemp)"
OPENOCD_PID=""
cleanup() {
  if [[ -n "${OPENOCD_PID}" ]]; then
    kill "${OPENOCD_PID}" 2>/dev/null || true
    wait "${OPENOCD_PID}" 2>/dev/null || true
  fi
  rm -f -- "${OPENOCD_LOG}"
}
trap cleanup EXIT

"${OPENOCD_BIN}" \
  -s "${OPENOCD_SCRIPTS}" \
  -f "${OPENOCD_CONFIG}" \
  -c "bindto 127.0.0.1; init; rtt setup 0x20000000 0x20000 \"SEGGER RTT\"; rtt start; rtt server start ${RTT_PORT} 0" \
  >"${OPENOCD_LOG}" 2>&1 &
OPENOCD_PID=$!

READY=false
for ((attempt = 0; attempt < 100; attempt++)); do
  if ! kill -0 "${OPENOCD_PID}" 2>/dev/null; then
    break
  fi
  if nc -z 127.0.0.1 "${RTT_PORT}" >/dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 0.1
done

if [[ "${READY}" != true ]]; then
  echo "Error: OpenOCD did not start the RTT server. Its output follows:" >&2
  cat -- "${OPENOCD_LOG}" >&2
  exit 1
fi

echo "Reading ECU RTT console on channel 0. Press Ctrl+C to stop."
echo "Reset the board after connecting if you want to see startup messages."
nc 127.0.0.1 "${RTT_PORT}"
