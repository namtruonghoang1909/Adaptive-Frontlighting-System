# Project Workflow

This project is developed through an SSHFS-mounted view of a Linux clone. File edits may be
made from the mounted path, but runtime work happens in the Linux SSH session.

## Workspace Rule

- Canonical clone: `Adaptive-Frontlighting-System/` on the Linux runtime machine.
- Mounted view example: `Z:\Adaptive-Frontlighting-System` on the main machine.
- Do not create a second clone for normal work.
- Run MetaDrive, SocketCAN, Dashboard, MetaDrive CAN Bridge, CAN tests, and hardware commands in Linux.

## Runtime Shape

```text
Linux SSH session
  - MetaDrive
  - MetaDrive CAN Bridge
  - cantools DBC encoding
  - python-can SocketCAN transmit
  - Dashboard
  - SocketCAN vcan0 or can0
        |
        v
CAN adapter or virtual CAN
        |
        v
STM32F407VE AFS ECU and physical rig
```

## Typical Flow

1. Start the Linux CAN environment, using `vcan0` before hardware and `can0` with hardware.
2. Run the MetaDrive CAN Bridge in a synthetic-output mode first so known steering/speed/object signals appear on CAN.
3. Run MetaDrive and switch the MetaDrive CAN Bridge to simulator input when CAN encoding is proven.
4. Run the Dashboard so mode commands appear on CAN and status is visible.
5. Power the STM32F407VE ECU and physical rig when hardware testing is intended.
6. Watch status through the Dashboard, CAN logs, or SavvyCAN.
7. Stop host publishers before shutting down the hardware bench.

## Failure Expectation

If required steering or speed input disappears, the ECU should fall back to conservative
low-beam static behavior. If ADB object input is missing or stale, the ECU should disable
vehicle-shadow behavior and avoid glare-prone high-beam output. Exact timing and diagnostics
belong in future build work and the DBC.