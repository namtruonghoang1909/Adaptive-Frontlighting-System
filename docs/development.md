# Development Guide

Use this guide to find the command or script for each runnable part of the
repository. Run commands from the repository root on Linux unless a section
says otherwise.

## Script Index

| Script | Project part | What it does |
|---|---|---|
| `simulation_runner/scripts/check_simulation_requirements.sh` | Simulation runner | Checks the Python environment, MetaDrive imports and assets, and selected display requirements without launching MetaDrive. |
| `simulation_runner/scripts/start_metadrive_simulation.sh` | Simulation runner | Launches `metadrive_runner` and forwards all runner options. Runner-to-bridge publishing starts automatically. |
| `bridge/scripts/run_runner_bridge.sh` | C++ bridge | Configures and builds `afs_runner_bridge`, then runs the receiver in the foreground. |
| `bridge/scripts/run_can_frame_smoke.sh` | C++ bridge / CAN | Runs headless MetaDrive through the diagnostic frame logger and independently checks captured payloads against the DBC with cantools. |
| `dashboard/scripts/start_dashboard.sh` | Dashboard | Opens the native Tkinter Dashboard window with the configured Python environment. |
| `firmware/scripts/build_firmware.sh` | Zephyr firmware | Builds the ECU CAN receive/status application for `black_f407ve`. |
| `firmware/scripts/check_stlink.sh` | Zephyr firmware | Checks USB/SWD access and the no-NRST OpenOCD reset/halt sequence without flashing. |
| `firmware/scripts/flash_firmware.sh` | Zephyr firmware | Repeats the ST-LINK check, then flashes with the project no-NRST OpenOCD config. |
| `firmware/scripts/read_rtt.sh` | Zephyr firmware | Reads ECU `printk` diagnostics through ST-Link SWD and OpenOCD RTT. |
| `tools/test_components.sh` | All software components | Runs one component's regression tests or all suites. |
| `tools/system_visualization/start_system_visualization.sh` | System Visualization | Serves the Code graph, System in Action, high/low beam, CAN messages, and hardware wiring views on localhost. |

The scripts under `simulation_runner/scripts/` use
`simulation/metadrive/metadrive_venv/bin/python` by default. Set
`METADRIVE_PYTHON=/path/to/python` to use another environment. The bridge
launcher uses `build/bridge` and a `Release` CMake build by default; override
these with `AFS_BRIDGE_BUILD_DIR` and `AFS_BRIDGE_BUILD_TYPE`. The Dashboard
launcher also defaults to the MetaDrive environment; use `DASHBOARD_PYTHON` to
select another Tkinter-capable Python.

## Run Component Tests

Use `bash tools/test_components.sh COMPONENT` after changing a component. Use
`all` before an integration handoff. Components are `runner`, `bridge`,
`dashboard`, `ecu`, and `visualization`; omitting the argument runs all. The
optional `bridge-vcan` target requires an already configured `vcan0` interface.
The [testing guide](verification/testing.md) lists coverage and hardware limits.

## Run The Simulation And Bridge

Start the receiver in a terminal:

```bash
bash bridge/scripts/run_runner_bridge.sh
```

The script builds the bridge if needed and starts it. It prints each accepted
runner message as JSON in this terminal. In another terminal, start a finite
headless simulation:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh \
  --headless --max-steps 100
```

The start script checks the requirements for the requested mode before it
launches MetaDrive. The runner connects and publishes automatically; there is
no separate publishing flag. The runner retries while the receiver is
unavailable. To start a rendered MetaDrive window:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh
```

To include the optional browser scene display, add `--scene-display`; the
launcher checks its dependencies automatically. Use `--headless
--scene-display` when a graphical MetaDrive window is not needed. Run
`check_simulation_requirements.sh` directly only to check readiness without
starting the runner. The runner's options and requirements are listed in
[simulation_runner/runner.md](../simulation_runner/runner.md).

```bash
bash simulation_runner/scripts/check_simulation_requirements.sh --headless
```

Both processes select the same socket path by default:
`$XDG_RUNTIME_DIR/afs/runner-bridge.sock`, or
`/tmp/afs-<uid>/runner-bridge.sock` when `XDG_RUNTIME_DIR` is unset. To
override it, pass `--socket PATH` to the bridge script and `--bridge-socket PATH`
to the runner, or set `AFS_BRIDGE_SOCKET` to the same path in both terminals.
See [bridge/README.md](../bridge/README.md) for bridge details.

### Enable SocketCAN

The bridge starts without opening CAN by default. To enable transmit/receive,
pass the name of an existing, up CAN interface:

```bash
bash bridge/scripts/run_runner_bridge.sh --can-interface can0
```

For a prepared virtual interface, use `--can-interface vcan0`. The bridge does
not create interfaces, set link state, or configure bitrate. It sends runner-
derived `0x100` and `0x200` frames every 20 ms, `0x300` every 100 ms, and the
Dashboard command `0x400` every 50 ms. It receives filtered `0x500 AFS_Status`
frames and forwards decoded status to Dashboard IPC. The ECU's `0x300` receive
timeout is 250 ms, and its suggested `0x500` reporting period is 50 ms. The
Dashboard marks retained ECU status stale after 250 ms without a valid report.
The opt-in vcan integration test is described in
[bridge/tests/README.md](../bridge/tests/README.md); physical adapter/ECU
frame exchange and ECU validation remain pending; see the
[host CAN bring-up steps](hardware/hardware.md#host-can-bring-up). See the
[SocketCAN implementation notes](../bridge/src/can/README.md).

## Check The Receiver

CTest runs the runner and Dashboard socket integration checks, CAN signal/frame
encoding, SocketCAN conversion, `0x500` decoder validation, and (when Python 3
is available) Dashboard status mapping plus the real Python runner publisher
against the C++ bridge. These tests need neither MetaDrive nor CAN hardware.
The separate end-to-end vcan test is opt-in and needs a prepared CAN interface;
see [bridge/tests/README.md](../bridge/tests/README.md).

```bash
cmake -S bridge -B build/bridge
cmake --build build/bridge
ctest --test-dir build/bridge --output-on-failure
```

For a short run using the actual MetaDrive runner and C++ bridge processes, use
the optional live smoke test. It checks that valid MetaDrive scenes reach the
receiver; it does not require CAN hardware:

```bash
bash bridge/tests/runner_ipc_live_smoke.sh
```

To also run the standalone signal and DBC frame encoders against live runner
scenes, use the CAN frame smoke check. It logs representative CAN IDs, payload
bytes, and decoded signals, checks every batch with the generated C decoder,
then cross-checks every captured frame using cantools and `bridge/can/afs.dbc`:

```bash
bash bridge/scripts/run_can_frame_smoke.sh
```

The script uses the configured MetaDrive Python environment and expects
cantools to be importable there. Set `CANTOOLS_PYTHON` and
`CANTOOLS_PYTHONPATH` if cantools is installed in a different environment;
set `AFS_CAN_SMOKE_STEPS` to change the default 10 simulation steps. This is a
diagnostic smoke path and does not transmit on SocketCAN.

See [bridge/tests/README.md](../bridge/tests/README.md) for coverage and
[verification/testing.md](verification/testing.md) for the broader
verification plan.

## Run Python Tests

Run the simulation runner unit tests with the configured MetaDrive Python
environment when pytest is installed:

```bash
PYTHONPATH=simulation_runner/src \
simulation/metadrive/metadrive_venv/bin/python -m pytest simulation_runner/tests -v
```

The direct, dependency-free test procedure for environments without pytest is
in [verification/testing.md](verification/testing.md).

## Open And Validate The Development Viewer

Start System Visualization:

```bash
bash tools/system_visualization/start_system_visualization.sh
```

Open the printed URL. The default is
`http://127.0.0.1:8000/tools/system_visualization/`; pass a port number to the
script to change it. Press Ctrl+C to stop the server. The viewer requires
Python 3.

Check the generated source inventory, graph data, and viewer JavaScript:

```bash
python3 tools/system_visualization/code-graph/build_index.py --check
node tools/system_visualization/code-graph/validate.mjs
node --check tools/system_visualization/code-graph/graph-data.js
node --check tools/system_visualization/code-graph/code-index.js
node --check tools/system_visualization/code-graph/viewer.js
node --check tools/system_visualization/code-graph/functionality-data.js
node --check tools/system_visualization/code-graph/functionality-overlay.js
node --check tools/system_visualization/code-graph/validate.mjs
node --check tools/system_visualization/beam-visual/beam-model.js
node --check tools/system_visualization/beam-visual/beam-segments.js
node --check tools/system_visualization/hardware-wiring/hardware-wiring.js
node --check tools/system_visualization/shared/code-timestamp.js
node tools/system_visualization/tests/beam-model.test.cjs
node tools/system_visualization/tests/beam-segments.test.cjs
node tools/system_visualization/tests/code-timestamp.test.cjs
```

Run `python3 tools/system_visualization/code-graph/build_index.py` to regenerate the
source inventory after source files or indexed symbols change. The detailed
viewer instructions are in
[tools/system_visualization/README.md](../tools/system_visualization/README.md).

## Run The Local Dashboard

Open the native Dashboard window from the repository root:

```bash
bash dashboard/scripts/start_dashboard.sh
```

The window needs a graphical Linux session and uses no localhost port. Start
the bridge with `bash bridge/scripts/run_runner_bridge.sh` in another terminal.
Fresh runner ego fields and nearby vehicles appear when available; mode and power requests
reach the bridge. ECU values use simulated fallbacks until valid CAN status is received. See
the [Dashboard guide](../dashboard/README.md).

## Build The Zephyr Firmware

The STM32 application receives and validates the bridge CAN messages, reports
`0x500` status every 50 ms, and blinks the board's `led0` at 500 ms intervals.
It is built for Zephyr 3.7 and `black_f407ve`; see the
[firmware guide](../firmware/README.md) for workspace setup and SDK details.
From the repository root, with Zephyr SDK 0.16.8 installed locally:

```bash
bash firmware/scripts/build_firmware.sh --pristine
```

Use `bash firmware/scripts/build_firmware.sh --no-ccache` if the ccache
directory is not writable.

After the ST-Link is passed through to Linux and the board mapping is verified,
run `bash firmware/scripts/check_stlink.sh` to verify the four-wire SWD
connection and OpenOCD software-reset/halt sequence without flashing. Then
flash with `bash firmware/scripts/flash_firmware.sh`. Both wrappers use the
project-owned OpenOCD config, which supports SWD without a physical NRST wire.
Read the flashed image's diagnostic console with
`bash firmware/scripts/read_rtt.sh`; reset the board after the reader connects
to see startup messages. RTT needs only the existing SWD wires. Close the reader
before flashing or using GDB because OpenOCD owns the ST-Link while it runs.
See the [RTT setup guide](../firmware/docs/rtt_debugging.md) for prerequisites,
expected output, and connection errors.
The bridge forwards decoded ECU status through Dashboard IPC; the CAN frame
smoke script above checks DBC encoding without a CAN interface.
