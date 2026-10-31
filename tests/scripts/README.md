# Test Scripts

This folder contains focused test entrypoints and their shared dispatcher. The
component wrappers run only their selected suite; module arguments narrow the
selection further. The root [`tests/test_all.sh`](../../tests/test_all.sh)
is the only command that starts every standard suite.

| Script | What it runs |
|---|---|
| `test_runner.sh` | Simulation runner tests. |
| `test_bridge.sh` | Bridge CMake/CTest and CAN frame-smoke tests. |
| `test_dashboard.sh` | Dashboard command and ECU-status tests. |
| `test_firmware.sh` | ECU host tests and Zephyr build; `can_service` selects host tests only. |
| `test_can.sh` | Bridge CAN or ECU CAN tests. |
| `test_unix_socket.sh` | Runner/bridge and Dashboard/bridge IPC tests. |
| `test_visualization.sh` | Visualization behavior tests and Code graph checks. |
| `test_launchers.sh` | Root startup and test-entrypoint checks. |
| `test_test_runner.sh` | Central test layout and selector checks. |
| `test_components.sh` | Shared dispatcher for one component/module selector; it rejects the all-suite selector. |
| `test_component.sh` | Convenience wrapper for one suite and optional module. |

For selectors, prerequisites, and examples, see [`test_guide.md`](test_guide.md).
