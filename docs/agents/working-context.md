# Agent Working Context

Read this before changing docs, architecture, CAN, hardware, or future source files.
Also read [prompt-tracking.md](prompt-tracking.md) to see the latest 10 prompts and agent-side changes from recent sessions.

## Workspace

- Canonical clone: `Adaptive-Frontlighting-System/` on the Linux runtime machine.
- Mounted view example: `Z:\Adaptive-Frontlighting-System` on the main machine.
- Treat both paths as the same clone; do not create a second clone for normal work.
- Runtime commands belong in the Linux SSH session.
- `simulation/metadrive/` is a heavy ignored local simulator tree. Avoid broad searches there
  unless intentionally inspecting MetaDrive itself.

## Current Project Assumptions

- The project is an Adaptive Front-lighting System HIL prototype.
- The two main lighting behaviors are low-beam AFS swivel and high-beam ADB beam dodging.
- MetaDrive provides only the simulator data this project needs: ego steering, ego speed, and relevant surrounding-vehicle information.
- Dashboard provides requested headlight power, requested mode, and clear-fault command state to the CAN Bridge.
- The CAN Bridge is the only host-side CAN owner.
- The CAN Bridge publishes steering/speed signals for low-beam AFS, surrounding-object input for high-beam ADB, and dashboard command frames, not raw lidar arrays.
- The CAN Bridge receives `0x100 AFS_Status`, decodes it, stores local status state, and forwards it to the Dashboard.
- AFS ECU is the only physical ECU and owns final lighting behavior.
- Current embedded target is STM32F407VE.
- STM32 uses its built-in CAN TX/RX with an MCP2551 CAN transceiver.
- The headlight rig uses two horizontal feedback servos and LED beam zones.
- The hardware uses one servo PCA9685 board and one beam PCA9685 board per headlight.
- Cover and tilt servos are intentionally out of scope for the first build.
- The DBC will be the CAN source of truth once created.
- Docs are orientation material; detailed build specs come later.

## Read Order

1. [prompt-tracking.md](prompt-tracking.md)
2. [../README.md](../README.md)
3. [../architecture/overview.md](../architecture/overview.md)
4. [../architecture/components/metadrive.md](../architecture/components/metadrive.md)
5. [../architecture/data-flow.md](../architecture/data-flow.md)
6. [../architecture/components/headlights.md](../architecture/components/headlights.md)
7. [../can/README.md](../can/README.md)
8. [../architecture/components/can-bridge.md](../architecture/components/can-bridge.md)
9. Topic doc for the file being changed.

## Source Locations

| Topic | Source |
|---|---|
| Recent prompt/change history | [prompt-tracking.md](prompt-tracking.md) |
| System overview | [../architecture/overview.md](../architecture/overview.md) |
| MetaDrive | [../architecture/components/metadrive.md](../architecture/components/metadrive.md) |
| Data flow | [../architecture/data-flow.md](../architecture/data-flow.md) |
| AFS ECU | [../architecture/components/afs-ecu.md](../architecture/components/afs-ecu.md) |
| CAN Bridge | [../architecture/components/can-bridge.md](../architecture/components/can-bridge.md) |
| Headlights | [../architecture/components/headlights.md](../architecture/components/headlights.md) |
| Dashboard | [../architecture/components/dashboard.md](../architecture/components/dashboard.md) |
| CAN and message specs | [../can/README.md](../can/README.md) |
| Tools | [../tools/tools.md](../tools/tools.md) |
| Hardware | [../hardware/hardware.md](../hardware/hardware.md) |
| Hardware visual plan | [../hardware/visual.md](../hardware/visual.md) |
| Agent roadmap | [roadmap.md](roadmap.md) |
