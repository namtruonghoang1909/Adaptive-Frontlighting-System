# Headlights Component

The headlight rig is the visible output of the Adaptive Front-lighting System prototype. It has
two physical headlight assemblies: left and right. Each assembly is a servo-swiveled platform
with low-beam output and segmented high-beam LED zones.

This page combines the physical headlight structure and the intended visible behavior.

## What It Contains

```text
left headlight assembly                 right headlight assembly
+----------------------+                +----------------------+
| swivel platform      |                | swivel platform      |
|  + low-beam output   |                |  + low-beam output   |
|  + high-beam zones   |                |  + high-beam zones   |
|  + feedback servo    |                |  + feedback servo    |
+----------------------+                +----------------------+
```

| Component | Purpose |
|---|---|
| Swivel platform | Carries the visible light module and rotates horizontally |
| Feedback servo | Moves the platform and reports actual position to the STM32 ADC |
| Low-beam output | Demonstrates static and swivel low-beam behavior |
| High-beam LED zones | Demonstrates no-dimming high beam and ADB beam dodging |
| Mechanical mount | Holds the servo, light module, and wiring strain relief |

Cover and tilt servos are intentionally out of scope for the first build.

## Frontlight Modes

| Mode | Visible behavior |
|---|---|
| `Off` | Headlight output off or standby |
| `Safe_Default` | Servos centered if controllable; conservative low-beam output; glare-prone high beam off |
| `LowBeam_NoSwivel` | Low-beam output with both headlights centered |
| `LowBeam_Swivel` | Low-beam output moves left/right from steering and speed |
| `HighBeam_NoDimming` | High-beam zones stay bright; servos centered for the first build |
| `HighBeam_Dimming` | High-beam zones stay bright except for columns dimmed around detected vehicles; servos centered for the first build |

## Low-Beam AFS Swivel

Low-beam swivel uses steering and speed from MetaDrive. The ECU computes a bounded left/right
servo target and commands both headlight assemblies through the servo PCA9685 board.

Expected behavior:

- Steering left rotates the low-beam aim left.
- Steering right rotates the low-beam aim right.
- Speed can scale or smooth the swivel response during final calibration.
- Servo feedback lets the ECU detect mismatch or loss of control.

## High-Beam ADB Beam Dodging

High-beam beam dodging uses accepted surrounding-object input from `0x310 Vehicle_Object`. The ECU uses later-defined ADB logic, calibrated glare thresholds, and hysteresis to decide which beam columns are actually dimmed.

Expected behavior:

- With no relevant vehicle, high-beam zones remain bright in `HighBeam_Dimming`.
- With one relevant vehicle, the affected beam columns dim or turn off.
- With multiple relevant vehicles, the affected columns combine into one dimming pattern.
- Columns outside the affected area stay bright enough to show the high-beam benefit.

For the first build, ADB runs with centered servos so the LED-zone mapping is stable. Combining
swivel and ADB can be added later after the basic mechanisms are verified separately.

## Glare-Based Suppression Threshold

A high-beam column should be strongly dimmed or suppressed when a detected vehicle occupies
that logical column and the vehicle distance is inside the calculated glare range for that
column. The threshold should come from the light level that would reach the other driver's eye,
not from a guessed distance.

```text
E_eye_lux(column, distance) ~= I_column_cd / distance^2
d_threshold(column) = sqrt(I_column_cd / E_limit_lux)
```

`I_column_cd` is the measured or estimated luminous intensity of that LED column toward the
other driver. It can be estimated from a lux measurement at a known distance:

```text
I_column_cd ~= measured_lux * measurement_distance^2
```

For the prototype, use the threshold as a calibration value. Apply one-column margin and a
short fade/hysteresis so the beam does not flicker as the detected vehicle moves near a decision boundary or distance threshold.

## Logical Input And Physical Zones

`0x310 Vehicle_Object` provides surrounding-object input, and `AppliedDimZoneMask16` reports the ECU-applied dimming state. The first physical bench uses fourteen LED zones: seven on the left headlight and seven on the right headlight.

The ECU maps logical dimming decisions to physical LED channels through calibration. A CAN mask bit is a beam-column request, not necessarily a one-to-one physical LED channel. Detailed mapping, edge handling, and shadow margin belong in later implementation and hardware calibration docs once the LED modules are built.

## Control Paths

| Path | Hardware chain | Notes |
|---|---|---|
| Left/right swivel | STM32 I2C -> servo PCA9685 -> servo PWM -> feedback servos | One shared servo PCA9685 board controls both swivel servos |
| Left beam zones | STM32 I2C -> left beam PCA9685 -> LED driver/current limiting -> left LED zones | One beam PCA9685 board controls the left headlight zones |
| Right beam zones | STM32 I2C -> right beam PCA9685 -> LED driver/current limiting -> right LED zones | One beam PCA9685 board controls the right headlight zones |
| Servo feedback | Servo feedback wire -> STM32 ADC | Feedback is read by the ECU, not by the PCA9685 |

The PCA9685 boards provide PWM control. LED zones still need proper current limiting or driver
circuitry because the PCA9685 is not an LED power driver by itself.

## Status Observability

The Dashboard should be able to visualize the headlight state from decoded `0x100 AFS_Status` provided through the C++ bridge IPC interface:

| Status data | Meaning |
|---|---|
| `LeftServoFeedbackDeg` | Actual left platform rotation |
| `RightServoFeedbackDeg` | Actual right platform rotation |
| `AppliedDimZoneMask16` | Beam columns actually dimmed by the ECU |
| `ServoControlLost` | Servo control path is unavailable |
| `ServoMismatch` | Servo moved incorrectly or feedback disagrees with target |
| `BeamControlLost` | One or both beam-zone control paths are unavailable |
