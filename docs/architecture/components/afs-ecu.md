# AFS ECU Component

The AFS ECU is the physical controller for the Adaptive Front-lighting System prototype. It
receives compact CAN inputs, decides the executed headlight behavior, drives the bench
hardware, and reports what actually happened.

The two main behaviors are low-beam AFS swivel and high-beam ADB beam dodging.

## Responsibilities

- Decode host-published CAN input frames.
- Check input freshness, validity flags, alive counters, and payload checksums where present.
- Choose the executed lighting state from the requested headlight power, requested mode, and available inputs.
- Drive the left/right swivel servos and both 8x8 headlight matrices. In low-beam swivel mode, only rows 5–8 shine while both servos follow steering. In high-beam modes, center both servos, keep rows 5–8 on, and enable rows 1–4 only after centered feedback is accepted.
- Read servo feedback and detect control-path or feedback faults.
- Enter a conservative safe output when required inputs or hardware paths are not trusted.
- Publish executed status, faults, feedback, and applied beam output on `0x500 AFS_Status`.

## Firmware Platform

The STM32 firmware uses Zephyr 3.7.0 with C application code on the
STM32F407VET6. The board is marked `STM32F4VE ver 36C SN:2024C`. The current
application in `firmware/afs_ecu/` uses Application, RTE-style, BSW service, and
ECU-abstraction layers. Its CAN communication slice receives and validates
`0x100`–`0x400`, checks alive counters and freshness, stores inputs behind the
RTE boundary, and reports `0x500` every 50 ms. The board LED continues as a
500 ms heartbeat. Zephyr's
[`black_f407ve` target](https://docs.zephyrproject.org/latest/boards/others/black_f407ve/doc/index.html)
matches this MCU and is the current candidate; Zephyr marks it as not actively
maintained. The CAN application builds for this target. The earlier LED image
was flashed over ST-Link, and the user confirmed the board LED blinks. The
current CAN image has not yet been flashed or exercised against a physical CAN
bus. Confirm peripheral header routing and pin assignments against the
schematic before connecting AFS hardware. The
[firmware guide](../../../firmware/README.md) has setup and build commands; the
[wiring draft](../../hardware/wiring-draft.md) records candidate pins and open
electrical checks.

Until SPI matrix and servo drivers are available, the ECU keeps its outputs in
`Safe_Default` and marks `BeamControlLost` and `ServoControlLost`. Its status
frame reports firmware state, not verified physical lamp output.

## Inputs Needed

| Input | Source | Used for |
|---|---|---|
| Requested headlight power, requested mode, command validity, and clear-fault request | `0x400 Dashboard_Command` | Turn headlights off/on, select requested behavior, and handle safe fault clearing |
| Steering angle and validity/freshness | `0x200 Vehicle_Steering` | 20 ms period; compute low-beam swivel target; 100 ms receive timeout |
| Vehicle speed and validity/freshness | `0x100 Vehicle_Speed` | 20 ms period; gate behavior and scale/smooth swivel response; 100 ms receive timeout |
| Grid validity/quality and one occupancy bit plus a cumulative four-bit subsector mask per sector | `0x300 Vehicle_Object` | 100 ms period; decide which calibrated high-beam matrix pixels to mask; clear grid after a 250 ms receive timeout (one frame may be missed) |
| Left/right servo feedback voltage | STM32 ADC inputs | Confirm physical swivel position |
| Hardware driver state | I2C/PWM/SPI driver checks | Detect servo or matrix control-path faults |

## Outputs

| Output | Destination | Used for |
|---|---|---|
| `0x500 AFS_Status` | C++ bridge CAN module; Dashboard and logs receive it through the Dashboard interface | Executed mode, health, faults, servo feedback, and applied logical-sector mask |
| Servo PWM commands | Servo PCA9685 board | Left/right low-beam swivel or centered high-beam target |
| Matrix pixel rows | Left/right MAX7219 8x8 modules over SPI | Low-beam base, high-beam extension, and ADB pixel masking |
| Safe fallback lighting | Headlight rig | Conservative visible output when behavior is not trusted |
| Fault indication, if added | Bench indicator hardware | Local hardware/debug feedback |

## Current Firmware Boundary

Implemented firmware modules are the Zephyr CAN bus abstraction, the CAN
message service, the RTE-style input/status store, and the application freshness
controller. The receive callback copies frames into a bounded queue; the
application thread decodes them and updates the RTE. Every 50 ms the application
checks freshness and sends a DBC-packed `0x500` status frame. CAN decode faults
and receive-queue overruns are latched until a rising clear-fault request. A
rejected known frame immediately invalidates its input; queue overruns
discard queued backlog and invalidate all four input categories until fresh
frames arrive. Clearing the diagnostic does not make invalidated inputs usable
again.

The application does not yet execute the requested light mode, command servo
targets, drive MAX7219 pixels, read ADC feedback, or confirm a physical safe
pattern. Those responsibilities remain in the target design above.

## Hardware Role

| Part | Role |
|---|---|
| STM32F407VET6 | Main controller target and owner of final lighting behavior |
| STM32 CAN TX/RX | Built-in CAN controller interface |
| MCP2551 CAN transceiver | Physical transceiver between STM32 CAN pins and CANH/CANL |
| Servo PCA9685 board | Shared 50 Hz PWM driver for left/right swivel servos |
| Left MAX7219 matrix module | 8x8 pixel output for left low and high beam |
| Right MAX7219 matrix module | 8x8 pixel output for right low and high beam |
| Matrix optics and supply | Beam shaping and 5 V power for the display modules |
| STM32 ADC inputs | Servo position feedback inputs |
| Headlight assemblies | Servo-swiveled matrix low/high-beam output |

## Hardware Fault Reporting

The ECU should report hardware/control-path problems on `0x500 AFS_Status`:

| Fault | Meaning |
|---|---|
| `ServoControlLost` | ECU cannot command the servo control path, including the servo PCA9685 or servo PWM output path |
| `ServoMismatch` | ECU can command the servo path, but measured feedback does not match the ECU target within tolerance |
| `BeamControlLost` | ECU cannot command one or both MAX7219 matrix modules over SPI |

## Ownership

The AFS ECU owns the final executed behavior. The Dashboard provides requested
state through the C++ bridge, and the bridge CAN module provides host-side
vehicle/object inputs, but the ECU decides whether those inputs are fresh
enough, which high-beam matrix pixels are switched off, and what fallback
output is used.
