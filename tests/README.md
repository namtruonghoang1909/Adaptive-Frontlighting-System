# Central Test Tree

All project-owned test cases, CMake test projects, fixtures, and test-only
smoke scripts live under this repository-root `tests/` directory. Component
implementation stays in its normal component folder. Tests shipped with the
ignored upstream Zephyr, MetaDrive, or Python dependency checkouts are vendor
tests and are not part of this project test tree.
For test-runner and verification failures, see [test errors](../docs/errors/test_errors.md).

```text
tests/
├── test_all.sh              # full software regression suite
├── unix_socket/
│   ├── runner_bridge/       # C++ receiver, Python peer, process smoke check
│   └── dashboard_bridge/    # Dashboard command/status IPC
├── can/
│   ├── bridge/
│   │   ├── encoder/         # Signal and DBC frame encoding
│   │   ├── status_decoder/  # ECU status frame validation
│   │   ├── socketcan/       # Native conversion and optional vcan
│   │   └── frame_smoke/     # Live runner-to-DBC diagnostic
│   └── ecu/can_service/     # ECU host CAN-service tests and CMake project
├── runner/                 # MetaDrive adapter and runner modules
├── dashboard/              # Operator commands and ECU-status mapping
├── visualization/          # Browser-model and page behavior
├── launchers/              # Root script argument and dispatch checks
├── test_runner/             # Central layout and suite-selector regression
└── scripts/                 # Focused test entrypoints, shared dispatcher, and guide
```

## Component Test Guides

Each top-level test area has a `README.md` describing what its folders or test
files cover. Start with the guide for the component you changed:

| Test area | Guide |
|---|---|
| CAN bridge and ECU | [`can/README.md`](can/README.md) |
| Dashboard | [`dashboard/README.md`](dashboard/README.md) |
| Host launchers | [`launchers/README.md`](launchers/README.md) |
| Simulation runner | [`runner/README.md`](runner/README.md) |
| Full suite | [`test_all.sh`](test_all.sh) |
| Focused test scripts | [`scripts/README.md`](scripts/README.md) and [`scripts/test_guide.md`](scripts/test_guide.md) |
| Test-runner infrastructure | [`test_runner/README.md`](test_runner/README.md) |
| Unix-socket IPC | [`unix_socket/README.md`](unix_socket/README.md) |
| System Visualization | [`visualization/README.md`](visualization/README.md) |

## Run One Component Or Module

Run focused checks from the repository root with the matching script under
`tests/scripts/`, for example `bash tests/scripts/test_bridge.sh can socketcan`.
The shared `tests/scripts/test_components.sh` dispatcher also accepts a
component or module selector:

For shorter component-specific commands with usage guides, see
[`scripts/test_guide.md`](scripts/test_guide.md).

```bash
bash tests/scripts/test_components.sh runner
bash tests/scripts/test_components.sh runner/ego_extraction
bash tests/scripts/test_components.sh runner/scene_display
bash tests/scripts/test_components.sh unix_socket
bash tests/scripts/test_components.sh unix_socket/runner_bridge
bash tests/scripts/test_components.sh bridge
bash tests/scripts/test_components.sh bridge/can
bash tests/scripts/test_components.sh bridge/can/encoder
bash tests/scripts/test_components.sh bridge/can/status_decoder
bash tests/scripts/test_components.sh bridge/can/socketcan
bash tests/scripts/test_components.sh bridge/can/frame_smoke
bash tests/scripts/test_components.sh dashboard/commands
bash tests/scripts/test_components.sh ecu/can_service
bash tests/scripts/test_components.sh visualization/beam_model
bash tests/scripts/test_components.sh test_runner
```

## Test Dependencies

Install the independent DBC decoder used by the headless frame smoke in the
MetaDrive environment:

```bash
simulation/metadrive/metadrive_venv/bin/python -m pip install -r tests/requirements.txt
```

If cantools is installed in another Python environment, set `CANTOOLS_PYTHON`
to that interpreter when running the frame smoke or the full suite.

Use `bash tests/test_all.sh` for every standard software suite, including the
headless CAN frame smoke with an independent DBC cross-check. This is the only
command that starts every suite; focused scripts stay in `tests/scripts/`.
Use `bash tests/scripts/test_components.sh bridge-vcan` only after configuring a
`vcan0` interface; it exercises the production SocketCAN bridge on that virtual
bus. These software checks do not replace physical CAN, ST-Link/RTT, or actuator
verification.

## Test Ownership And Coverage

| Test area | Location | Coverage |
|---|---|---|
| Unix socket | [`unix_socket/`](unix_socket/) | Runner and Dashboard IPC framing, validation, reconnects, lifecycle, and process-level publisher/receiver behavior. |
| Bridge CAN | [`can/bridge/`](can/bridge/) | Encoder, status decoder, SocketCAN conversion, optional vcan integration, and live DBC smoke modules. |
| ECU CAN service | [`can/ecu/can_service/`](can/ecu/can_service/) | The firmware's actual decoder, RTE, fallback controller, status encoder, and temporary CAN RX log formatter compiled for the host. |
| Simulation runner | [`runner/`](runner/) | Ego/surrounding extraction, scene matching/storage, controls, lifecycle, scene display, and IPC projection. |
| Dashboard | [`dashboard/`](dashboard/) | Operator command gating and presentation of fresh/stale ECU status. |
| Visualization | [`visualization/`](visualization/) | Beam model, page interaction, CAN message view, and source timestamp behavior. |
| Launchers | [`launchers/`](launchers/) | Root start-script help, argument validation, and component dispatch. |
| Test runner | [`test_runner/`](test_runner/) | Keeps test code centralized and verifies component/module selectors. |

The bridge's `CMakeLists.txt` and ECU host-test CMake project register test
sources from this root tree. Keep each test beside its component/module under
`tests/`, then update the dispatcher and this index when adding a module.

The live runner-to-bridge process check is available as
[`runner_ipc_live_smoke.sh`](unix_socket/runner_bridge/runner_ipc_live_smoke.sh).
The CAN frame smoke script is
[`run_can_frame_smoke.sh`](can/bridge/frame_smoke/run_can_frame_smoke.sh); it validates
runner-derived frame bytes and the DBC but does not open SocketCAN.

The command-line test runner is itself checked by
[`test_test_tree.py`](test_runner/test_test_tree.py), which guards the central
layout and focused selector interface.
