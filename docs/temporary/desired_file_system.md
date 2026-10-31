# Target Project File System

This is a target directory sketch, not a complete source inventory. The
simulation code moved from the former all-Python `bridge/` into
`simulation_runner/`; the C++ bridge and Python Dashboard now have runtime
implementations. The firmware workspace and ECU CAN communication slice now
exist under `firmware/`; actuator and feedback layers remain planned. The root
`scripts/` directory uses shared `start.sh` and `check.sh` dispatchers with
focused helpers grouped under `boot_scripts/` and `check_scripts/`. See the
[working context](../../agents/working-context.md) for current status.

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
|-- scripts/                           # per-component and whole-host launchers
|   |-- start.sh                       # start system or component by argument
|   |-- check.sh                       # check dependencies/hardware by argument
|   |-- dialogue.md                   # scripts and selector documentation
|   |-- boot_scripts/                  # focused startup implementations
|   |-- check_scripts/                 # focused readiness implementations
|   `-- setup_system.sh                # project-local dependency setup
|-- tests/
|   `-- test_all.sh                    # full software regression suite
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
|   |   `-- ipc_adapter/             # implemented simulation-to-bridge client
|-- bridge/
|   |-- README.md
|   |-- CMakeLists.txt               # C++17 baseline
|   |-- can/
|   |   `-- afs.dbc                  # shared CAN signal dictionary
|   |-- include/afs_bridge/          # future public interfaces and value types
|   |-- src/
|   |   |-- app/                     # lifecycle and composition
|   |   |-- ipc/                     # Unix-socket server and messages
|   |   |-- state/                   # synchronized current snapshots
|   |   |-- can/                     # codec, scheduler, SocketCAN TX/RX
|   |   `-- diagnostics/             # freshness, health, and logging
|-- dashboard/
|   |-- README.md
|   |-- pyproject.toml
|   |-- src/afs_dashboard/
|   |   |-- app/                     # future UI composition
|   |   |-- gateway_client/          # future Unix-socket client
|   |   `-- models/                  # future UI-facing values
|-- firmware/                        # STM32F407VET6 Zephyr application (C)
|   |-- README.md                    # Zephyr setup, build, and flash instructions
|   |-- requirements.txt             # pinned west version
|   |-- .west/                       # ignored west workspace configuration
|   |-- zephyr/                      # ignored Zephyr v3.7.0 checkout
|   |-- modules/                     # ignored Zephyr-imported dependencies
|   |-- bootloader/mcuboot/          # ignored west project
|   |-- tools/edtt, net-tools/       # ignored west tools
|   |-- docs/
|   |   `-- hardware_check.md        # ST-Link and target bring-up checks
|   |-- scripts/
|   |   |-- build_firmware.sh        # Zephyr application build wrapper
|   |   |-- check_stlink.sh          # non-flashing OpenOCD probe
|   |   `-- flash_firmware.sh        # probe, then program with west
|   `-- afs_ecu/                     # application and local west manifest
|       |-- CMakeLists.txt           # Zephyr application build
|       |-- west.yml                 # manifest for Zephyr and its modules
|       |-- prj.conf                 # enabled software features
|       |-- boards/                  # overlay for the confirmed physical board
|       |-- include/afs/
|       |   |-- application/         # ECU app and controller APIs
|       |   |-- bsw/                 # CAN service and bus abstraction APIs
|       |   `-- rte/                 # typed inputs/status boundary
|       `-- src/
|           |-- main.c               # Zephyr startup entry point
|           |-- application/         # CAN loop, freshness controller, LED heartbeat
|           |-- rte/                 # typed input/status storage
|           `-- bsw/
|               |-- services/communication/ # CAN decoding and 0x500 packing
|               `-- ecu_abstraction/        # Zephyr CAN and GPIO adapters
|-- simulation/
|   `-- metadrive/                   # ignored upstream/local dependency
|-- contracts/
|   `-- ipc/                         # future Python/C++ message specification
|-- docs/
|-- tests/                           # all project-owned component and cross-component tests
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
| CAN signal packing, units, scaling, and enums | `bridge/can/afs.dbc` |
| Operator requests and presentation | `dashboard/` |
| Final lighting decision and hardware control | `firmware/` |
| Development helper implementations | `tools/` |

Do not place project code in the ignored `simulation/metadrive/` dependency. Add deeper implementation files only with their milestone instead of creating empty source trees in advance.
The firmware folders mirror AUTOSAR application, RTE, and BSW boundaries;
Zephyr supplies the kernel and STM32 peripheral drivers. The ECU CAN
communication/status slice builds for the upstream `black_f407ve` target and
the `led0` alias remains a 500 ms heartbeat. The earlier LED image was flashed
and the board LED was confirmed. Physical CAN verification and servo/matrix
drivers will be added with their milestones.
