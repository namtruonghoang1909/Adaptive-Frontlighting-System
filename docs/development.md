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
| `tools/system_visualization/start_system_visualization.sh` | System Visualization | Serves the Code graph, static System in Action page, and High beam visual / Low beam visual tabs on localhost. |

The scripts under `simulation_runner/scripts/` use
`simulation/metadrive/metadrive_venv/bin/python` by default. Set
`METADRIVE_PYTHON=/path/to/python` to use another environment. The bridge
launcher uses `build/bridge` and a `Release` CMake build by default; override
these with `AFS_BRIDGE_BUILD_DIR` and `AFS_BRIDGE_BUILD_TYPE`.

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

## Check The Receiver

CTest runs the C++ receiver protocol cases and, when Python 3 is available, a
process-level check that runs the real Python publisher against the C++ bridge
with synthetic scenes. Together they cover accepted data, reconnects, socket
permissions, competing publishers, and invalid or stale messages. They do not
require MetaDrive or CAN hardware.

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
node --check tools/system_visualization/shared/code-timestamp.js
node tools/system_visualization/tests/beam-model.test.cjs
node tools/system_visualization/tests/beam-segments.test.cjs
node tools/system_visualization/tests/code-timestamp.test.cjs
```

Run `python3 tools/system_visualization/code-graph/build_index.py` to regenerate the
source inventory after source files or indexed symbols change. The detailed
viewer instructions are in
[tools/system_visualization/README.md](../tools/system_visualization/README.md).

## Components Without A Runnable Entry Point

`dashboard/` is currently a package scaffold, and `firmware/` does not yet
have an implemented application. The bridge can validate/project runner data
and pack DBC-generated in-memory CAN frames; the diagnostic smoke script above
checks this path without SocketCAN. Production CAN scheduling and transmission
are not implemented. Dashboard and firmware do not have launch scripts yet.
