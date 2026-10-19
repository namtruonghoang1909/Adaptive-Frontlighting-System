# ADB Road Grid And Two-Headlamp Mapping

The [High beam visual preview](../../tools/system_visualization/beam-segments.html)
illustrates the data path below. It is a design preview; CAN projection and ECU
lamp control have not yet been implemented.

```text
ego-relative vehicles (forward, left, length, width, heading)
  -> bridge: nearest vehicle distance per logical road sector
  -> 0x310: 10 distance codes in two frames
  -> ECU: 10 logical mask bits with angular safety margin
  -> calibrated 8-column footprints for each headlight
  -> two 8x8 matrices: lower four rows low beam, upper four rows high beam
  -> ADB switches off distance-selected top rows in affected columns
  -> 0x100: logical sectors actually dimmed
```

## Data Shapes

| Stage | Suggested in-memory type | Meaning |
|---|---|---|
| Runner IPC observation | `RunnerObject { x_forward_m, y_left_m, length_m?, width_m?, relative_heading_rad? }` with scene validity flags | Current ego-relative contract; dimensions and heading may be absent. It does not include object height. |
| Bridge grid | `SectorGrid { nearest_m[10], sample_id, source_time }` | `nearest_m[i] = infinity` means no vehicle; the nearest overlapping vehicle wins. |
| CAN `0x310` | Eight 6-bit codes in group 0, two codes plus six zero padding slots in group 1 | `0` is empty, `1..62` represent about 4 m per step, and `63` is saturated or unknown. Both groups share one sample counter. |
| ECU road decision | `uint16_t requested_mask` with bits `0..9` used | Bit `i` means logical sector `i` requires a high-beam reduction; upper six bits are zero. |
| ECU lamp output | `uint8_t pixel_rows[2][8]` | One 8x8 bitmap per headlight. Each byte is one row; bits `0..7` select its eight horizontal columns. Rows `0..3` are the high-beam extension; rows `4..7` form the low-beam base. |
| ECU feedback | `0x100 AppliedDimSectorMask` | Logical road sectors whose mapped high-beam pixels were switched off. It does not report the full 128-pixel output state. |

The sector grid is **road space**. A matrix pixel is an **optical output**.
Both lamps cover some of the same road space, so one logical road bit can
switch off pixels on both matrices. Index road sectors and matrix columns from
left to right as viewed in the driving direction. The top four matrix rows add
high beam. The bottom four rows provide low beam and remain active when high
beam is off. In high-beam mode, the ECU adds the upper pattern and applies the
ADB mask to those rows.

The mode rule is fixed for this proposed rig: normal low-beam swivel uses only
rows 5–8 and steers the two platforms to different angles; high-beam modes
center both platforms, retain rows 5–8, and enable rows 1–4. The
[Low beam visual](../../tools/system_visualization/beam-segments.html?mode=low)
shows a shorter, wider footprint that moves with its steering wheel control.
The outside matrix turns three times farther than the inside matrix, and its speed bar
reduces both angles as speed rises. The preview's 40 m / ±18° low beam,
100 m / ±10° high beam, and ±6° maximum outside-matrix swivel are design values
for visualization. Physical optics and servo limits need bench calibration.
Firmware should wait for centered servo feedback before enabling the high-beam
extension so the ADB column map matches the actual aim.

The MAX7219 stores each pixel as on or off and provides 16 brightness steps
for the whole matrix. The proposed preview therefore models selective ADB
masking as switching individual upper pixels off; it does not model separate
brightness levels within a matrix. See the
[MAX7219 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX7219-MAX7221.pdf).

## Geometry And Calibration

Project each vehicle's four corners into the ego-relative polar grid. Mark
every sector touched by its angular interval and retain the nearest distance
per sector. The ECU expands the occupied interval by its configured margin.
Rotate the rectangle by `relative_heading_rad` when it is available. If
dimensions or heading are absent, use a documented conservative envelope or
mark the observation degraded; do not treat an unknown width as zero.
For each masked sector, project its angular interval from the reported vehicle
distance to **each** lamp's optical origin. Switch off each high-beam column
whose measured footprint intersects that interval. This projection matters
most for nearby vehicles because the two lamps are laterally separated.

The preview uses eight overlapping horizontal column footprints per lamp,
both extending across the road center. It independently projects the logical
mask onto the left and right matrices. The matrix panels show the proposed row
allocation: four high-beam rows above four low-beam rows. The preview applies
a distance heuristic to the top rows: example distances 30/50/70/100 m switch
off 4/3/2/1 rows in affected columns. The current `0x310` input has distance
but no target height, so this is only a coarse vertical approximation and
cannot calculate a vehicle-shaped shadow. The three
test cars use configurable axis-aligned rectangles. Their colors identify
columns for debugging; physical output is white.

On the bench, measure each matrix column's effective footprint on a wall or
screen at several distances, including overlap with neighboring columns and
the other headlight. Calibrate the vertical rows separately to establish the
low-beam cutoff and high-beam reach. If an unmasked high-beam pixel still lights
a vehicle, widen the mask or revise the optical mapping. The 8x8 preview is a
coarse educational model, not Audi photometry.

## Contract Decisions Before CAN Implementation

- The [0x310 proposal](../can/messages/0x310_Vehicle_Object.md) and preview
  now use **10 logical sectors**: old `03–12`, renumbered `00–09`. Their far
  boundaries and cell widths are unchanged. The far edges are about ±14.223°;
  the first and last cells reach ±18° at close range to include the outer lamp
  spill. The removed outer sectors `00–02` and `13–15` were dark at 15–100 m
  under the illustrative lamp model; the former `02` and `13` received some
  light at 5–10 m. Exact angles and distance rules still require bench
  measurement and a shared versioned geometry table before CAN implementation.
- Two `0x310` frames remain necessary for 10 six-bit distances plus sample and
  validity fields. Group 1 uses two slots and reserves six as zero padding.
- The current 6-bit `0x310` code represents detailed distances only through
  about **248 m** (`62 × 4 m`). The preview can display 300 m or more, but the
  CAN format would need a revised scale or saturation handling to preserve
  that range.
- The `0x100` logical mask should reflect real lamp output. With overlapping
  footprints, a sector counts as dimmed only when all high-beam pixels that
  materially illuminate it have been switched off. The low-beam base remains
  active.
- `0x100` cannot show the state of 128 individual matrix pixels. Define
  separate applied left/right matrix feedback before building a Dashboard view
  of the complete physical output; do not infer every pixel from the logical
  road mask.
- The preview's distance-to-row bands are illustrative and are not a firmware
  decision. Existing `0x310` distance can drive this coarse heuristic, but
  accurate vertical shadow placement needs object height bounds and calibrated
  row optics. Final thresholds need bench measurement and decision hysteresis.
