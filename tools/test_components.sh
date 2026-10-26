#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

usage() {
  cat <<'USAGE'
Usage: bash tools/test_components.sh [all|runner|bridge|dashboard|ecu|visualization|bridge-vcan]

Run software regression checks for one component, or all components by default.
bridge-vcan is optional and needs an already configured vcan0 interface.
USAGE
}

run_runner() {
  local python_bin="${METADRIVE_PYTHON:-simulation/metadrive/metadrive_venv/bin/python}"
  if [[ ! -x "${python_bin}" ]]; then
    if [[ -n "${METADRIVE_PYTHON:-}" ]]; then
      echo "Error: METADRIVE_PYTHON is not executable: ${python_bin}" >&2
      exit 2
    fi
    python_bin="$(command -v python3)"
  fi
  echo "==> MetaDrive runner: ${python_bin}"
  if "${python_bin}" -m pytest --version >/dev/null 2>&1; then
    PYTHONPATH=simulation_runner/src "${python_bin}" -m pytest simulation_runner/tests -v
  else
    PYTHONPATH=simulation_runner/src:simulation_runner "${python_bin}" - <<'PY'
import importlib
import inspect
from pathlib import Path
import traceback

total = 0
failures = 0
for path in sorted(Path("simulation_runner/tests").glob("test_*.py")):
    module = importlib.import_module(f"tests.{path.stem}")
    for name, function in inspect.getmembers(module, inspect.isfunction):
        if not name.startswith("test_") or function.__module__ != module.__name__:
            continue
        total += 1
        try:
            function()
        except Exception:
            failures += 1
            print(f"FAIL {path.name}::{name}")
            traceback.print_exc()
        else:
            print(f"PASS {path.name}::{name}")
print(f"Runner: {total - failures}/{total} passed")
raise SystemExit(1 if failures or not total else 0)
PY
  fi
}

run_bridge() {
  echo "==> Bridge: build and CTest"
  cmake -S bridge -B build/bridge -DBUILD_TESTING=ON
  cmake --build build/bridge
  ctest --test-dir build/bridge --output-on-failure
}

run_dashboard() {
  echo "==> Dashboard: headless unittest suite"
  PYTHONPATH=dashboard/src python3 -m unittest discover \
    -s dashboard/tests -p 'test_*.py' -v
}

run_ecu() {
  echo "==> ECU: host logic tests and STM32 firmware build"
  cmake -S firmware/tests -B firmware/build/host-tests -DCMAKE_BUILD_TYPE=Debug
  cmake --build firmware/build/host-tests
  ctest --test-dir firmware/build/host-tests --output-on-failure
  bash firmware/scripts/build_firmware.sh
}

run_visualization() {
  echo "==> Visualization: model tests and Code graph checks"
  node --test tools/system_visualization/tests/*.test.cjs
  while IFS= read -r js_file; do
    node --check "${js_file}"
  done < <(rg --files tools/system_visualization | rg '\.(js|mjs)$')
  python3 tools/system_visualization/code-graph/build_index.py --check
  node tools/system_visualization/code-graph/validate.mjs
}

run_bridge_vcan() {
  echo "==> Bridge virtual CAN: requires configured vcan0"
  if ! ip link show vcan0 >/dev/null 2>&1; then
    echo "Error: vcan0 is unavailable. Configure it before this optional test." >&2
    exit 2
  fi
  cmake -S bridge -B build/bridge-vcan -DBUILD_TESTING=ON \
    -DAFS_ENABLE_SOCKETCAN_VCAN_TEST=ON -DAFS_VCAN_INTERFACE=vcan0
  cmake --build build/bridge-vcan
  ctest --test-dir build/bridge-vcan -R '^socketcan_vcan_end_to_end$' --output-on-failure
}

if (($# > 1)); then
  usage >&2
  exit 2
fi

case "${1:-all}" in
  all)
    run_runner
    run_bridge
    run_dashboard
    run_ecu
    run_visualization
    ;;
  runner) run_runner ;;
  bridge) run_bridge ;;
  dashboard) run_dashboard ;;
  ecu) run_ecu ;;
  visualization) run_visualization ;;
  bridge-vcan) run_bridge_vcan ;;
  -h|--help) usage ;;
  *) usage >&2; exit 2 ;;
esac
