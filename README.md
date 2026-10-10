# Adaptive Front-lighting System

Bench-scale Adaptive Front-lighting System prototype with low-beam swivel and high-beam adaptive dimming. A Linux host runs the simulation, native communication bridge, and Dashboard; a physical STM32F407VE remains the AFS controller under test.

## System Shape

```text
Python simulation_runner                 Python dashboard
MetaDrive + extraction + IPC adapter          |
                  |                            |
                  +------ Unix socket IPC -----+
                               |
                               v
                     C++17 bridge / gateway
                     IPC + state + SocketCAN
                               |
                          CAN bus / can0
                               |
                               v
                       STM32 AFS ECU (C)
                               |
                               v
                         headlight rig
```

The C++ bridge is the only production host owner of project CAN traffic. The Dashboard sends requests and displays bridge/ECU status through IPC. STM32 validates inputs, decides the executed AFS/ADB behavior, drives the hardware, supervises feedback, and applies safe fallback.

Read the [architecture flowchart](docs/architecture/overview.md#system-at-a-glance) and [gateway thread diagram](docs/architecture/data-flow.md#inside-the-gateway) for the target system design. The interactive Code graph below shows what is implemented in the repository.

## Components

| Directory | Responsibility | Current status |
|---|---|---|
| `simulation_runner/` | Python MetaDrive lifecycle, controls, extraction, latest-scene storage, development display, and future IPC publishing | Runner, extraction, in-process scene interface, and optional browser observer implemented; IPC planned |
| `bridge/` | C++17/CMake IPC and CAN gateway | Organized module scaffold; runtime not implemented |
| `dashboard/` | Python operator commands and system display through bridge IPC | Organized package scaffold; UI not implemented |
| `firmware/` | STM32 Embedded C AFS/ADB control and hardware drivers | Not implemented |
| `simulation/metadrive/` | Local ignored MetaDrive dependency | Runtime dependency, not project-owned source |
| `tools/` | Repository-owned development helpers | Interactive Code graph implemented |
| `docs/` | Architecture, CAN, hardware, tools, and verification | Active design documentation |
| `agents/` | Repository agent rules, working context, and plans | Active guidance |

## Explore The Code Graph

Run the development viewer from the repository root:

```bash
bash tools/system_visualization/start_code_graph.sh
```

Open the printed address (default
`http://127.0.0.1:8000/tools/system_visualization/`). The
[Code graph guide](tools/system_visualization/README.md) explains its class
and function nodes, path-oriented placement, layer filters, expandable members,
and the right-side **Functionalities** list. Source files are links in node
details, not graph nodes. Selecting a functionality lights up its ordered call
and data path, including ego extraction, surrounding extraction, and scene
publication.
The map opens at a readable zoom; use **Fit** for the whole-map overview.

The CAN bridge, Dashboard, and firmware appear as planned layers without
invented runtime classes. This viewer is a development aid, separate from the
simulation's live scene display and the planned Dashboard.

After implementing or fixing code, regenerate the source inventory and update
affected class interactions and functionality paths in the same task. Follow the
[Code graph maintenance rules](agents/code_visualize.md); regenerating the
inventory alone does not document behavior changes.

## Run The Implemented Simulation

Runtime commands require Linux and are run from the repository root:

```bash
bash simulation_runner/scripts/check_simulation_requirements.sh --rendered --scene-display
bash simulation_runner/scripts/start_metadrive_simulation.sh --scene-display
```

See [simulation_runner/runner.md](simulation_runner/runner.md) for requirements, scripts, runner arguments, and run examples.

Run the Python tests with the configured MetaDrive environment when pytest is installed:

```bash
PYTHONPATH=simulation_runner/src \
simulation/metadrive/metadrive_venv/bin/python -m pytest simulation_runner/tests -v
```

If pytest is absent, use the dependency-free direct runner in [docs/verification/testing.md](docs/verification/testing.md).

## Documentation

Start with [docs/README.md](docs/README.md). CAN signal layouts remain provisional until `can/afs.dbc` is created. `vcan0` will support host integration tests; physical HIL will use `can0`, the CAN adapter/transceiver path, STM32, and the headlight rig.

Agent work starts with the [root agent guide](agents/README.md).
