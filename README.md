# Adaptive Front-lighting System

Bench-scale Adaptive Front-lighting System prototype with two lighting behaviors:
low-beam AFS swivel and high-beam ADB beam dodging.

The project is planned as a hardware-in-the-loop system. A Linux runtime runs MetaDrive,
Dashboard, CAN Bridge, and host-side CAN tools. A physical STM32F407VE AFS ECU receives
compact CAN signals, decides the final lighting behavior, and drives the headlight rig.

## System Shape

```text
MetaDrive -> CAN Bridge reads -> CAN bus -> STM32F407VE AFS ECU
Dashboard -> CAN Bridge reads -> CAN bus -> STM32F407VE AFS ECU
STM32F407VE AFS ECU -> CAN bus -> CAN Bridge reads -> Dashboard
```

The CAN Bridge is the host-side bus owner. It reads MetaDrive data and Dashboard command
state, publishes `0x200`, `0x300`, `0x310`, and `0x400`, receives `0x100`, and forwards
decoded ECU status to the Dashboard.

The Dashboard is the HMI. It lets the user request headlight power/mode and clear faults,
then displays decoded status for observation. It does not pack CAN frames or own SocketCAN.

## Documentation

Start with [docs/README.md](docs/README.md). It links the architecture, CAN, hardware, tools, and verification notes.

Key docs:

- [docs/architecture/overview.md](docs/architecture/overview.md) - system architecture.
- [docs/architecture/data-flow.md](docs/architecture/data-flow.md) - host-to-ECU data flow.
- [docs/architecture/components/metadrive.md](docs/architecture/components/metadrive.md) - simulator component role.
- [docs/architecture/components/can-bridge.md](docs/architecture/components/can-bridge.md) - host CAN Bridge role and tools.
- [docs/architecture/components/dashboard.md](docs/architecture/components/dashboard.md) - Dashboard command/status UI role and design.
- [docs/architecture/components/headlights.md](docs/architecture/components/headlights.md) - headlight structure and AFS/ADB behavior.
- [docs/can/README.md](docs/can/README.md) - CAN bus summary and message specs.
- [docs/hardware/hardware.md](docs/hardware/hardware.md) - bench hardware overview.

## Current Status

The repository is in the orientation and planning phase.

| Area | Status |
|---|---|
| Documentation | Orientation scaffold in progress |
| DBC | Planned as `can/afs.dbc` |
| CAN Bridge | Not present yet |
| Dashboard | Not present yet |
| STM32 firmware | Not present yet |
| Hardware rig | Planned |

## Runtime Note

The canonical clone lives on the Linux runtime machine. A Windows path such as
`Z:\Adaptive-Frontlighting-System` is an SSHFS-mounted view of the same checkout. Runtime
work for MetaDrive, SocketCAN, CAN Bridge, Dashboard, and hardware-facing tools belongs in
the Linux SSH session.