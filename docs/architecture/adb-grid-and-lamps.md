# ADB Road Grid And Two-Headlamp Mapping

The [High beam visual preview](../../tools/system_visualization/beam-visual/beam-segments.html)
illustrates the data path below. Bridge-side CAN projection is implemented;
ECU lamp control remains planned.

```text
ego-relative vehicles (forward, left, length, width, heading)
  -> bridge: project vehicle footprints into logical sectors and four distance bands
  -> 0x300: 10 occupancy-plus-subsector-mask records in one frame
  -> ECU: validate the sector grid and apply calibrated angular and row mapping
  -> calibrated 8-column footprints for each headlight
  -> two 8x8 matrices: lower four rows low beam, upper four rows high beam
  -> ADB switches off mapped high-beam pixels in affected columns and rows
  -> 0x500: logical sectors actually dimmed
```

## Data Shapes

| Stage | Suggested in-memory type | Meaning |
|---|---|---|
| Runner IPC observation | `RunnerObject { x_forward_m, y_left_m, length_m?, width_m?, relative_heading_rad? }` with scene validity flags | Current ego-relative contract; dimensions and heading may be absent. If a relevant vehicle lacks usable length, width, or heading, the whole grid is invalidated. It does not include object height. |
| Bridge grid | `SectorGrid { occupied[10], subsector_mask[10], source_time }` | Each sector records presence and a four-bit cumulative mask. The nearest vehicle's stronger mask dominates by bitwise OR. |
| CAN `0x300` | One DLC 8 frame with ten 5-bit sector records | Each record contains `SectorOccupied` and four cumulative subsector-mask bits. `GridValid` and quality flags describe the latest grid; byte 0 is reserved. |
| ECU road decision | Validated 10-sector occupancy/mask grid | The ECU applies calibrated sector-to-column and subsector-to-high-row mapping; exact pixel output remains firmware behavior. |
| ECU lamp output | `uint8_t pixel_rows[2][8]` | One 8x8 bitmap per headlight. Each byte is one row; bits `0..7` select its eight horizontal columns. Rows `0..3` are the high-beam extension; rows `4..7` form the low-beam base. |
| ECU feedback | `0x500 AppliedDimSectorMask` | Logical road sectors whose mapped high-beam pixels were switched off. It does not report the full 128-pixel output state. |

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
[Low beam visual](../../tools/system_visualization/beam-visual/beam-segments.html?mode=low)
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

Project each vehicle's full footprint into the ego-relative polar grid.
Mark every sector touched by its footprint and every 25 m distance band the
footprint overlaps. Compute radial extent as the nearest Euclidean distance
from the ego reference point to the footprint and the farthest distance to its
boundary, then clip the interval to 0–100 m. A partly out-of-range footprint
contributes its in-range portion; a wholly out-of-range footprint is ignored.
The resulting per-sector mask is cumulative: `0001` for
75–100 m, `0011` for 50–75 m, `0111` for 25–50 m, and `1111` for 0–25 m;
combine masks from multiple vehicles in the same sector with bitwise OR. Wire
bit 0 is the farthest subsector and bit 3 is the nearest. The ECU expands the
occupied interval by its configured margin. Rotate the rectangle by
`relative_heading_rad`. If any relevant vehicle lacks a usable length, width,
or relative heading, invalidate and clear the entire grid; do not approximate
the footprint. The ECU maps the received
subsector mask to high-beam rows and projects the occupied horizontal interval
from **each** lamp's optical origin. It switches off each high-beam pixel whose
measured footprint intersects the relevant interval. This projection matters
most for nearby vehicles because the two lamps are laterally separated.

The preview uses eight overlapping horizontal column footprints per lamp,
both extending across the road center. It independently projects the logical
mask onto the left and right matrices. The matrix panels show the proposed row
allocation: four high-beam rows above four low-beam rows. The `0x300` cumulative
mask describes the rows to dim by nearest distance band; it does not encode
object height or command pixels directly. The ECU's calibrated mapping from
mask bits to matrix rows remains firmware behavior. This cannot calculate a
vehicle-shaped vertical shadow. The three
test cars use configurable axis-aligned rectangles. Their colors identify
columns for debugging; physical output is white.

On the bench, measure each matrix column's effective footprint on a wall or
screen at several distances, including overlap with neighboring columns and
the other headlight. Calibrate the vertical rows separately to establish the
low-beam cutoff and high-beam reach. If an unmasked high-beam pixel still lights
a vehicle, widen the mask or revise the optical mapping. The 8x8 preview is a
coarse educational model, not Audi photometry.

## Contract Decisions Before CAN Implementation

- The [0x300 design](../can/messages/0x300_Vehicle_Object.md) and preview
  use **10 logical sectors**: old `03–12`, renumbered `00–09`. Their far
  boundaries and cell widths are unchanged. The far edges are about ±14.223°;
  the first and last cells reach ±18° at close range to include the outer lamp
  spill. This existing visualization geometry is the software projection
  contract; physical lamp calibration remains future bench work.
- The agreed `0x300` design carries all 10 sectors in one DLC 8 frame. It uses
  one occupancy bit and a four-bit cumulative subsector mask per sector, an
  validity/quality flags, byte 0 reserved, and reserved tail bits. The ECU
  consumes the latest valid grid without comparing it to prior grid contents.
- The 100 m supported range uses four equal bands: 0–25, 25–50, 50–75, and
  75–100 m. Use the vehicle footprint's nearest and farthest Euclidean
  distances from ego, clip the interval to 0–100 m, and include every band it
  overlaps. A footprint wholly outside the range contributes no sector
  records.
- Any detected transfer, parse, validation, freshness, or perception-quality
  fault makes `GridValid=0` and clears every sector record. Expected IPC
  sequence gaps are allowed. A fresh accepted scene is required to restore a
  valid grid. Object-scan or required-geometry faults set
  `PerceptionDegraded=1`; transfer, parse, and freshness faults alone do not.
- `PerceptionDegraded=1` always requires `GridValid=0`; the ECU rejects a frame
  that claims both a valid grid and degraded perception.
- `ObjectListOverflow=1` means the runner exceeded its configured object-list
  capacity and dropped candidate objects. It is not a per-sector vehicle count.
- If a relevant vehicle lacks usable length, width, or relative heading, the
  entire grid is invalidated and cleared; the bridge does not approximate its
  footprint.
- The `0x500` logical mask should reflect real lamp output. With overlapping
  footprints, a sector counts as dimmed only when all high-beam pixels that
  materially illuminate it have been switched off. The low-beam base remains
  active.
- `0x500` cannot show the state of 128 individual matrix pixels. Define
  separate applied left/right matrix feedback before building a Dashboard view
  of the complete physical output; do not infer every pixel from the logical
  road mask.
- The `0x300` subsector mask indicates the cumulative dimming depth within each
  sector; it does not directly command pixels. The ECU still needs calibrated
  row optics and the mapping from mask bits to high-beam rows. Accurate
  vehicle-shaped vertical shadows would need object height bounds, which the
  runner currently does not provide.
