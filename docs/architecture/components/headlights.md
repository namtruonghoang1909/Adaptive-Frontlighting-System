# Headlights Component

The headlight rig is the visible output of the Adaptive Front-lighting System prototype. It has
two physical headlight assemblies: left and right. Each assembly is a servo-swiveled platform
with one proposed 8x8 LED matrix for both low and high beam. Matrix rows 1–4
form the high-beam extension; rows 5–8 form the low-beam base.

This page combines the physical headlight structure and the intended visible behavior.

## What It Contains

```text
left headlight assembly                 right headlight assembly
+----------------------+                +----------------------+
| swivel platform      |                | swivel platform      |
|  + 8x8 LED matrix    |                |  + 8x8 LED matrix    |
|  + feedback servo    |                |  + feedback servo    |
+----------------------+                +----------------------+
```

| Component | Purpose |
|---|---|
| Swivel platform | Carries the visible light module and rotates horizontally |
| Feedback servo | Moves the platform and reports actual position to the STM32 ADC |
| 8x8 LED matrix | Lower four rows provide low beam; upper four add high beam and ADB masking |
| Mechanical mount | Holds the servo, light module, and wiring strain relief |

Cover and tilt servos are intentionally out of scope for the first build.

## Frontlight Modes

| Mode | Visible behavior |
|---|---|
| `Off` | Headlight output off or standby |
| `Safe_Default` | Servos centered if controllable; conservative low-beam output; glare-prone high beam off |
| `LowBeam_NoSwivel` | Rows 1–4 off, rows 5–8 on, both platforms centered |
| `LowBeam_Swivel` | Rows 1–4 off, rows 5–8 on, both platforms follow steering |
| `HighBeam_NoDimming` | Rows 5–8 stay on, all rows 1–4 turn on, both platforms centered |
| `HighBeam_Dimming` | Rows 5–8 stay on, affected pixels in rows 1–4 switch off, both platforms centered |

## Low-Beam AFS Swivel

Low-beam swivel uses steering and speed from MetaDrive. The ECU computes bounded,
independent left and right servo targets and commands each headlight assembly
through the servo PCA9685 board. The swivel applies to the entire matrix
platform while only rows 5–8 are lit.
The visual preview uses a short 40 m reach, ±18° half-angle, and ±6° maximum
outside-matrix swivel; these are provisional drawing values. Its low-beam
dashboard provides a steering wheel control and speed bar while keeping the
car stationary. The outside-matrix preview target is
`(wheel angle / 90°) × 6° × (1 − 0.75 × speed / 120)` for clamped ±90° wheel
input and 0–120 km/h speed. The inside matrix turns one third as far. On a left turn,
the left matrix is inside and swivels less than the right; right turns mirror
this. The outside/inside angles at full wheel input are 6°/2° at 0 km/h,
3.75°/1.25° at 60 km/h, and 1.5°/0.5° at 120 km/h. This rule illustrates why
steering and speed belong in the ECU swivel decision; firmware gains and limits
still require servo and road calibration.

Expected behavior:

- Steering left rotates the low-beam aim left.
- Steering right rotates the low-beam aim right.
- The outside matrix turns farther than the inside matrix; this difference
  mirrors when the steering direction changes.
- Speed should scale or smooth the swivel response during final calibration.
- Servo feedback lets the ECU detect mismatch or loss of control.

## High-Beam ADB Beam Dodging

High-beam beam dodging uses accepted surrounding-object input from `0x310 Vehicle_Object`. The ECU uses later-defined ADB logic, calibrated glare thresholds, and hysteresis to decide which matrix columns to mask.

Expected behavior:

- With no relevant vehicle, all matrix rows remain on in `HighBeam_Dimming`.
- With one relevant vehicle, the ECU switches off high-beam pixels in the affected horizontal columns.
- With multiple relevant vehicles, their affected columns combine into one mask.
- The low-beam base remains on, and unmasked high-beam pixels stay on.

The MAX7219 supports individual pixel on/off state and one global 16-step
brightness setting per matrix. The proposed output does not assign different
brightness levels to individual pixels.

High-beam modes command both servos to center and disable steering-based
swivel. Rows 5–8 continue shining while the platforms recenter. The ECU should
confirm both servos are within the centered tolerance before enabling rows
1–4 and applying the centered high-beam ADB column map. A later design that
combines swivel and high beam would require a different calibrated mapping.
The visual high-beam preview uses a 100 m reach and ±10° half-angle; these
values also need optical calibration.

## Glare-Based Suppression Threshold

A high-beam column should be switched off when a detected vehicle occupies
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

For the prototype, use the threshold as a calibration value. Apply a one-column
safety margin and decision hysteresis so the beam does not flicker as the
detected vehicle moves near a decision boundary or distance threshold.

## Logical Input And Physical Zones

`0x310 Vehicle_Object` provides surrounding-object input, and
`AppliedDimSectorMask` reports logical sectors whose mapped high-beam pixels
were switched off. The proposed physical bench uses one 8x8 matrix per
headlight. The High beam visual preview uses distance to choose a coarse count of
top high-beam rows to mask in an affected column (4/3/2/1 at example distances
30/50/70/100 m). Firmware behavior remains undecided; accurate vertical shadow
placement needs target height bounds and calibrated row optics.

The ECU maps logical sectors to matrix columns through calibration. A road
mask bit can affect columns on both lamps. Detailed pixel angles, edge
handling, and shadow margin require hardware calibration.

## Control Paths

| Path | Hardware chain | Notes |
|---|---|---|
| Left/right swivel | STM32 I2C -> servo PCA9685 -> servo PWM -> feedback servos | One shared servo PCA9685 board controls both swivel servos |
| Left matrix | STM32 SPI -> left MAX7219 8x8 matrix module | One matrix handles both beam patterns on the left headlight |
| Right matrix | STM32 SPI -> right MAX7219 8x8 matrix module | One matrix handles both beam patterns on the right headlight |
| Servo feedback | Servo feedback wire -> STM32 ADC | Feedback is read by the ECU, not by the PCA9685 |

The MAX7219 matrix modules handle display scanning and per-pixel on/off output.
They use a separate 5 V supply. Confirm 3.3 V SPI logic compatibility or add
level shifting for the selected modules.

## Status Observability

The Dashboard should be able to visualize the headlight state from decoded `0x100 AFS_Status` provided through the C++ bridge IPC interface:

| Status data | Meaning |
|---|---|
| `LeftServoFeedbackDeg` | Actual left platform rotation |
| `RightServoFeedbackDeg` | Actual right platform rotation |
| `AppliedDimSectorMask` | Logical beam sectors whose high-beam matrix pixels were switched off |
| `ServoControlLost` | Servo control path is unavailable |
| `ServoMismatch` | Servo moved incorrectly or feedback disagrees with target |
| `BeamControlLost` | One or both matrix control paths are unavailable |
