#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

usage() {
  cat <<'USAGE'
Usage: bash tests/scripts/test_components.sh SUITE

Run one component or focused component/module suite. Use
bash scripts/test_all.sh to run every standard software suite.

Suites:
  runner[/MODULE]             Runner tests, optionally one module
  bridge                      All bridge CMake/CTest cases
  bridge/unix_socket          Bridge Unix socket integration cases
  bridge/unix_socket/MODULE   One Bridge Unix socket module
  bridge/can[/MODULE]         Bridge CAN module tests
  unix_socket[/MODULE]        Cross-component Unix socket cases
  can                         Bridge CAN cases and ECU CAN service cases
  dashboard[/MODULE]          Dashboard tests, optionally one module
  ecu                         ECU host tests and Zephyr firmware build
  ecu/can_service             ECU host CAN service tests only
  visualization[/MODULE]      Visualization tests and graph checks
  launchers                   Root launcher argument/dispatch tests
  test_runner                 Central test-tree and module-selector checks
  bridge-vcan                 Optional end-to-end test on configured vcan0

Modules:
  runner/<module>: ego_extraction, ipc_publisher, lifecycle, scene_display,
          scene_snapshot, snapshot_store, surrounding_extraction,
          vehicle_control
  unix_socket: runner_bridge, dashboard_bridge
  bridge/can/<module>: encoder, status_decoder, socketcan, frame_smoke
  dashboard/<module>: commands, gateway_status
  visualization/<module>: beam_model, beam_segments, can_messages,
                           code_timestamp

Examples:
  bash tests/scripts/test_components.sh runner/ego_extraction
  bash tests/scripts/test_components.sh unix_socket/runner_bridge
  bash tests/scripts/test_components.sh bridge/can/socketcan
  bash tests/scripts/test_components.sh dashboard/commands
  bash tests/scripts/test_components.sh ecu/can_service
  bash tests/scripts/test_components.sh visualization/beam_model

The optional bridge-vcan suite requires an already configured vcan0 interface.
USAGE
}

run_runner() {
  local test_dir="$1"
  local python_bin="${METADRIVE_PYTHON:-simulation/metadrive/metadrive_venv/bin/python}"
  if [[ ! -x "${python_bin}" ]]; then
    if [[ -n "${METADRIVE_PYTHON:-}" ]]; then
      echo "Error: METADRIVE_PYTHON is not executable: ${python_bin}" >&2
      exit 2
    fi
    python_bin="$(command -v python3)"
  fi
  echo "==> Runner tests: ${test_dir} (${python_bin})"
  if "${python_bin}" -m pytest --version >/dev/null 2>&1; then
    PYTHONPATH=simulation_runner/src "${python_bin}" -m pytest "${test_dir}" -v
  else
    PYTHONPATH=simulation_runner/src "${python_bin}" - "${test_dir}" <<'PY'
import importlib.util
import inspect
from pathlib import Path
import sys
import traceback

test_dir = Path(sys.argv[1])
total = 0
failures = 0
for path in sorted(test_dir.rglob("test_*.py")):
    module_name = "afs_test_" + "_".join(path.relative_to(test_dir).with_suffix("").parts)
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot import test module: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
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

run_bridge_filtered() {
  local regex="$1"
  echo "==> Bridge tests matching: ${regex}"
  cmake -S bridge -B build/bridge -DBUILD_TESTING=ON
  cmake --build build/bridge
  ctest --test-dir build/bridge -R "${regex}" --output-on-failure
}

run_bridge() {
  echo "==> Bridge: build and CTest"
  cmake -S bridge -B build/bridge -DBUILD_TESTING=ON
  cmake --build build/bridge
  ctest --test-dir build/bridge --output-on-failure
  run_can_frame_smoke
}

run_dashboard_module() {
  local test_dir="$1"
  echo "==> Dashboard tests: ${test_dir}"
  PYTHONPATH=dashboard/src python3 -m unittest discover \
    -s "${test_dir}" -p 'test_*.py' -v
}

run_dashboard() {
  local module_dir
  echo "==> Dashboard: headless unittest suites"
  for module_dir in tests/dashboard/*; do
    [[ -d "${module_dir}" ]] || continue
    run_dashboard_module "${module_dir}"
  done
}

run_ecu_host() {
  local regex="${1:-^ecu_}"
  echo "==> ECU host CAN service tests"
  cmake -S tests/can/ecu/can_service -B build/tests/ecu-host -DCMAKE_BUILD_TYPE=Debug
  cmake --build build/tests/ecu-host
  ctest --test-dir build/tests/ecu-host -R "${regex}" --output-on-failure
}

run_ecu() {
  run_ecu_host
  echo "==> Zephyr STM32 firmware build"
  bash firmware/scripts/build_firmware.sh
}

run_visualization() {
  echo "==> Visualization: model tests and Code graph checks"
  node --test tests/visualization/*/*.test.cjs
  while IFS= read -r js_file; do
    node --check "${js_file}"
  done < <(rg --files tools/system_visualization | rg '\.(js|mjs)$')
  python3 tools/system_visualization/code-graph/build_index.py --check
  node tools/system_visualization/code-graph/validate.mjs
}

run_visualization_module() {
  local module="$1"
  if [[ ! -d "tests/visualization/${module}" ]]; then
    echo "Error: unknown visualization test module: ${module}" >&2
    usage >&2
    exit 2
  fi
  echo "==> Visualization module: ${module}"
  node --test "tests/visualization/${module}"/*.test.cjs
}

run_launchers() {
  echo "==> Root launchers: command-line and dispatch checks"
  python3 -m unittest discover -s tests/launchers -p 'test_*.py' -v
}

run_test_runner() {
  echo "==> Central test tree and selector regression checks"
  python3 -m unittest discover -s tests/test_runner -p 'test_*.py' -v
}

run_unix_socket() {
  local module="${1:-}"
  case "${module}" in
    "")
      run_bridge_filtered '^(runner_ipc_integration|dashboard_ipc_integration|runner_ipc_python_end_to_end)$'
      ;;
    runner_bridge)
      run_bridge_filtered '^(runner_ipc_integration|runner_ipc_python_end_to_end)$'
      ;;
    dashboard_bridge)
      run_bridge_filtered '^dashboard_ipc_integration$'
      ;;
    *)
      echo "Error: unknown Unix socket test module: ${module}" >&2
      usage >&2
      exit 2
      ;;
  esac
}

run_bridge_can() {
  run_bridge_filtered '^(can_encoder_signal_values|can_frame_encoder|afs_status_decoder|socketcan_frame_conversion)$'
  run_can_frame_smoke
}

run_can_frame_smoke() {
  echo "==> Bridge CAN frame smoke: MetaDrive, generated codec, and DBC check"
  bash tests/can/bridge/frame_smoke/run_can_frame_smoke.sh
}

run_bridge_can_module() {
  local module="$1"
  case "${module}" in
    encoder)
      run_bridge_filtered '^(can_encoder_signal_values|can_frame_encoder)$'
      ;;
    status_decoder)
      run_bridge_filtered '^afs_status_decoder$'
      ;;
    socketcan)
      run_bridge_filtered '^socketcan_frame_conversion$'
      ;;
    frame_smoke)
      run_can_frame_smoke
      ;;
    *)
      echo "Error: unknown bridge CAN test module: ${module}" >&2
      usage >&2
      exit 2
      ;;
  esac
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

if (($# != 1)); then
  usage >&2
  exit 2
fi

suite="$1"
case "${suite}" in
  runner)
    run_runner tests/runner
    ;;
  runner/*)
    module="${suite#runner/}"
    if [[ ! -d "tests/runner/${module}" ]]; then
      echo "Error: unknown runner test module: ${module}" >&2
      usage >&2
      exit 2
    fi
    run_runner "tests/runner/${module}"
    ;;
  bridge)
    run_bridge
    ;;
  bridge/unix_socket)
    run_unix_socket
    ;;
  bridge/unix_socket/*)
    run_unix_socket "${suite#bridge/unix_socket/}"
    ;;
  bridge/can)
    run_bridge_can
    ;;
  bridge/can/*)
    run_bridge_can_module "${suite#bridge/can/}"
    ;;
  unix_socket)
    run_unix_socket
    ;;
  unix_socket/*)
    run_unix_socket "${suite#unix_socket/}"
    ;;
  can)
    run_bridge_can
    run_ecu_host
    ;;
  dashboard)
    run_dashboard
    ;;
  dashboard/*)
    module="${suite#dashboard/}"
    if [[ ! -d "tests/dashboard/${module}" ]]; then
      echo "Error: unknown Dashboard test module: ${module}" >&2
      usage >&2
      exit 2
    fi
    run_dashboard_module "tests/dashboard/${module}"
    ;;
  ecu)
    run_ecu
    ;;
  ecu/can_service)
    run_ecu_host
    ;;
  visualization)
    run_visualization
    ;;
  visualization/*)
    run_visualization_module "${suite#visualization/}"
    ;;
  launchers)
    run_launchers
    ;;
  test_runner)
    run_test_runner
    ;;
  bridge-vcan)
    run_bridge_vcan
    ;;
  -h|--help)
    usage
    ;;
  *)
    echo "Error: unknown test suite: ${suite}" >&2
    usage >&2
    exit 2
    ;;
esac
