# Adaptive Front-lighting System Docs

This folder gives guests, developers, and agents a brief orientation to the Adaptive
Front-lighting System prototype. The prototype has two lighting behaviors: low-beam AFS
swivel and high-beam ADB beam dodging.
It is not the build work specification. Detailed firmware, CAN Bridge, Dashboard, and test
build choices will be specified later when those parts are built.

The canonical project clone lives on the Linux runtime machine at
`Adaptive-Frontlighting-System/`. A main-machine path such as
`Z:\Adaptive-Frontlighting-System` is an SSHFS-mounted view of that same clone, not a second
checkout. MetaDrive, SocketCAN, Dashboard, CAN Bridge, CAN tests, and hardware-facing
workflows run from the Linux SSH session.

## Read First

1. [architecture/overview.md](architecture/overview.md) - whole-system overview.
2. [architecture/components/metadrive.md](architecture/components/metadrive.md) - simulator component role.
3. [architecture/data-flow.md](architecture/data-flow.md) - data needed from MetaDrive/Dashboard, CAN transfer, and ECU behavior.
4. [architecture/components/afs-ecu.md](architecture/components/afs-ecu.md) - physical ECU role.
5. [architecture/components/can-bridge.md](architecture/components/can-bridge.md) - host CAN Bridge role.
6. [architecture/components/dashboard.md](architecture/components/dashboard.md) - user/debug UI role.
7. [architecture/components/headlights.md](architecture/components/headlights.md) - headlight structure and AFS/ADB behavior.
8. [can/README.md](can/README.md) - CAN bus, DBC ownership, and current message specs.
9. [hardware/hardware.md](hardware/hardware.md) - bench hardware overview.
10. [hardware/visual.md](hardware/visual.md) - intended physical layout and wiring.
11. [tools/tools.md](tools/tools.md) - combined tools and environment notes.
12. [verification/testing.md](verification/testing.md) - verification approach.
13. [agents/working-context.md](agents/working-context.md) - Codex/agent operating context.

## System Snapshot

```text
Linux runtime over SSH

  MetaDrive -> CAN Bridge reads -> CAN bus -> AFS ECU
  Dashboard -> CAN Bridge reads -> CAN bus -> AFS ECU
  AFS ECU   -> CAN bus -> CAN Bridge reads -> Dashboard
```

MetaDrive provides simulator data. The Dashboard provides HMI command state and displays
status. The CAN Bridge owns SocketCAN, DBC encode/decode, message timing, and receive
filters. The STM32F407VE ECU performs the final lighting decision, reads servo feedback, and
commands the visible headlight rig.

## Documentation Map

| Document | Purpose |
|---|---|
| [architecture/overview.md](architecture/overview.md) | Brief system architecture |
| [architecture/components/metadrive.md](architecture/components/metadrive.md) | MetaDrive simulator component summary |
| [architecture/data-flow.md](architecture/data-flow.md) | End-to-end data ownership and signal flow |
| [architecture/components/afs-ecu.md](architecture/components/afs-ecu.md) | AFS ECU component summary |
| [architecture/components/can-bridge.md](architecture/components/can-bridge.md) | CAN Bridge component summary |
| [architecture/components/dashboard.md](architecture/components/dashboard.md) | Dashboard component summary |
| [architecture/components/headlights.md](architecture/components/headlights.md) | Headlight structure and AFS/ADB behavior |
| [can/README.md](can/README.md) | CAN bus, DBC orientation, and message-spec index |
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
| CAN Bridge | Not present yet |
| Vendored MetaDrive | Local ignored tree under `simulation/metadrive/` |
| Hardware rig | Planned |

## Documentation Rules

- Keep architecture files short and explanatory.
- Keep CAN details under [can/](can/README.md); the DBC is the contract once created.
- Keep agent planning under [agents/](agents/).
- Do not add build skeletons to docs unless the project explicitly asks for them.