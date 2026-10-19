# 0x310 Vehicle_Object

`Vehicle_Object` is transmitted by the C++ bridge CAN module. It is the ADB object-grid input to the AFS ECU. The message does not carry raw lidar rays and does not directly command matrix pixels. It carries nearest detected-vehicle distance per logical beam sector.

A complete 10-sector grid sample is sent as two `0x310` frames:

```text
group 0: sectors 00..07
group 1: sectors 08..09, followed by six zero padding codes
```

Both frames for the same grid sample use the same `GridSampleCounter`. The ECU accepts a new object grid only after it receives both groups for the same sample counter.

## Frame

| Field | Value |
|---|---|
| CAN ID | `0x310` |
| Name | `Vehicle_Object` |
| Producer | C++ bridge CAN module |
| Consumer | AFS ECU |
| Direction | Host to ECU |
| DLC | 8 |
| Suggested grid period | 20 ms per complete 2-frame grid sample |
| Transmit pattern | Send group 0 and group 1 as a short burst for each grid sample |

## Object-Grid Contract

The bridge receives MetaDrive perception, then converts it into ego-relative ADB grid inputs:

```text
MetaDrive object state or lidar-derived detection
  -> filter vehicles relevant to ADB glare decisions
  -> compute ego-relative angle and distance
  -> project each vehicle into one or more ADB beam sectors
  -> keep only the nearest vehicle distance per sector
  -> transmit two 0x310 group frames
```

Coordinate convention:

```text
x = forward from ego vehicle
y = left from ego vehicle
angle_deg = atan2(y, x)
positive angle = left of ego heading
```

## ADB Grid Convention

This provisional layout uses 10 horizontal beam sectors. Vertical rows are intentionally not modeled in this frame because the first MetaDrive input is effectively horizontal.

The [interactive High beam visual preview](../../../tools/system_visualization/beam-segments.html)
defaults to the same 10 sectors. It retains the former 16-sector preview's
far-field boundaries `03..12`, renumbered `00..09`. The far-field edges are
about ±14.223°; the two edge cells reach ±18° through 30 m and blend to the
far-field edges by 50 m. The far-field boundary angles from left to right are:

```text
+14.223  +10.882  +7.705  +4.737  +2.062  0
 -2.062   -4.737  -7.705 -10.882 -14.223 degrees
```

These are illustrative boundaries, not measured lamp photometry. Freeze one
shared boundary table and near-field rule before implementing bridge encoding
and ECU decoding; see the
[ADB mapping design](../../architecture/adb-grid-and-lamps.md).

```text
Left of ego                               Right of ego
+14.223 deg                                -14.223 deg
  [00] [01] [02] [03] [04] [05] [06] [07] [08] [09]
```

Each sector reports whether a vehicle exists by using a nonzero distance code. The ECU maps the 10 logical sectors to eight horizontal columns on each 8x8 matrix through calibration. The High beam visual demo uses distance as a coarse vertical heuristic: its example distances 30/50/70/100 m switch off 4/3/2/1 top high-beam rows in affected columns; the lower four low-beam rows stay active. In low-beam swivel mode rows 1–4 are off and this ADB input does not control the low rows. The frame has no vertical target bounds, so this heuristic cannot place a vehicle-shaped vertical shadow. These preview bands are not part of the CAN contract or finalized ECU behavior.

## Nearest Vehicle Per Sector

For each sector, the bridge keeps only the nearest detected vehicle distance.

```text
sector 03 contains vehicles at 48 m and 28 m
reported sector 03 distance = 28 m
```

If a vehicle spans multiple sectors, each covered sector receives that vehicle distance unless another vehicle in that sector is closer.

```text
vehicle A spans sectors 02,03,04 at 28 m
vehicle B spans sectors 07,08 at 80 m

sector 02 = 28 m
sector 03 = 28 m
sector 04 = 28 m
sector 07 = 80 m
sector 08 = 80 m
all other sectors = no vehicle
```

## Distance Code

Each sector distance is packed as a 6-bit code.

| Code | Meaning |
|---:|---|
| `0` | No vehicle in this sector |
| `1..62` | Nearest vehicle distance, approximately `code * 4 m` |
| `63` | Vehicle present, but distance is saturated, unknown, or outside the representable range |

Recommended encoder behavior:

```text
if no vehicle in sector:
    code = 0
else if distance cannot be represented clearly:
    code = 63
else:
    code = clamp(ceil(distance_m / 4), 1, 62)
```

The ECU should compare codes to calibrated glare thresholds, not treat the distance as exact:

```text
threshold_code[sector] = ceil(glare_threshold_m[sector] / 4)

if 1 <= distance_code <= threshold_code[sector]:
    suppress or strongly dim that sector
```

Use distance hysteresis in the ECU so sectors do not flicker near the threshold.

## Grid Sample Counter

`GridSampleCounter` identifies one complete 10-sector grid scan. It increments once per grid calculation, not once per `0x310` frame.

```text
Bridge calculates grid sample 42
0x310 group 0: GridSampleCounter = 42
0x310 group 1: GridSampleCounter = 42
```

The ECU should reject mixed samples:

```text
group 0 counter = 42
group 1 counter = 43
=> incomplete/mixed grid, do not use as a new sample
```

`AliveCounter` is still present and increments on every transmitted `0x310` frame. It is checked for frame freshness/sequence. `GridSampleCounter` is checked to combine the two groups into one logical grid snapshot.

## Object List Overflow

`ObjectListOverflow` does not mean multiple vehicles exist in one sector. Multiple vehicles in one sector are normal; the bridge reports the nearest one.

Set `ObjectListOverflow = 1` only when the bridge or perception extractor had too many candidate vehicles and had to drop some before computing the nearest-per-sector grid. If every candidate was processed into the grid, transmit `ObjectListOverflow = 0`.

## Byte Layout

The alive counter is placed in byte `0` bits `0..3` for consistency with all provisional project frames.

| Byte | Bits | Signal | Type / Scale | Meaning |
|---:|---|---|---|---|
| 0 | 0..3 | `AliveCounter` | uint4 | Rolling bridge frame counter, increments every `0x310` frame |
| 0 | 4 | `SectorGroupIndex` | bool | `0` = sectors `00..07`; `1` = sectors `08..09` plus padding |
| 0 | 5 | `GridValid` | bool | Bridge produced a fresh usable ADB grid group |
| 0 | 6 | `PerceptionDegraded` | bool | Bridge perception is usable but degraded |
| 0 | 7 | `ObjectListOverflow` | bool | Candidate objects were dropped before grid calculation |
| 1 | 0..7 | `GridSampleCounter` | uint8 | Increments once per complete grid calculation |
| 2..7 | 0..47 | `SectorDistanceCodes` | eight packed uint6 slots | Group 0 has eight distances; group 1 has two distances and six zero padding slots |

There is no payload checksum byte in this provisional `0x310` layout because bytes `2..7` are fully used for the sector-distance payload. The frame relies on Classical CAN CRC, DLC validation, alive counter checks, `GridSampleCounter`, group completeness, and timeouts.

## Packed Distance Layout

Bytes `2..7` are a little-endian 48-bit bitstream.

```text
bits  0..5   distance code for sector base + 0
bits  6..11  distance code for sector base + 1
bits 12..17  distance code for sector base + 2
bits 18..23  distance code for sector base + 3
bits 24..29  distance code for sector base + 4
bits 30..35  distance code for sector base + 5
bits 36..41  distance code for sector base + 6
bits 42..47  distance code for sector base + 7
```

Sector base is `0` for group `0` and `8` for group `1`. In group `1`, slots
`2..7` have no sector and must be transmitted as zero and rejected if nonzero.

## Visual Layout

```text
Byte:   0          1          2          3          4          5          6          7
      +--------+ +--------+ +-------------------------------------------------------+
Bits: | alive  | | sample | |       eight packed 6-bit nearest-distance codes       |
      +--------+ +--------+ +-------------------------------------------------------+

Byte 0 bits: [7]      [6]       [5]   [4]   [3 2 1 0]
             overflow degraded  valid group alive
```

## Example

Grid sample `42` has these nearest vehicles:

```text
vehicle A spans sectors 02,03,04 at about 28 m
vehicle B spans sectors 07,08 at about 80 m
```

Distance codes use `ceil(distance_m / 4)`:

```text
28 m -> code 7
80 m -> code 20
```

Group 0 carries sectors `00..07`:

```text
sector codes: 00 00 07 07 07 00 00 20
ID:   0x310
DLC:  8
HEX:  25 2A 00 70 1C 07 00 50
```

Group 1 carries sectors `08..09`, then six zero padding codes:

```text
sector codes: 20 00 00 00 00 00 00 00
ID:   0x310
DLC:  8
HEX:  36 2A 14 00 00 00 00 00
```

Decoded example:

| Sector | Group | Code | Approx distance | Meaning |
|---:|---:|---:|---:|---|
| `02` | `0` | `7` | `28 m` | Vehicle present |
| `03` | `0` | `7` | `28 m` | Vehicle present |
| `04` | `0` | `7` | `28 m` | Vehicle present |
| `07` | `0` | `20` | `80 m` | Vehicle present |
| `08` | `1` | `20` | `80 m` | Vehicle present |
| other sectors | `0/1` | `0` | none | No vehicle in sector |

## Receiver Behavior

- If `GridValid = 0`, the ECU should ignore that group and should not accept a new grid sample.
- Reject group 1 if any of its six padding codes is nonzero.
- The ECU should accept a new object grid only after both groups arrive with the same `GridSampleCounter`.
- If one group is missing, stale, invalid, or mixed with another sample counter, the ECU should keep the previous complete grid briefly, then mark object input stale/degraded according to timeout policy.
- The ECU should treat `distance_code != 0` as sector vehicle presence.
- The ECU should compare each nonzero sector distance code with calibrated glare thresholds to decide the actual dimmed/suppressed output.
- The ECU should report the actually applied dimming output on `0x100 AFS_Status` as `AppliedDimSectorMask`.
