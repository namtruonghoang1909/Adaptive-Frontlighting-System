# Adaptive Front-lighting System Docs

This folder gives guests, developers, and agents a brief orientation to the Adaptive
Front-lighting System (AFS) and Adaptive Driving Beam (ADB) hardware-in-the-loop prototype.
It is not the build work specification. Detailed firmware, MetaDrive CAN Bridge, Dashboard, and test build
choices will be specified later when those parts are built.

The canonical project clone lives on the Linux runtime machine at
`Adaptive-Frontlighting-System/`. A main-machine path such as
`Z:\Adaptive-Frontlighting-System` is an SSHFS-mounted view of that same clone, not a second
checkout. MetaDrive, SocketCAN, Dashboard, MetaDrive CAN Bridge, CAN tests, and hardware-facing workflows
run from the Linux SSH session.

## Read First

1. [architecture/overview.md](architecture/overview.md) - whole-system overview.
2. [architecture/data-pipeline.md](architecture/data-pipeline.md) - MetaDrive outputs, CAN bridge processing, CAN transfer, and MCU needs.
3. [architecture/workflow.md](architecture/workflow.md) - how the runtime pieces fit together.
4. [architecture/components/afs-ecu.md](architecture/components/afs-ecu.md) - physical ECU role.
5. [architecture/components/dashboard.md](architecture/components/dashboard.md) - user/debug UI role.
6. [architecture/control-law.md](architecture/control-law.md) - brief AFS and ADB behavior.
7. [can/overview.md](can/overview.md) - CAN bus and DBC ownership.
8. [can/messages.md](can/messages.md) - current CAN message list.
9. [simulation/metadrive-can-bridge.md](simulation/metadrive-can-bridge.md) - simulator-to-CAN bridge role.
10. [hardware/hardware.md](hardware/hardware.md) - bench hardware overview.
11. [hardware/visual.md](hardware/visual.md) - intended physical layout and wiring.
12. [tools/tools.md](tools/tools.md) - combined tools and environment notes.
13. [verification/testing.md](verification/testing.md) - verification approach.
14. [agents/working-context.md](agents/working-context.md) - Codex/agent operating context.

## System Snapshot

```text
Linux runtime over SSH
  MetaDrive simulation ----> MetaDrive CAN Bridge --------+
       raw ego state          extraction + filtering         |
       lidar/object info      cantools encode + python-can   |
                                                            |
  Dashboard mode UI ----------------------------------------+--> SocketCAN / CAN adapter
                                                                 |
                                                                 v
                                                        AFS ECU on STM32F407VE
                                                        - built-in CAN TX/RX
                                                        - 3.3 V logic CAN transceiver
                                                        - PCA9685 servo driver
                                                        - separate LED zone drivers
                                                        - two servo-swiveled headlight modules
```

The core project chain is MetaDrive Simulation, MetaDrive CAN Bridge, and STM32F407VE ECU Firmware. The AFS ECU is the only physical ECU in the current build. MetaDrive provides raw simulator state. The MetaDrive CAN Bridge converts that state into compact CAN signals. The Dashboard provides the requested headlight mode. The STM32F407VE ECU performs the final lighting decision, reads servo feedback, and commands the visible headlight rig.

## Documentation Map

| Document | Purpose |
|---|---|
| [architecture/overview.md](architecture/overview.md) | Brief system architecture |
| [architecture/data-pipeline.md](architecture/data-pipeline.md) | End-to-end data ownership and signal flow |
| [architecture/workflow.md](architecture/workflow.md) | Runtime workflow and workspace assumptions |
| [architecture/components/afs-ecu.md](architecture/components/afs-ecu.md) | AFS ECU component summary |
| [architecture/components/dashboard.md](architecture/components/dashboard.md) | Dashboard component summary |
| [architecture/control-law.md](architecture/control-law.md) | Mode behavior summary |
| [can/README.md](can/README.md) | CAN docs index |
| [can/overview.md](can/overview.md) | CAN and DBC orientation |
| [can/messages.md](can/messages.md) | CAN message list |
| [simulation/metadrive-can-bridge.md](simulation/metadrive-can-bridge.md) | MetaDrive CAN Bridge orientation |
| [hardware/hardware.md](hardware/hardware.md) | Hardware overview |
| [hardware/visual.md](hardware/visual.md) | Intended physical layout and wiring |
| [tools/tools.md](tools/tools.md) | Tools and runtime environment |
| [verification/testing.md](verification/testing.md) | Verification overview |
| [temporary/desired_file_system.md](temporary/desired_file_system.md) | Temporary target repository layout |
| [agents/working-context.md](agents/working-context.md) | Agent context |
| [agents/roadmap.md](agents/roadmap.md) | Agent-facing roadmap notes |

## Current Status

| Area | Status |
|---|---|
| Documentation | Orientation scaffold |
| DBC | Planned; expected as `can/afs.dbc` |
| AFS/ADB firmware | Not present yet |
| Dashboard | Not present yet |
| MetaDrive CAN Bridge | Not present yet |
| Vendored MetaDrive | Local ignored tree under `simulation/metadrive/` |
| Hardware rig | Planned |

## Documentation Rules

- Keep architecture files short and explanatory.
- Keep CAN details under [can/](can/README.md); the DBC is the contract once created.
- Keep agent planning under [agents/](agents/).
- Do not add build skeletons to docs unless the project explicitly asks for them.