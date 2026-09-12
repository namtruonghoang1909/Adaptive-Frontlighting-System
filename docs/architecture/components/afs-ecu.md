# AFS ECU Component

The AFS ECU is the physical controller for the Adaptive Front-lighting System prototype. It
receives compact CAN inputs, decides the executed headlight behavior, drives the bench
hardware, and reports what actually happened.

The two main behaviors are low-beam AFS swivel and high-beam ADB beam dodging.

## Responsibilities

- Decode host-published CAN input frames.
- Check input freshness, validity flags, alive counters, and payload checksums where present.
- Choose the executed lighting state from the requested headlight power, requested mode, and available inputs.
- Drive the left/right swivel servos and high-beam LED zones.
- Read servo feedback and detect control-path or feedback faults.
- Enter a conservative safe output when required inputs or hardware paths are not trusted.
- Publish executed status, faults, feedback, and applied beam output on `0x100 AFS_Status`.

## Inputs Needed

| Input | Source | Used for |
|---|---|---|
| Requested headlight power, requested mode, command validity, and clear-fault request | `0x400 Dashboard_Command` | Turn headlights off/on, select requested behavior, and handle safe fault clearing |
| Steering angle, steering rate, validity, freshness | `0x200 Vehicle_Steering` | Compute low-beam swivel target |
| Vehicle speed, acceleration, validity, freshness | `0x300 Vehicle_Speed` | Gate behavior and scale/smooth swivel response |
| Object-grid validity, sector group, grid sample counter, and nearest vehicle distance per sector | `0x310 Vehicle_Object` | Decide high-beam ADB beam-zone dimming from calibrated glare thresholds |
| Left/right servo feedback voltage | STM32 ADC inputs | Confirm physical swivel position |
| Hardware driver state | I2C/PWM/driver checks | Detect servo or beam control-path faults |

## Outputs

| Output | Destination | Used for |
|---|---|---|
| `0x100 AFS_Status` | C++ bridge CAN module; Dashboard and logs receive it through the Dashboard interface | Executed mode, health, faults, servo feedback, and applied dim mask |
| Servo PWM commands | Servo PCA9685 board | Left/right horizontal low-beam swivel |
| LED-zone PWM commands | Left/right beam PCA9685 boards and LED driver stages | High-beam output and ADB dimming |
| Safe fallback lighting | Headlight rig | Conservative visible output when behavior is not trusted |
| Fault indication, if added | Bench indicator hardware | Local hardware/debug feedback |

## Hardware Role

| Part | Role |
|---|---|
| STM32F407VE | Main controller target and owner of final lighting behavior |
| STM32 CAN TX/RX | Built-in CAN controller interface |
| MCP2551 CAN transceiver | Physical transceiver between STM32 CAN pins and CANH/CANL |
| Servo PCA9685 board | Shared 50 Hz PWM driver for left/right swivel servos |
| Left beam PCA9685 board | PWM control for left headlight LED beam zones |
| Right beam PCA9685 board | PWM control for right headlight LED beam zones |
| LED current limiting / driver stages | Electrical protection and current handling for LED zones after PWM control |
| STM32 ADC inputs | Servo position feedback inputs |
| Headlight assemblies | Servo-swiveled LED-zone lighting output |

## Hardware Fault Reporting

The ECU should report hardware/control-path problems on `0x100 AFS_Status`:

| Fault | Meaning |
|---|---|
| `ServoControlLost` | ECU cannot command the servo control path, including the servo PCA9685 or servo PWM output path |
| `ServoMismatch` | ECU can command the servo path, but measured feedback does not match the ECU target within tolerance |
| `BeamControlLost` | ECU cannot command one or both beam control paths, including left/right beam PCA9685 boards or LED-zone output path |

## Ownership

The AFS ECU owns the final executed behavior. The Dashboard provides requested state through the C++ bridge, and the bridge CAN module provides host-side vehicle/object inputs, but the ECU decides whether those inputs are
fresh enough, which zones are actually dimmed, and what fallback output
is used.
