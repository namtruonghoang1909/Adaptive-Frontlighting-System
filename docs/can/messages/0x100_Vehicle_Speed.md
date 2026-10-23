# 0x100 Vehicle_Speed

`Vehicle_Speed` is transmitted by the C++ bridge CAN module. It carries signed ego longitudinal speed for low-beam swivel behavior, fallback decisions, and dashboard/log correlation. The runner IPC value is already signed in metres per second. The CAN signal uses `0.01 m/s per bit`.

## Frame

| Field | Value |
|---|---|
| CAN ID | `0x100` |
| Name | `Vehicle_Speed` |
| Producer | C++ bridge CAN module |
| Consumer | AFS ECU |
| Direction | Host to ECU |
| DLC | 8 |
| Suggested period | 20 ms |
| ECU receive timeout | 100 ms without an accepted frame (five 20 ms periods) |

`DLC = 8` means this Classical CAN frame carries eight data bytes, byte `0` through byte `7`.

## Signal Semantics

`SpeedValid` means the bridge received a signed ego speed sample no older than 250 ms and confirmed it is representable by the CAN signal. If the source sample is stale, speed is unavailable, or a runner transfer, parsing, or validation fault invalidates the input, the bridge sets `SpeedValid = 0`. The ECU should then ignore the speed value and should not refresh the usable speed-input timer.

`SpeedSaturated` means the bridge had to clamp the signed speed to fit the CAN field. When this is `1`, the bridge also sets `SpeedValid = 0`; the ECU ignores the clamped value. The combination `SpeedSaturated = 1` and `SpeedValid = 1` is invalid.

No source field is carried in this frame. The producer is already fixed as the C++ bridge CAN module; if source diagnostics are needed later, they should be added to a separate bridge/status message.

## Byte Layout

The alive counter is placed in byte `0` bits `0..3` for consistency with all provisional project frames.

| Byte | Bits | Signal | Type / Scale | Meaning |
|---:|---|---|---|---|
| 0 | 0..3 | `AliveCounter` | uint4 | Advances once per scheduled encoding cycle, even when speed is invalid or repeated; wrap `15` to `0`. A failed SocketCAN write can create a gap; ECU gap tolerance remains an integration decision. |
| 0 | 4 | `SpeedValid` | bool | Speed sample is no older than 250 ms and usable; cleared on detected runner input faults |
| 0 | 5 | `SpeedSaturated` | bool | Speed exceeded the CAN field range and was clamped for encoding; `SpeedValid` is also `0` |
| 0 | 6 | `Reserved` | bool | Transmit `0`; reverse is represented by a negative speed value |
| 0 | 7 | `Reserved` | bool | Transmit `0` |
| 1..2 | 0..15 | `LongitudinalSpeedMps` | int16 LE, `0.01 m/s/bit` | Signed ego longitudinal speed in metres per second; positive forward, negative reverse; range `-327.68..+327.67 m/s` |
| 3 | 0..7 | `Reserved` | uint8 | Transmit `0`; acceleration is not required for the agreed swivel behavior |
| 4..6 | 0..23 | `Reserved` | uint24 | Transmit `0` |
| 7 | 0..7 | `Reserved` | uint8 | Transmit `0`; use Classical CAN CRC, with no application checksum |

## Visual Layout

```text
Byte:    0          1          2          3          4          5          6          7
      +--------+ +-------------------+ +--------+ +-----------------------------+ +--------+
Bits: | alive  | | LongitudinalSpeedMps | |  res   | |          reserved           | |  res   |
      +--------+ +-------------------+ +--------+ +-----------------------------+ +--------+

Byte 0 bits: [7] [6] [5] [4]   [3 2 1 0]
             res res sat valid alive
```

## Example

The signed speed field can be read independently as follows:

```text
Forward +10.00 m/s: raw = +1000 = 0x03E8
CAN bytes (little-endian): E8 03
Bits by CAN byte:          11101000 00000011

Reverse -5.00 m/s: raw = -500 = 0xFE0C (16-bit two's complement)
CAN bytes (little-endian): 0C FE
Bits by CAN byte:          00001100 11111110
```

Complete frame for `+10.00 m/s`, valid, not saturated, alive counter `8`:

```text
Byte 0 = alive counter 8 + SpeedValid = 0x18
LongitudinalSpeedMps raw = +1000 = 0x03E8; little-endian bytes E8 03
Byte 3 and reserved bytes 4..7 = 0; byte 7 is not an application checksum.

ID:   0x100
DLC:  8
HEX:  18 E8 03 00 00 00 00 00
BIN:  00011000 11101000 00000011 00000000 00000000 00000000 00000000 00000000
```

| Byte | Hex | Binary | Signal | Decoded value |
|---:|---:|---|---|---|
| 0 | `0x18` | `00011000` | `AliveCounter` | `8` |
| 0 | `0x18` | `00011000` | `SpeedValid` | `1` |
| 0 | `0x18` | `00011000` | `SpeedSaturated` | `0` |
| 0 | `0x18` | `00011000` | `Reserved` bits 6..7 | transmit `0` |
| 1..2 | `0x03E8` | `00000011 11101000` | `LongitudinalSpeedMps` | `+10.00 m/s` |
| 3 | `0x00` | `00000000` | `Reserved` | transmit `0` |
| 4..6 | `0x000000` | `00000000 00000000 00000000` | reserved | transmit `0` |
| 7 | `0x00` | `00000000` | `Reserved` | transmit `0`; frame uses Classical CAN CRC |

## Receiver Behavior

- If `SpeedValid = 0`, the ECU should immediately ignore `LongitudinalSpeedMps` and mark speed unusable.
- If no accepted `0x100` frame arrives for 100 ms, or this message fails alive-counter checks, the ECU should disable or reject behaviors that require speed and set `SpeedStale` in `0x500 AFS_Status`. This is five expected 20 ms periods. A frame with `SpeedValid = 0` is received but does not make the speed input usable.
- If `SpeedSaturated = 1`, the ECU must ignore `LongitudinalSpeedMps`; reject the inconsistent combination where `SpeedValid = 1`.
- Low-beam swivel gain may depend on speed, but the speed message should not directly command a servo angle. Acceleration is not required by the agreed swivel behavior.
