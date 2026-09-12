# 0x400 Dashboard_Command

`Dashboard_Command` is transmitted by the C++ bridge CAN module to the AFS ECU using the current Dashboard HMI command state as its source data. It carries the HMI command values that the ECU needs: requested headlight power, requested headlight mode, command validity, and a momentary clear-fault request.

The Dashboard is the logical command source. The C++ bridge CAN module is the bus-facing CAN producer, so the Dashboard does not pack or transmit this CAN frame directly.

## Frame

| Field | Value |
|---|---|
| CAN ID | `0x400` |
| Name | `Dashboard_Command` |
| Producer | C++ bridge CAN module |
| Logical source | Dashboard HMI |
| Consumer | AFS ECU |
| Direction | Host to ECU |
| DLC | 3 |
| Suggested period | 50 ms |

## Byte Layout

The alive counter is placed in byte `0` bits `0..3` for consistency with all provisional project frames. Byte `1` groups the related HMI headlight request values together: power first, then mode.

| Byte | Bits | Signal | Type / Scale | Meaning |
|---:|---|---|---|---|
| 0 | 0..3 | `AliveCounter` | uint4 | Rolling bridge CAN-interface counter, `0..15` |
| 0 | 4 | `CommandValid` | bool | Dashboard command is fresh and usable |
| 0 | 5 | `ClearFaultRequest` | bool | Momentary request to clear safe, clearable latched faults |
| 0 | 6..7 | `Reserved` | uint2 | Transmit `0` |
| 1 | 0 | `RequestedHeadlightPower` | enum | User-requested headlight power state |
| 1 | 1..3 | `RequestedHeadlightMode` | enum | User-requested lighting mode when power is on |
| 1 | 4..7 | `Reserved` | uint4 | Transmit `0` |
| 2 | 0..7 | `Checksum` | uint8 | XOR of bytes `0..1` |

## Enums

### `RequestedHeadlightPower`

| Raw | Meaning |
|---:|---|
| `0` | `Off` |
| `1` | `On` |

### `RequestedHeadlightMode`

| Raw | Meaning |
|---:|---|
| `0` | `LowBeam_NoSwivel` |
| `1` | `LowBeam_Swivel` |
| `2` | `HighBeam_NoDimming` |
| `3` | `HighBeam_Dimming` |
| `4..7` | Reserved |

## Visual Layout

```text
Byte:   0          1          2
      +--------+ +--------+ +--------+
Bits: | flags  | | p/mode | | cksum  |
      +--------+ +--------+ +--------+

Byte 0 bits: [7 6] reserved  [5] clear-fault  [4] command-valid  [3 2 1 0] alive
Byte 1 bits: [7..4] reserved [3 2 1] requested-mode [0] requested-power
```

## Example

Request headlights on, high-beam dimming, command valid, no clear-fault request, alive counter `4`:

```text
Byte 0 = alive counter 4 + CommandValid = 0x14
Byte 1 = RequestedHeadlightPower On + (RequestedHeadlightMode HighBeam_Dimming << 1) = 0x07
Byte 2 = checksum 0x14 XOR 0x07 = 0x13

ID:   0x400
DLC:  3
HEX:  14 07 13
```

| Signal | Decoded value |
|---|---|
| `AliveCounter` | `4` |
| `CommandValid` | `1` |
| `ClearFaultRequest` | `0` |
| `RequestedHeadlightPower` | `On` |
| `RequestedHeadlightMode` | `HighBeam_Dimming` |
| `Checksum` | `0x13` |

## Receiver Behavior

- Reject the frame if `DLC != 3`.
- Reject the frame if the checksum does not equal byte `0` XOR byte `1`.
- Reject the frame if any reserved bit is nonzero.
- Reject the frame if `RequestedHeadlightMode` uses a reserved value.
- If `CommandValid = 0`, ignore `RequestedHeadlightPower`, `RequestedHeadlightMode`, and `ClearFaultRequest`, and do not refresh the usable command timer.
- If `RequestedHeadlightPower = Off`, command headlights off or standby and ignore `RequestedHeadlightMode` for output selection.
- If `RequestedHeadlightPower = On`, evaluate `RequestedHeadlightMode` and the required fresh inputs for that mode.
- Treat `ClearFaultRequest` as edge-triggered, usually on a `0` to `1` transition, and clear only faults that are safe to clear.
- If this message times out or fails alive-counter checks, enter the configured safe default and set `DashboardStale` in `0x100 AFS_Status`.
