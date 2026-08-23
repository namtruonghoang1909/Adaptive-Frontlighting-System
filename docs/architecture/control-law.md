# Control Law Summary

The control law describes the visible lighting behavior at a high level. Exact equations,
calibration values, and scheduler details are future build work.

## Inputs

| Input | Source |
|---|---|
| Steering angle | MetaDrive CAN Bridge on CAN `0x200` |
| Vehicle speed | MetaDrive CAN Bridge on CAN `0x300` |
| Relevant vehicle angle/distance | MetaDrive CAN Bridge on CAN `0x310` |
| Requested mode | Dashboard on CAN `0x400` |
| Servo position feedback | STM32F407VE ADC hardware inputs |
| Diagnostic state | AFS ECU internal checks |

## Modes

| Mode | Intended visible behavior |
|---|---|
| Low Beam Static | Low-beam LED pattern with both headlights centered |
| Low Beam AFS | Low-beam LED pattern with steering-linked horizontal swivel |
| High Beam | High-beam LED zones enabled without adaptive shadowing |
| High Beam ADB | High-beam LED zones enabled, with zones dimmed around detected vehicles |
| Fault Safe | Conservative low-beam static output with fault/status reporting |

## Logic Boundary

MetaDrive provides raw simulator data. The MetaDrive CAN Bridge extracts simple object-level signals
from simulator state or lidar-like observations. The AFS ECU owns the final lighting decision
and should not consume raw lidar arrays or camera frames.

## AFS Swivel

Low-beam AFS uses steering angle and vehicle speed to compute a bounded horizontal swivel
command. The commanded angle should be calibrated per left/right headlight and clamped to
mechanical limits.

## ADB Zone Dimming

High-beam ADB uses the relevant vehicle angle and distance to choose a shadow zone across the
LED segments. Zones inside the vehicle safety margin should dim or turn off, while zones
outside the margin remain bright enough to demonstrate high-beam visibility.

For the first implementation, high-beam ADB should keep both servos centered so the LED-zone
mapping is stable. A later version can combine AFS and ADB by subtracting current servo angle
from object angle.

## Safe Behavior

When required vehicle input is missing or invalid, the ECU should choose a conservative
low-beam static output: centered swivel, low-beam LED pattern, and visible fault/status
reporting.

When measured servo position does not track the commanded position within the calibrated
limit, the ECU should report a fault and fall back to the same conservative output where the
hardware can still be controlled.

## Tuning Boundary

Servo limits, speed gain, steering sign, left/right calibration, LED zone angles, ADB shadow
margin, object-distance thresholds, and stale-message timing are not fixed in this
orientation doc. They should be set during build work and hardware calibration.