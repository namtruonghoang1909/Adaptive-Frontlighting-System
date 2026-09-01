# 0x300 Vehicle_Speed

`Vehicle_Speed` is transmitted by the CAN Bridge. It carries ego vehicle speed for low-beam swivel behavior, fallback decisions, and dashboard/log correlation.

## Frame

| Field | Value |
|---|---|
| CAN ID | `0x300` |
| Name | `Vehicle_Speed` |
| Producer | CAN Bridge |
| Consumer | AFS ECU |
| Direction | Host to ECU |
| DLC | 8 |
| Suggested period | 20 ms |

`DLC = 8` means this Classical CAN frame carries eight data bytes, byte `0` through byte `7`.

## Signal Semantics

`SpeedValid` means the bridge read, converted, and range-checked a usable ego speed sample. If `SpeedValid = 0`, the ECU should ignore the speed value and should not refresh the usable speed-input timer.

`SpeedSaturated` means the bridge clipped the speed or acceleration to the supported CAN signal range before transmission. A saturated value may still be usable if `SpeedValid = 1`, but it should be treated as diagnostic evidence that the simulator value exceeded the expected range.

No source field is carried in this frame. The producer is already fixed as the CAN Bridge; if source diagnostics are needed later, they should be added to a separate bridge/status message.

## Byte Layout

The alive counter is placed in byte `0` bits `0..3` for consistency with all provisional project frames.

| Byte | Bits | Signal | Type / Scale | Meaning |
|---:|---|---|---|---|
| 0 | 0..3 | `AliveCounter` | uint4 | Rolling bridge heartbeat counter, `0..15` |
| 0 | 4 | `SpeedValid` | bool | Speed sample is fresh and usable |
| 0 | 5 | `SpeedSaturated` | bool | Speed or acceleration was clipped to supported range |
| 0 | 6 | `VehicleReverse` | bool | Ego vehicle is reversing |
| 0 | 7 | `Reserved` | bool | Transmit `0` |
| 1..2 | 0..15 | `VehicleSpeedKph` | uint16 LE, `0.1 kph/bit` | Ego speed in kilometers per hour |
| 3 | 0..7 | `LongitudinalAccelMps2` | int8, `0.1 m/s^2/bit` | Optional longitudinal acceleration |
| 4..6 | 0..23 | `Reserved` | uint24 | Transmit `0` |
| 7 | 0..7 | `Checksum` | uint8 | XOR of bytes `0..6`; `0` until implemented |

## Visual Layout

```text
Byte:    0          1          2          3          4          5          6          7
      +--------+ +-------------------+ +--------+ +-----------------------------+ +--------+
Bits: | alive  | | VehicleSpeedKph   | | accel  | |          reserved           | | cksum  |
      +--------+ +-------------------+ +--------+ +-----------------------------+ +--------+

Byte 0 bits: [7] [6] [5] [4]   [3 2 1 0]
             res rev sat valid alive
```

## Example

Vehicle speed `54.6 kph`, acceleration `+0.3 m/s^2`, valid, not saturated, not reversing, alive counter `8`:

```text
Byte 0 = alive counter 8 in bits 0..3 + SpeedValid = 0x18
VehicleSpeedKph raw = 54.6 / 0.1 = 546 = 0x0222
LongitudinalAccelMps2 raw = 0.3 / 0.1 = 3 = 0x03

ID:   0x300
DLC:  8
HEX:  18 22 02 03 00 00 00 3B
BIN:  00011000 00100010 00000010 00000011 00000000 00000000 00000000 00111011
```

| Byte | Hex | Binary | Signal | Decoded value |
|---:|---:|---|---|---|
| 0 | `0x18` | `00011000` | `AliveCounter` | `8` |
| 0 | `0x18` | `00011000` | `SpeedValid` | `1` |
| 0 | `0x18` | `00011000` | `SpeedSaturated` | `0` |
| 0 | `0x18` | `00011000` | `VehicleReverse` | `0` |
| 1..2 | `0x0222` | `00000010 00100010` | `VehicleSpeedKph` | `54.6 kph` |
| 3 | `0x03` | `00000011` | `LongitudinalAccelMps2` | `+0.3 m/s^2` |
| 4..6 | `0x000000` | `00000000 00000000 00000000` | reserved | transmit `0` |
| 7 | `0x3B` | `00111011` | `Checksum` | XOR of bytes `0..6` |

## Receiver Behavior

- If `SpeedValid = 0`, the ECU should ignore `VehicleSpeedKph` and should not refresh the usable speed-input timer.
- If this message times out or fails alive-counter checks, the ECU should disable or reject behaviors that require speed and set `SpeedStale` in `0x100 AFS_Status`.
- If `SpeedSaturated = 1` and `SpeedValid = 1`, the ECU may use the clipped value but should treat the condition as diagnostic/degraded input.
- Low-beam swivel gain may depend on speed, but the speed message should not directly command a servo angle.
