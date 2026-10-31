# Component Test Scripts

Run commands from the repository root. Focused entrypoints under
`tests/scripts/` delegate to the shared component dispatcher; test cases remain
organized by module under [`tests/`](../README.md). Choose the component
you changed instead of running the full software suite.

## Component Entry Points

| Command | What it runs |
|---|---|
| `bash tests/scripts/test_runner.sh [MODULE...]` | Simulation runner tests: extraction, controls, snapshots, lifecycle, scene display, and publishing. |
| `bash tests/scripts/test_bridge.sh [MODULE...]` | Bridge CMake/CTest coverage and the headless CAN frame smoke. |
| `bash tests/scripts/test_dashboard.sh [MODULE...]` | Dashboard command, power/mode gating, and ECU-status tests. |
| `bash tests/scripts/test_firmware.sh [MODULE...]` | ECU host CAN-service tests followed by a Zephyr firmware build. |
| `bash tests/scripts/test_visualization.sh [MODULE...]` | Visualization tests and Code graph validation. |
| `bash tests/scripts/test_unix_socket.sh [MODULE...]` | Runner/bridge and Dashboard/bridge Unix-socket integration tests. |
| `bash tests/scripts/test_can.sh [bridge [MODULE...] \| ecu]` | Bridge CAN and ECU host CAN-service regression tests. |
| `bash tests/scripts/test_launchers.sh` | Host launcher argument and dispatch checks. |
| `bash tests/scripts/test_test_runner.sh` | Central test-tree and selector regression checks. |
| `bash tests/test_all.sh` | The one command that runs every standard software suite. |

Use `--help` on an entrypoint to see its arguments. The shared dispatcher in
this directory runs one selected suite; root `tests/test_all.sh` is the only
all-suites command.

## Focused Examples

```bash
bash tests/scripts/test_runner.sh ego_extraction
bash tests/scripts/test_runner.sh scene_display
bash tests/scripts/test_bridge.sh can encoder
bash tests/scripts/test_bridge.sh can socketcan
bash tests/scripts/test_bridge.sh unix_socket runner_bridge
bash tests/scripts/test_dashboard.sh commands
bash tests/scripts/test_firmware.sh can_service
bash tests/scripts/test_visualization.sh beam_model
bash tests/scripts/test_unix_socket.sh dashboard_bridge
bash tests/scripts/test_can.sh ecu
```

The bridge's default suite includes all bridge CTest cases and the headless
runner-to-CAN-frame smoke. To run only one bridge module, pass its module path
as separate words, as in `can socketcan`. The `can` script without arguments
runs bridge CAN checks plus ECU host CAN-service tests. `test_firmware.sh
can_service` runs only the ECU host tests and skips the Zephyr rebuild.

## Prerequisites And Results

- The runner suite uses `simulation/metadrive/metadrive_venv/bin/python` by
  default; set `METADRIVE_PYTHON` to select another environment.
- The bridge CAN smoke runs MetaDrive headless and independently decodes the
  captured frames with cantools. Install the pinned test dependency with
  `simulation/metadrive/metadrive_venv/bin/python -m pip install -r tests/requirements.txt`,
  or set `CANTOOLS_PYTHON` to an interpreter that has cantools installed.
- The firmware suite needs the local Zephyr workspace and SDK. Its
  `can_service` module builds and runs host tests only.
- Unix-socket integration cases need permission to bind local Unix sockets.
  These tests do not require a CAN adapter.
- `bash tests/scripts/test_components.sh bridge-vcan` is a separate opt-in transport
  test and requires a configured `vcan0`. Physical CAN, ST-Link/RTT, and
  actuator checks require the hardware and are not part of these host scripts.

The test output names each suite and reports failures with a nonzero exit code.
For the full test layout, module coverage, and central commands, see the
[test tree index](../README.md) and
[verification guide](../../docs/verification/testing.md).
