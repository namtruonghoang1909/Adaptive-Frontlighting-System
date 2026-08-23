# AFS ECU Component

The AFS ECU is the physical controller for the prototype. It receives CAN inputs, decides the
executed headlight behavior, and commands the headlight rig.

## Responsibilities

- Receive vehicle steering from CAN `0x200`.
- Receive vehicle speed from CAN `0x300`.
- Receive processed vehicle/object input for ADB from CAN `0x310`.
- Receive Dashboard mode requests from CAN `0x400`.
- Publish executed status on CAN `0x100`.
- Execute low-beam AFS swivel and high-beam ADB zone dimming.
- Drive two horizontal feedback servos.
- Drive the segmented LED zones for both headlights.
- Read servo position feedback and compare commanded position with measured position.
- Detect stale CAN input, actuator mismatch, and unsafe mode conditions.
- Drive any fault indication added to the bench rig.

## Hardware Role

| Part | Role |
|---|---|
| STM32F407VE | Main controller target |
| STM32 CAN TX/RX | Built-in CAN controller interface |
| 3.3 V logic CAN transceiver | Physical transceiver between STM32 CAN pins and CANH/CANL |
| PCA9685 servo board | 50 Hz PWM driver for left/right swivel servos |
| Separate LED PWM or LED driver boards | Independent brightness control for LED beam zones |
| STM32 ADC inputs | Servo position feedback inputs |
| Headlight assemblies | Servo-swiveled LED-zone lighting output |

## MCU Needs

The STM32F407VE should receive compact CAN signals, not raw simulator output:

| Needed by MCU | Source |
|---|---|
| Steering angle and alive/freshness | `Vehicle_Steering` |
| Vehicle speed and alive/freshness | `Vehicle_Speed` |
| Object valid, angle, distance, and optional type | `Vehicle_Object` |
| Requested mode | `Dashboard_Command` |
| Servo feedback voltage | ADC input from each feedback servo |

## Boundary

The ECU owns the final executed behavior. The Dashboard only requests modes, and the MetaDrive CAN Bridge
only provides simulated vehicle/object inputs. The MetaDrive CAN Bridge may extract object angle and
distance from MetaDrive, but the AFS ECU decides whether ADB is allowed, which LED zones are
dimmed, and what safe fallback is used.