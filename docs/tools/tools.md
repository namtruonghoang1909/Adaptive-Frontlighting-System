# Tools and Environment

This single file covers the project tools and where they run.

## Runtime Rule

The project runtime is Linux. The only canonical clone is on the Linux machine at
`Adaptive-Frontlighting-System/`. A path like `Z:\Adaptive-Frontlighting-System` is an SSHFS
view for editing.

Run these from the Linux SSH session:

- MetaDrive.
- MetaDrive CAN Bridge.
- Dashboard.
- SocketCAN, `vcan0`, and `can0`.
- `python-can`, `cantools`, `candump`, and `cansend`.
- CAN tests and hardware-facing commands.

## Tool Summary

| Area | Tool | Why it is used |
|---|---|---|
| Runtime OS | Linux VM or Linux host over SSH | SocketCAN and simulator runtime |
| Simulation | MetaDrive | Raw ego state and surrounding-vehicle source |
| Bridge language | Python | Reads MetaDrive and publishes CAN signals |
| CAN API | `python-can` | Host-side CAN send/receive over SocketCAN |
| DBC handling | `cantools` | Encode/decode shared DBC messages |
| CAN stack | SocketCAN | `vcan0` for virtual tests and `can0` for hardware |
| CAN monitor | SavvyCAN or `candump` | Inspect bus traffic |
| Dashboard UI | Python UI toolkit, exact choice later | User mode selection and status display |
| Embedded target | STM32F407VE | Physical AFS/ADB ECU |
| CAN transceiver | 3.3 V logic CAN transceiver | STM32 CAN TX/RX to CANH/CANL physical bus |
| Servo driver | PCA9685 | 50 Hz PWM outputs for two feedback servos |
| LED zone driver | Separate LED PWM or constant-current driver boards | Independent brightness for ADB zones |
| Hardware debug | Logic analyzer, multimeter, ST-Link | Electrical and board bring-up |

## MCU Note

The STM32F407VE is the current target for the physical ECU. The STM32F103C6 Blue Pill is
acceptable for small experiments, but it is not the preferred final ECU for this project.

## Bridge Note

The MetaDrive CAN Bridge should use `cantools` to encode DBC signal dictionaries and `python-can` to
send frames. `cantools` does not transmit onto CAN by itself.

## DBC

The DBC is expected to live at `can/afs.dbc` once created. Dashboard, MetaDrive CAN Bridge, firmware,
SavvyCAN, and tests should all use that same file.