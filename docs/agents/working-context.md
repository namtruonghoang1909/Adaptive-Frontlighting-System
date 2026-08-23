# Agent Working Context

Read this before changing docs, architecture, CAN, hardware, or future source files.

## Workspace

- Canonical clone: `Adaptive-Frontlighting-System/` on the Linux runtime machine.
- Mounted view example: `Z:\Adaptive-Frontlighting-System` on the main machine.
- Treat both paths as the same clone; do not create a second clone for normal work.
- Runtime commands belong in the Linux SSH session.
- `simulation/metadrive/` is a heavy ignored local simulator tree. Avoid broad searches there
  unless intentionally inspecting MetaDrive itself.

## Current Project Assumptions

- The project is an AFS/ADB HIL prototype.
- MetaDrive provides raw ego state and surrounding-vehicle information.
- The MetaDrive CAN Bridge publishes compact CAN signals using `cantools` and `python-can`.
- The MetaDrive CAN Bridge publishes object-level signals, not raw lidar arrays.
- Dashboard provides requested headlight mode.
- AFS ECU is the only physical ECU and owns final lighting behavior.
- Current embedded target is STM32F407VE.
- STM32 uses its built-in CAN TX/RX with a 3.3 V logic CAN transceiver.
- The headlight rig uses two horizontal feedback servos and LED beam zones.
- Cover and tilt servos are intentionally out of scope for the first build.
- The DBC will be the CAN source of truth once created.
- Docs are orientation material; detailed build specs come later.

## Read Order

1. [../README.md](../README.md)
2. [../architecture/overview.md](../architecture/overview.md)
3. [../architecture/data-pipeline.md](../architecture/data-pipeline.md)
4. [../architecture/workflow.md](../architecture/workflow.md)
5. [../can/overview.md](../can/overview.md)
6. [../can/messages.md](../can/messages.md)
7. Topic doc for the file being changed.

## Source Locations

| Topic | Source |
|---|---|
| System overview | [../architecture/overview.md](../architecture/overview.md) |
| Data pipeline | [../architecture/data-pipeline.md](../architecture/data-pipeline.md) |
| Runtime workflow | [../architecture/workflow.md](../architecture/workflow.md) |
| AFS ECU | [../architecture/components/afs-ecu.md](../architecture/components/afs-ecu.md) |
| Dashboard | [../architecture/components/dashboard.md](../architecture/components/dashboard.md) |
| Control behavior | [../architecture/control-law.md](../architecture/control-law.md) |
| CAN and DBC | [../can/overview.md](../can/overview.md) |
| CAN messages | [../can/messages.md](../can/messages.md) |
| Tools | [../tools/tools.md](../tools/tools.md) |
| Hardware | [../hardware/hardware.md](../hardware/hardware.md) |
| Hardware visual plan | [../hardware/visual.md](../hardware/visual.md) |
| Agent roadmap | [roadmap.md](roadmap.md) |