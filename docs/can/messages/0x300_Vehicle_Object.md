# 0x300 Vehicle_Object

`Vehicle_Object` is transmitted by the C++ bridge CAN module to the AFS ECU. It carries one complete 10-sector ADB grid in a single Classical CAN frame. Each sector has an explicit occupancy bit and a four-bit cumulative subsector mask. The message reports where relevant vehicles are; it does not directly command matrix pixels.

## Frame

| Field | Value |
|---|---|
| CAN ID | `0x300` |
| Name | `Vehicle_Object` |
| Producer | C++ bridge CAN module |
| Consumer | AFS ECU |
| Direction | Host to ECU |
| CAN type | Classical CAN |
| DLC | 8 |
| Suggested transmit period | 20 ms |
| ECU receive timeout | 100 ms without an accepted frame (five 20 ms periods) |
| Transmit pattern | One complete latest-state frame per period; repeating an unchanged grid is expected while its source scene remains fresh |

## Object-Grid Contract

The bridge receives ego-relative vehicle observations over runner IPC, projects relevant vehicles into the agreed horizontal sector grid, and sets occupancy and subsector-mask signals:

```text
runner vehicle observations
  -> filter vehicles relevant to ADB glare decisions
  -> project each vehicle footprint into one or more horizontal sectors
  -> find the radial distance bands intersected by its footprint
  -> set the sector occupancy bit and cumulative subsector mask
  -> transmit one complete 0x300 frame
```

The bridge maps geometry and packs the message. The ECU owns the final decision about which high-beam matrix pixels to switch off.

The first implementation considers objects whose IPC type is `VEHICLE` only.
Pedestrians, cyclists, and static objects are excluded from the grid for now.

Coordinate convention:

```text
x = forward from ego vehicle
y = left from ego vehicle
angle_deg = atan2(y, x)
positive angle = left of ego heading
```

## ADB Grid Convention

This message uses 10 horizontal beam sectors. The [interactive High beam visual preview](../../../tools/system_visualization/beam-visual/beam-segments.html) defaults to the same 10 sectors. It retains the former 16-sector preview's far-field boundaries `03..12`, renumbered `00..09`. The far-field edges are about ±14.223°; the two edge cells reach ±18° through 30 m and blend to the far-field edges by 50 m. The far-field boundary angles from left to right are:

```text
+14.223  +10.882  +7.705  +4.737  +2.062  0
 -2.062   -4.737  -7.705 -10.882 -14.223 degrees
```

These are the agreed software-preview boundaries for bridge projection and ECU interpretation; they are not measured lamp photometry or a hardware calibration. See the [ADB mapping design](../../architecture/adb-grid-and-lamps.md).

```text
Left of ego                               Right of ego
+14.223 deg                                -14.223 deg
  [00] [01] [02] [03] [04] [05] [06] [07] [08] [09]
```

## Distance Bands And Sector Signals

The 100 m supported detection range is split into four equal bands. Use the full vehicle footprint: calculate the nearest Euclidean distance from the ego reference point to the footprint and the farthest Euclidean distance to its boundary. Clip that radial interval to 0–100 m and include every band it intersects. A footprint partly beyond 100 m contributes its in-range portion; a footprint wholly outside the range is not encoded. A footprint that crosses a band boundary uses the closer band's stronger cumulative mask as well.

| Distance band | Logical subsector mask |
|---|---|
| `75 <= d <= 100 m` | `0001` |
| `50 <= d < 75 m` | `0011` |
| `25 <= d < 50 m` | `0111` |
| `0 <= d < 25 m` | `1111` |

Here `d` is radial distance from the ego reference point to the vehicle footprint. Masks from all relevant vehicles in a sector are combined with bitwise OR. The allowed masks are `0000`, `0001`, `0011`, `0111`, and `1111`; closer vehicles extend the mask so subsectors above them are switched off. In the wire nibble, bit 0 is the farthest subsector and bit 3 is the nearest.

Each sector is encoded as a 5-bit record. The four mask bits are cumulative, not independent object-presence flags.

| Record bit | Signal | Meaning |
|---:|---|---|
| 0 | `SectorOccupied` | At least one relevant vehicle projects into this sector |
| 1 | `SubsectorMask_0` | Farthest subsector; bit 0 of the wire mask |
| 2 | `SubsectorMask_1` | Second-farthest subsector; bit 1 of the wire mask |
| 3 | `SubsectorMask_2` | Second-nearest subsector; bit 2 of the wire mask |
| 4 | `SubsectorMask_3` | Nearest subsector; bit 3 of the wire mask |

These bits encode the cumulative dimming mask for the sector. Multiple vehicles in the same sector combine by bitwise OR, so the nearest vehicle's stronger mask dominates. The frame does not carry object counts or identities.

```text
SectorOccupied = 0, SubsectorMask = 0000     -> no relevant vehicle in this sector
SectorOccupied = 1, SubsectorMask = 0001  -> vehicle(s) in the farthest band
SectorOccupied = 1, SubsectorMask = 1111  -> vehicle(s) in the nearest band
```

The explicit occupancy bit remains useful for validation and lets the ECU check that a valid occupied sector has a nonzero subsector mask.

## Byte And Bit Layout

The 8-byte payload is treated as a little-endian 64-bit bitstream. Bit 0 is byte 0 bit 0. Sector records are packed in increasing sector order; within each record, `SectorOccupied` is the least-significant bit.

| Payload bits | Signal | Type | Meaning |
|---:|---|---|---|
| 0..7 | `Reserved` | uint8 | Transmit `0`; the ECU uses `GridValid` and CAN receive timeout for freshness |
| 8 | `GridValid` | bool | The bridge produced a fresh, usable complete sector grid |
| 9 | `PerceptionDegraded` | bool | Object scan or required vehicle geometry is incomplete or unusable; if `1`, `GridValid` must be `0` |
| 10 | `ObjectListOverflow` | bool | The runner exceeded its configured object-list limit and dropped candidate objects before sending the scene |
| 11..60 | `SectorRecords` | 10 × uint5 | One occupancy/subsector record per sector, sectors `00..09` |
| 61..63 | `Reserved` | uint3 | Transmit `0`; receiver rejects nonzero values |

For sector `n`, its record starts at payload bit `11 + 5 × n`. Record bit 0 is `SectorOccupied`; record bits 1..4 carry `SubsectorMask_0` through `SubsectorMask_3`, with mask bit 0 farthest and mask bit 3 nearest.

The frame has no sample sequence or per-frame alive counter. The bridge repeatedly transmits the latest accepted grid and uses `GridValid` as the source-scene freshness and validity gate. The ECU acts on the latest frame, clears its active grid when `GridValid = 0`, and separately uses its 100 ms CAN receive timeout to detect a missing communication stream. The ECU does not compare successive grid contents. There is no sector-group index or multi-frame assembly.

The frame uses the Classical CAN CRC for link-level error detection. It has no application checksum. The reserved bits remain available for future use but must currently be zero.

## Example

The grid is valid. Sector `03` contains a vehicle in the nearest band (`1111`). Sector `07` contains a vehicle in the farthest band (`0001`). All other sectors are clear; `PerceptionDegraded` and `ObjectListOverflow` are zero. Byte `0` is reserved and set to zero.

```text
ID:   0x300
DLC:  8
HEX:  00 01 00 7C 00 C0 00 00
```

The sector records decode as:

| Sector | `SectorOccupied` | Subsector mask, farthest..nearest | Meaning |
|---:|---:|---:|---|
| `03` | 1 | `1111` | One or more vehicles in the nearest band |
| `07` | 1 | `0001` | One or more vehicles in the farthest band |
| other sectors | 0 | `0000` | No relevant vehicle |

## Receiver Behavior

- Accept only CAN ID `0x300` with DLC 8 and zero reserved bits.
- Use `GridValid` as the source-grid freshness and validity gate. The ECU does not need to compare grid contents across frames. If no accepted `0x300` frame arrives for 100 ms (five 20 ms periods), clear the active grid and enter fallback. A received frame with `GridValid = 0` clears the grid immediately, without waiting for this link timeout.
- If `GridValid = 0`, ignore all sector records, clear the ECU's active sector grid, and enter the configured fallback behavior. A bridge-generated invalid frame carries zero sector records.
- `PerceptionDegraded = 1` requires `GridValid = 0`. Treat the combination `GridValid = 1` and `PerceptionDegraded = 1` as an invalid frame: clear the active grid and enter fallback.
- If `GridValid = 1` and all sector records are clear, the sample is valid and reports no relevant vehicles.
- For a valid sample, check the occupancy and subsector-mask signals for consistency: occupied sectors have a nonzero legal mask; clear sectors have mask `0000`.
- Preserve the cumulative mask when multiple vehicles occupy one sector; combine their masks with bitwise OR. The ECU applies calibrated sector-to-column and subsector-to-row logic; the bridge does not send pixel masks.
- If a received frame fails CAN/application validation, or valid grid input becomes stale, the ECU clears its active sector grid and follows its fallback policy. A rejected frame cannot refresh the valid-grid timer.

## Bridge Input Validity

- A runner sample older than 250 ms is stale: transmit `GridValid = 0` and clear all sector records. While the latest accepted scene remains within this limit, repeat its latest grid on each scheduled CAN frame.
- If `objects_valid = false` or `objects_degraded = true`, transmit `GridValid = 0`, set `PerceptionDegraded = 1`, and clear all sector records, even when the list was not truncated. This avoids using a potentially incomplete object scan.
- If any relevant `VEHICLE` object has missing or unusable length, width, or relative heading, transmit `GridValid = 0`, set `PerceptionDegraded = 1`, and clear the entire grid. Do not approximate that object's footprint; require a fresh complete scene before restoring validity.
- A fresh, valid scan with no `VEHICLE` objects is valid: transmit `GridValid = 1` and an all-clear grid.
- If the IPC object list is truncated, transmit `GridValid = 0`, set both `PerceptionDegraded = 1` and `ObjectListOverflow = 1`, and clear all sector records. `ObjectListOverflow` means the runner's configured object-list capacity dropped candidates; it does not mean multiple vehicles occupy one sector.
- Any detected IPC transfer, parsing, or freshness fault immediately invalidates the grid and clears all sector records. These faults do not set `PerceptionDegraded` or `ObjectListOverflow` unless the object scan is also degraded or truncated. Expected sequence gaps are allowed and do not by themselves invalidate the grid.
- A fresh, well-formed scene is required before `GridValid` can return to `1`.

`PerceptionDegraded` describes object-scan or required vehicle-geometry
quality only; non-perception transfer, parsing, and freshness faults do not
set it. It is diagnostic and does not make an invalid grid usable. If it is
set, the grid must be invalid. `ObjectListOverflow` is set specifically when
the runner truncated the object list to its configured capacity.

## Decisions Still Needed Before Encoder/DBC Implementation

- ECU calibration from sector/band occupancy to each matrix's high-beam pixels and its reported `AppliedDimSectorMask` behavior.

The CAN ID, single-frame 10-sector format, sector geometry, distance-mask mapping, radial footprint range, fail-closed handling, and quality-flag meanings are agreed software design direction; hardware calibration remains separate.
