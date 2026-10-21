# 0x200 Vehicle_Steering

`Vehicle_Steering` is transmitted by the C++ bridge CAN module. It carries ego steering input converted from the simulator into a compact, ECU-friendly form for low-beam swivel.

## Frame

| Field | Value |
|---|---|
| CAN ID | `0x200` |
| Name | `Vehicle_Steering` |
| Producer | C++ bridge CAN module |
| Consumer | AFS ECU |
| Direction | Host to ECU |
| DLC | 8 |
| Suggested period | 20 ms |
| ECU receive timeout | 100 ms without an accepted frame (five 20 ms periods) |

`DLC = 8` means this Classical CAN frame carries eight data bytes, byte `0` through byte `7`.

## Coordinate Convention

`SteeringAngleDeg` preserves the sign of `ego.steering_deg` from runner IPC. The bridge does not invert or normalize it. The ECU interprets left and right using the same MetaDrive source convention, whether left is positive or negative. The sample signed angle below is illustrative; it does not define which sign means left.

The accepted angle range follows the active MetaDrive vehicle's
`max_steering_deg`: `-max_steering_deg` through `+max_steering_deg`. The runner
IPC must include this MetaDrive limit so the bridge can validate the angle;
the limit itself is not a CAN signal.

## Signal Semantics

`SteeringValid` means the bridge received a steering angle and its active MetaDrive limit from a source sample no older than 250 ms, then confirmed the angle is within that limit. If the source sample is stale, either value is unavailable, or a runner transfer, parsing, or validation fault invalidates the input, the bridge sets `SteeringValid = 0`. The ECU should then ignore the steering value and should not refresh the usable steering-input timer.

`SteeringSaturated` means the bridge had to clamp the value to fit the signed CAN field. When this is `1`, the bridge also sets `SteeringValid = 0`; the ECU ignores the clamped value. The combination `SteeringSaturated = 1` and `SteeringValid = 1` is invalid.

No source field is carried in this frame. The producer is already fixed as the C++ bridge CAN module; if source diagnostics are needed later, they should be added to a separate bridge/status message.

## Byte Layout

The alive counter is placed in byte `0` bits `0..3` for consistency with all provisional project frames.

| Byte | Bits | Signal | Type / Scale | Meaning |
|---:|---|---|---|---|
| 0 | 0..3 | `AliveCounter` | uint4 | Increment for every transmitted `0x200` frame, even when steering is invalid or repeated; wrap `15` to `0` |
| 0 | 4 | `SteeringValid` | bool | Steering sample is no older than 250 ms and usable; cleared on detected runner input faults |
| 0 | 5 | `SteeringSaturated` | bool | Angle exceeded the CAN field range and was clamped for encoding; `SteeringValid` is also `0` |
| 0 | 6..7 | `Reserved` | uint2 | Transmit `0` |
| 1..2 | 0..15 | `SteeringAngleDeg` | int16 LE, `0.1 deg/bit` | Ego steering angle in degrees |
| 3 | 0..7 | `Reserved` | uint8 | Transmit `0`; steering rate is not used by the agreed swivel input |
| 4..6 | 0..23 | `Reserved` | uint24 | Transmit `0` |
| 7 | 0..7 | `Reserved` | uint8 | Transmit `0`; use Classical CAN CRC, with no application checksum |

## Visual Layout

```text
Byte:    0          1          2          3          4          5          6          7
      +--------+ +-------------------+ +--------+ +-----------------------------+ +--------+
Bits: | alive  | | SteeringAngleDeg  | |  res   | |          reserved           | |  res   |
      +--------+ +-------------------+ +--------+ +-----------------------------+ +--------+

Byte 0 bits: [7 6] [5] [4]   [3 2 1 0]
             res   sat valid alive
```

## Example

Steering angle `+12.3 deg` (the sign is illustrative), valid, not saturated, alive counter `7`:

```text
Byte 0 = alive counter 7 in bits 0..3 + SteeringValid = 0x17
SteeringAngleDeg raw = 12.3 / 0.1 = 123 = 0x007B
Reserved bytes 3..7 are transmitted as 0; byte 7 is not an application checksum.

ID:   0x200
DLC:  8
HEX:  17 7B 00 00 00 00 00 00
BIN:  00010111 01111011 00000000 00000000 00000000 00000000 00000000 00000000
```

| Byte | Hex | Binary | Signal | Decoded value |
|---:|---:|---|---|---|
| 0 | `0x17` | `00010111` | `AliveCounter` | `7` |
| 0 | `0x17` | `00010111` | `SteeringValid` | `1` |
| 0 | `0x17` | `00010111` | `SteeringSaturated` | `0` |
| 1..2 | `0x007B` | `00000000 01111011` | `SteeringAngleDeg` | `+12.3 deg` |
| 3 | `0x00` | `00000000` | `Reserved` | transmit `0` |
| 4..6 | `0x000000` | `00000000 00000000 00000000` | reserved | transmit `0` |
| 7 | `0x00` | `00000000` | `Reserved` | transmit `0`; frame uses Classical CAN CRC |

## Receiver Behavior

- If `SteeringValid = 0`, the ECU should immediately ignore `SteeringAngleDeg`, mark steering unusable, and not run behavior that requires a valid steering input.
- If no accepted `0x200` frame arrives for 100 ms, or this message fails alive-counter checks, the ECU should disable low-beam swivel when that behavior requires steering and set `SteeringStale` in `0x500 AFS_Status`. This is five expected 20 ms periods. A frame with `SteeringValid = 0` is received but does not make the steering input usable.
- If `SteeringSaturated = 1`, the ECU must ignore `SteeringAngleDeg`; reject the inconsistent combination where `SteeringValid = 1`.
