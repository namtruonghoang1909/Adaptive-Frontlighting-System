# Target Project File System

The component-level structure below is now established. Implemented Python simulation code was moved from the former all-Python `bridge/` into `simulation_runner/`. The C++ bridge and Python Dashboard have organized scaffolds; their runtime behavior remains future work.

```text
Adaptive-Frontlighting-System/
|-- README.md
|-- AGENTS.md                          # auto-discovery pointer to agents/README.md
|-- agents/                            # main agent guide, context, history, and plans
|   |-- README.md                      # canonical working entry point
|   |-- rules/                         # category-specific instructions
|   |-- code_visualize.md             # code-map maintenance workflow
|   |-- working-context.md            # current handoff and resume point
|   |-- prompt-tracking.md            # recent context-changing requests
|   |-- roadmap.md                    # proposed order and open decisions
|   `-- plans/                         # component plans
|-- simulation_runner/
|   |-- README.md
|   |-- runner.md                     # requirements, scripts, arguments, run examples
|   |-- pyproject.toml
|   |-- assets/screenshots/           # captured simulation evidence
|   |-- scenarios/                    # future repeatable AFS/ADB cases
|   |-- scripts/                      # requirement checker and launcher
|   |-- src/
|   |   |-- metadrive_runner/       # implemented lifecycle, controls, CLI, scene store
|   |   |-- object_extraction/
|   |   |   |-- ego/                # implemented immutable ego extraction
|   |   |   |-- surrounding/        # implemented registry extraction
|   |   |   `-- scene.py            # matching ego/surrounding datatype
|   |   |-- scene_display/          # optional development browser observer
|   |   `-- ipc_adapter/             # planned simulation-to-bridge client
|   `-- tests/                       # implemented runner/control/extractor tests
|-- bridge/
|   |-- README.md
|   |-- CMakeLists.txt               # C++17 baseline
|   |-- include/afs_bridge/          # future public interfaces and value types
|   |-- src/
|   |   |-- app/                     # lifecycle and composition
|   |   |-- ipc/                     # Unix-socket server and messages
|   |   |-- state/                   # synchronized current snapshots
|   |   |-- can/                     # codec, scheduler, SocketCAN TX/RX
|   |   `-- diagnostics/             # freshness, health, and logging
|   `-- tests/                       # future native and Linux integration tests
|-- dashboard/
|   |-- README.md
|   |-- pyproject.toml
|   |-- src/afs_dashboard/
|   |   |-- app/                     # future UI composition
|   |   |-- gateway_client/          # future Unix-socket client
|   |   `-- models/                  # future UI-facing values
|   `-- tests/
|-- firmware/
|   `-- afs_ecu/                     # future STM32F407VE Embedded C firmware
|       |-- Core/                    # Cube-generated application code, if used
|       |-- Drivers/                 # HAL/CMSIS, if used
|       `-- afs/
|           |-- can/                 # CAN reception/transmission and validation
|           |-- control/             # mode logic, swivel, and ADB decisions
|           |-- diagnostics/         # stale inputs, feedback, and fault flags
|           |-- hardware/            # PWM, ADC, I2C, and board pins
|           `-- calibration/         # servo and LED-zone calibration
|-- simulation/
|   `-- metadrive/                   # ignored upstream/local dependency
|-- can/
|   `-- afs.dbc                      # future shared CAN signal dictionary
|-- contracts/
|   `-- ipc/                         # future Python/C++ message specification
|-- docs/
|-- tests/                           # cross-component SIL/HIL integration
|-- tools/                           # development helpers and detailed tool guidance
|   `-- system_visualization/        # interactive class interaction graph
|-- hardware/                        # wiring, parts, mechanics, and calibration
|-- logs/                            # ignored runtime evidence unless curated
`-- artifacts/                       # selected demo and verification evidence
```

## Ownership Rules

| Data or behavior | Owner |
|---|---|
| MetaDrive lifecycle and raw simulator state | `simulation_runner/` |
| Simulator-independent observations and IPC publishing | `simulation_runner/src/ipc_adapter/` |
| Local client IPC, current bridge state, and communication health | `bridge/` |
| CAN conversion, scheduling, and SocketCAN | `bridge/src/can/` |
| CAN signal packing, units, scaling, and enums | Future `can/afs.dbc` |
| Operator requests and presentation | `dashboard/` |
| Final lighting decision and hardware control | `firmware/afs_ecu/` |
| Development helper implementations | `tools/` |

Do not place project code in the ignored `simulation/metadrive/` dependency. Add deeper implementation files only with their milestone instead of creating empty source trees in advance.
