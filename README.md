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

See [the architecture flowchart](docs/architecture/overview.md#system-at-a-glance) and [gateway thread diagram](docs/architecture/data-flow.md#inside-the-gateway).

## Components

| Directory | Responsibility | Current status |
|---|---|---|
| `simulation_runner/` | Python MetaDrive lifecycle, controls, extraction, and future IPC publishing | Runner, controls, and ego extractor implemented; IPC and surrounding extraction planned |
| `bridge/` | C++17/CMake IPC and CAN gateway | Organized module scaffold; runtime not implemented |
| `dashboard/` | Python operator commands and system display through bridge IPC | Organized package scaffold; UI not implemented |
| `firmware/` | STM32 Embedded C AFS/ADB control and hardware drivers | Not implemented |
| `simulation/metadrive/` | Local ignored MetaDrive dependency | Runtime dependency, not project-owned source |
| `docs/` | Architecture, CAN, hardware, verification, and agent context | Active design documentation |

## Run The Implemented Simulation

Runtime commands require Linux and are run from the repository root:

```bash
bash simulation_runner/scripts/check_metadrive.sh
bash simulation_runner/scripts/start_metadrive_simulation.sh
```

Run the dependency-free Python tests with the configured MetaDrive environment:

```bash
PYTHONPATH=simulation_runner/src \
simulation/metadrive/metadrive_venv/bin/python -m pytest simulation_runner/tests -v
```

## Documentation

Start with [docs/README.md](docs/README.md). CAN signal layouts remain provisional until `can/afs.dbc` is created. `vcan0` will support host integration tests; physical HIL will use `can0`, the CAN adapter/transceiver path, STM32, and the headlight rig.
