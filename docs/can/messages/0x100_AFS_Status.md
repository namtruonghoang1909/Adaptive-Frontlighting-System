# 0x100 AFS_Status

`AFS_Status` is transmitted by the STM32F407VE AFS ECU to the C++ bridge CAN module. The CAN interface decodes it and stores a status snapshot that the Dashboard interface and log tools can expose. It reports what the ECU is actually executing, whether required inputs are fresh enough, which faults are active, the measured servo positions, and the beam dimming pattern actually applied by the ECU.

## Frame

| Field | Value |
|---|---|
| CAN ID | `0x100` |
| Name | `AFS_Status` |
| Producer | AFS ECU |
| Bus consumer | C++ bridge CAN module |
| Display consumers | Dashboard, logging tools, and verification tools through the C++ bridge IPC interface |
| Direction | ECU to host |
| DLC | 8 |
| Suggested period | 20 ms |

`DLC = 8` means this Classical CAN frame carries eight data bytes, byte `0` through byte `7`.

## Status Intent

`0x100` is an executed-status frame, not a command frame. The Dashboard provides requested headlight power and mode through the C++ bridge IPC interface, the C++ bridge CAN module publishes `0x400 Dashboard_Command`, and `ExecutedMode` reports the state or mode the ECU actually selected after checking input freshness, decoding validity, hardware health, and fallback rules.

`RequiredInputsValid` means the messages required for the requested behavior have fresh accepted data inside the configured timeout threshold. The ECU uses only fresh accepted inputs when deciding the current output action.

Examples:

| Requested command | Required fresh accepted inputs |
|---|---|
| `RequestedHeadlightPower = Off` | `0x400 Dashboard_Command` |
| `LowBeam_NoSwivel` | `0x400 Dashboard_Command` |
| `LowBeam_Swivel` | `0x400 Dashboard_Command`, `0x200 Vehicle_Steering`, `0x300 Vehicle_Speed` |
| `HighBeam_NoDimming` | `0x400 Dashboard_Command` |
| `HighBeam_Dimming` | `0x400 Dashboard_Command`, both `0x310 Vehicle_Object` groups for a usable grid sample |
| forced fallback after lost command | no requested command is valid, so `RequiredInputsValid = 0` |

A fresh complete `0x310 Vehicle_Object` grid with `GridValid = 1` and all sector distance codes set to `0` is still a valid input for `HighBeam_Dimming`; it means no relevant vehicle is currently detected and the applied dim mask may be `0x0000`. A stale, incomplete, undecodable, or `GridValid = 0` `0x310` sample is not a valid ADB input.

## Byte Layout

The alive counter is placed in byte `0` bits `0..3` for consistency with all provisional project frames.

| Byte | Bits | Signal | Type / Scale | Meaning |
|---:|---|---|---|---|
| 0 | 0..3 | `AliveCounter` | uint4 | Rolling ECU heartbeat counter, `0..15` |
| 0 | 4 | `RequiredInputsValid` | bool | Inputs required for the requested behavior are fresh and accepted |
| 0 | 5 | `FaultPresent` | bool | One or more byte 2 fault bits are set |
| 0 | 6 | `SafeFallback` | bool | ECU forced conservative fallback lighting |
| 0 | 7 | `Reserved` | bool | Transmit `0` |
| 1 | 0..2 | `ExecutedMode` | enum | State or mode currently executed by the ECU |
| 1 | 3 | `Reserved` | bool | Transmit `0` |
| 1 | 4..7 | `HealthState` | enum | Overall ECU health summary derived from flags and faults |
| 2 | 0 | `SteeringStale` | bool | No fresh accepted `0x200 Vehicle_Steering` inside the timeout |
| 2 | 1 | `SpeedStale` | bool | No fresh accepted `0x300 Vehicle_Speed` inside the timeout |
| 2 | 2 | `ObjectStale` | bool | No fresh accepted `0x310 Vehicle_Object` inside the timeout |
| 2 | 3 | `DashboardStale` | bool | No fresh accepted `0x400 Dashboard_Command` inside the timeout |
| 2 | 4 | `ServoControlLost` | bool | ECU cannot command the servo control path |
| 2 | 5 | `ServoMismatch` | bool | Servo feedback does not match the ECU target within tolerance |
| 2 | 6 | `BeamControlLost` | bool | ECU cannot command the beam/LED control path |
| 2 | 7 | `CanDecodeFault` | bool | At least one received input frame was rejected by CAN validation |
| 3 | 0..7 | `LeftServoFeedbackDeg` | int8, `0.5 deg/bit` | Left lamp measured/estimated swivel angle |
| 4 | 0..7 | `RightServoFeedbackDeg` | int8, `0.5 deg/bit` | Right lamp measured/estimated swivel angle |
| 5..6 | 0..15 | `AppliedDimZoneMask16` | uint16 LE | Beam columns actually dimmed/suppressed by the ECU |
| 7 | 0..7 | `Checksum` | uint8 | XOR of bytes `0..6`; `0` until implemented |

## Enums

### `ExecutedMode`

| Raw | Meaning |
|---:|---|
| `0` | `Off` |
| `1` | `Safe_Default` |
| `2` | `LowBeam_NoSwivel` |
| `3` | `LowBeam_Swivel` |
| `4` | `HighBeam_NoDimming` |
| `5` | `HighBeam_Dimming` |
| `6..7` | Reserved |

`ExecutedMode` already tells the receiver whether swivel or beam dimming is active. No separate `SwivelActive` or `BeamDimmingActive` flag is carried in this frame.

### `HealthState`

| Raw | Meaning |
|---:|---|
| `0` | `OK` |
| `1` | `Degraded` |
| `2` | `Faulted` |
| `3` | `SafeFallback` |
| `4..15` | Reserved |

Suggested computation:

```text
if SafeFallback:
    HealthState = SafeFallback
else if ServoControlLost or ServoMismatch or BeamControlLost:
    HealthState = Faulted
else if RequiredInputsValid == 0 or CanDecodeFault:
    HealthState = Faulted
else if FaultPresent:
    HealthState = Degraded
else:
    HealthState = OK
```

`HealthState` is a summary for dashboards and logs. Byte 2 remains the detailed source of fault information.

## Fault Semantics

`FaultPresent` should be set when any byte 2 fault bit is set.

Stale bits mean the ECU has not received fresh accepted data from that message category within the configured timeout. They explain which input category did not successfully provide usable data to the ECU.

A message is accepted only after it passes the receiver checks for that frame. A frame can be rejected because of wrong DLC, checksum failure, repeated or invalid alive counter, reserved enum value, out-of-range signal, or reserved bits set when they must be zero. Rejected frames can set `CanDecodeFault` and do not refresh the corresponding stale timer.

Hardware/control fault meanings:

| Fault | Meaning |
|---|---|
| `ServoControlLost` | The ECU cannot command the servo control path. Possible causes include servo PWM driver unavailable, I2C/control transaction failure, disabled servo output, or servo-control driver failure. |
| `ServoMismatch` | The ECU can command the servo path, but measured feedback does not match the ECU target within calibrated tolerance. |
| `BeamControlLost` | The ECU cannot command the beam/LED control path. Possible causes include LED PWM driver unavailable, LED-zone driver fault, disabled beam output, or requested beam output not applied. |

Stale bits are reported per category, even if the current mode does not require that category. `RequiredInputsValid` is mode-dependent; stale bits are diagnostic.

## Safe Fallback Lighting

`SafeFallback = 1` means the ECU could not safely execute the requested behavior and forced conservative lighting. The fallback output for this prototype is:

```text
center servos if controllable
disable low-beam swivel behavior
disable high-beam dimming behavior
apply conservative static low-beam pattern
turn glare-prone high-beam output off
report the reason through byte 2 fault bits
```

If the Dashboard requests `RequestedHeadlightPower = Off` and the request is fresh, `ExecutedMode = Off` while `SafeFallback = 0`. `SafeFallback = 1` is reserved for forced fallback to conservative lighting.

## Checksum

The checksum is an application-level payload integrity check. Classical CAN already has a bus-level CRC, but the application checksum helps catch software-side packing, replay, or decoding mistakes. For this provisional layout, byte `7` is the XOR of bytes `0..6`.

## Visual Layout

```text
Byte:   0          1          2          3          4          5          6          7
      +--------+ +--------+ +--------+ +--------+ +--------+ +-------------------+ +--------+
Bits: | alive  | | mode   | | faults | | L fbk  | | R fbk  | | applied mask 16  | | cksum  |
      +--------+ +--------+ +--------+ +--------+ +--------+ +-------------------+ +--------+

Byte 0 bits: [7] [6]      [5]    [4]       [3 2 1 0]
             res fallback fault inputs-ok alive
```

`AppliedDimZoneMask16` uses the same 16-column horizontal beam grid as `0x310 Vehicle_Object`. Bit `n` corresponds to beam column `n`; `1` means the ECU actually dimmed or suppressed that column.

```text
Column: 00 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15
Mask:   b0 b1 b2 b3 b4 b5 b6 b7 b8 b9 b10 b11 b12 b13 b14 b15
```

## Example A: High Beam Dimming Active

Two vehicles have caused the ECU to dim columns `05,06,07,11,12`. Both servos report centered feedback values, required inputs are fresh, and no faults are present.

```text
ID:   0x100
DLC:  8
HEX:  12 05 00 00 00 E0 18 EF
BIN:  00010010 00000101 00000000 00000000 00000000 11100000 00011000 11101111
```

| Byte | Hex | Binary | Signal | Decoded value |
|---:|---:|---|---|---|
| 0 | `0x12` | `00010010` | `AliveCounter` | `2` |
| 0 | `0x12` | `00010010` | `RequiredInputsValid` | `1` |
| 0 | `0x12` | `00010010` | `FaultPresent` | `0` |
| 0 | `0x12` | `00010010` | `SafeFallback` | `0` |
| 1 | `0x05` | `00000101` | `ExecutedMode` | `HighBeam_Dimming` |
| 1 | `0x05` | `00000101` | `HealthState` | `OK` |
| 2 | `0x00` | `00000000` | fault bits | none |
| 3 | `0x00` | `00000000` | `LeftServoFeedbackDeg` | `0.0 deg` |
| 4 | `0x00` | `00000000` | `RightServoFeedbackDeg` | `0.0 deg` |
| 5..6 | `0x18E0` | `00011000 11100000` | `AppliedDimZoneMask16` | columns `05,06,07,11,12` |
| 7 | `0xEF` | `11101111` | `Checksum` | XOR of bytes `0..6` |

## Example B: Object Input Stale Forces Fallback

The Dashboard requested high-beam dimming, but the ECU did not receive fresh accepted `0x310 Vehicle_Object` data before the timeout. The ECU forced conservative fallback lighting.

```text
ID:   0x100
DLC:  8
HEX:  63 31 04 00 00 00 00 56
BIN:  01100011 00110001 00000100 00000000 00000000 00000000 00000000 01010110
```

| Byte | Hex | Binary | Signal | Decoded value |
|---:|---:|---|---|---|
| 0 | `0x63` | `01100011` | `AliveCounter` | `3` |
| 0 | `0x63` | `01100011` | `RequiredInputsValid` | `0` |
| 0 | `0x63` | `01100011` | `FaultPresent` | `1` |
| 0 | `0x63` | `01100011` | `SafeFallback` | `1` |
| 1 | `0x31` | `00110001` | `ExecutedMode` | `Safe_Default` |
| 1 | `0x31` | `00110001` | `HealthState` | `SafeFallback` |
| 2 | `0x04` | `00000100` | `ObjectStale` | `1` |
| 3 | `0x00` | `00000000` | `LeftServoFeedbackDeg` | `0.0 deg` |
| 4 | `0x00` | `00000000` | `RightServoFeedbackDeg` | `0.0 deg` |
| 5..6 | `0x0000` | `00000000 00000000` | `AppliedDimZoneMask16` | no high-beam dimming applied |
| 7 | `0x56` | `01010110` | `Checksum` | XOR of bytes `0..6` |
