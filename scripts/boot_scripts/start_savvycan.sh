#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
DBC_FILE="${REPO_ROOT}/bridge/can/afs.dbc"
LOCAL_SAVVYCAN_BIN="${REPO_ROOT}/.tools/savvycan/squashfs-root/AppRun"

usage() {
  cat <<'USAGE'
Usage: bash scripts/start.sh savvycan

Start SavvyCAN as a separate, optional CAN monitor. Select the SocketCAN
interface and load the project DBC from the SavvyCAN window. This script does
not configure CAN or add SavvyCAN to start_system.sh.

By default, the launcher checks PATH and then the project-local extracted AppImage.
Set SAVVYCAN_BIN to an executable name or path to override that lookup.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if (($#)); then
  printf 'Error: this launcher does not accept arguments.\n' >&2
  usage >&2
  exit 2
fi

if [[ ! -f "${DBC_FILE}" ]]; then
  printf 'Error: project CAN DBC was not found: %s\n' "${DBC_FILE}" >&2
  exit 1
fi

SAVVYCAN_EXECUTABLE=""
if [[ -n "${SAVVYCAN_BIN:-}" ]]; then
  if [[ "${SAVVYCAN_BIN}" == */* ]]; then
    if [[ -x "${SAVVYCAN_BIN}" && ! -d "${SAVVYCAN_BIN}" ]]; then
      SAVVYCAN_EXECUTABLE="${SAVVYCAN_BIN}"
    fi
  else
    SAVVYCAN_EXECUTABLE="$(command -v "${SAVVYCAN_BIN}" || true)"
  fi
else
  SAVVYCAN_EXECUTABLE="$(command -v SavvyCAN || command -v savvycan || true)"
  if [[ -z "${SAVVYCAN_EXECUTABLE}" && -x "${LOCAL_SAVVYCAN_BIN}" ]]; then
    SAVVYCAN_EXECUTABLE="${LOCAL_SAVVYCAN_BIN}"
  fi
fi

if [[ -z "${SAVVYCAN_EXECUTABLE}" ]]; then
  printf 'Error: SavvyCAN was not found. Install its Linux GUI or set SAVVYCAN_BIN to its executable.\n' >&2
  exit 127
fi

printf 'Starting SavvyCAN: %s\n' "${SAVVYCAN_EXECUTABLE}"
printf 'Project DBC: %s\n' "${DBC_FILE}"
cat <<'INSTRUCTIONS'
In SavvyCAN, create a QT SerialBus SocketCAN connection for your configured
interface (for example can0), then load the project DBC through DBC File Manager.
The interface bitrate must already be configured in Linux.
INSTRUCTIONS

exec "${SAVVYCAN_EXECUTABLE}"
