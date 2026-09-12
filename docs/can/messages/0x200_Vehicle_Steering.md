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

`DLC = 8` means this Classical CAN frame carries eight data bytes, byte `0` through byte `7`.

## Coordinate Convention

Positive steering angle means the ego vehicle is steering left. Negative steering angle means the ego vehicle is steering right.

## Signal Semantics

`SteeringValid` means the bridge read, converted, and range-checked a usable steering sample. If `SteeringValid = 0`, the ECU should ignore the steering value and should not refresh the usable steering-input timer.

`SteeringSaturated` means the bridge clipped the steering angle or rate to the supported CAN signal range before transmission. A saturated value may still be usable if `SteeringValid = 1`, but it should be treated as diagnostic evidence that the simulator value exceeded the expected range.

No source field is carried in this frame. The producer is already fixed as the C++ bridge CAN module; if source diagnostics are needed later, they should be added to a separate bridge/status message.

## Byte Layout

The alive counter is placed in byte `0` bits `0..3` for consistency with all provisional project frames.

| Byte | Bits | Signal | Type / Scale | Meaning |
|---:|---|---|---|---|
| 0 | 0..3 | `AliveCounter` | uint4 | Rolling bridge heartbeat counter, `0..15` |
| 0 | 4 | `SteeringValid` | bool | Steering sample is fresh and usable |
| 0 | 5 | `SteeringSaturated` | bool | Steering angle or rate was clipped to supported range |
| 0 | 6..7 | `Reserved` | uint2 | Transmit `0` |
| 1..2 | 0..15 | `SteeringAngleDeg` | int16 LE, `0.1 deg/bit` | Ego steering angle in degrees |
| 3 | 0..7 | `SteeringRateDegps` | int8, `1 deg/s/bit` | Steering-angle rate, optional tuning input |
| 4..6 | 0..23 | `Reserved` | uint24 | Transmit `0` |
| 7 | 0..7 | `Checksum` | uint8 | XOR of bytes `0..6`; `0` until implemented |

## Visual Layout

```text
Byte:    0          1          2          3          4          5          6          7
      +--------+ +-------------------+ +--------+ +-----------------------------+ +--------+
Bits: | alive  | | SteeringAngleDeg  | |  rate  | |          reserved           | | cksum  |
      +--------+ +-------------------+ +--------+ +-----------------------------+ +--------+

Byte 0 bits: [7 6] [5] [4]   [3 2 1 0]
             res   sat valid alive
```

## Example

Steering left by `12.3 deg`, steering rate `-4 deg/s`, valid, not saturated, alive counter `7`:

```text
Byte 0 = alive counter 7 in bits 0..3 + SteeringValid = 0x17
SteeringAngleDeg raw = 12.3 / 0.1 = 123 = 0x007B
SteeringRateDegps raw = -4 = 0xFC

ID:   0x200
DLC:  8
HEX:  17 7B 00 FC 00 00 00 90
BIN:  00010111 01111011 00000000 11111100 00000000 00000000 00000000 10010000
```

| Byte | Hex | Binary | Signal | Decoded value |
|---:|---:|---|---|---|
| 0 | `0x17` | `00010111` | `AliveCounter` | `7` |
| 0 | `0x17` | `00010111` | `SteeringValid` | `1` |
| 0 | `0x17` | `00010111` | `SteeringSaturated` | `0` |
| 1..2 | `0x007B` | `00000000 01111011` | `SteeringAngleDeg` | `+12.3 deg` |
| 3 | `0xFC` | `11111100` | `SteeringRateDegps` | `-4 deg/s` |
| 4..6 | `0x000000` | `00000000 00000000 00000000` | reserved | transmit `0` |
| 7 | `0x90` | `10010000` | `Checksum` | XOR of bytes `0..6` |

## Receiver Behavior

- If `SteeringValid = 0`, the ECU should ignore `SteeringAngleDeg` and should not refresh the usable steering-input timer.
- If this message times out or fails alive-counter checks, the ECU should disable low-beam swivel when that behavior requires steering and set `SteeringStale` in `0x100 AFS_Status`.
- If `SteeringSaturated = 1` and `SteeringValid = 1`, the ECU may use the clipped value but should treat the condition as diagnostic/degraded input.
