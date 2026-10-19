# System Visualization

This tool has four tabs. **Code graph** maps implemented classes and calls.
**System in Action** illustrates the target prototype on a plain table.
**High beam visual** shows centered matrices and adaptive masking.
**Low beam visual** shows shorter, wider light that follows steering.

## System in Action

Open the [visitor 3D view](system-in-action.html) after starting the local
server below, or choose **System in Action** in the top navigation. The setup
runs left to right: a laptop displaying MetaDrive, a USB-CAN controller, CAN H
and CAN L through a shared breadboard, the STM32 ECU with its CAN transceiver,
and one MAX7219 8×8 LED matrix module per headlight. Each matrix uses its lower
four rows for low beam and its upper four rows for high beam and ADB masking.

The fixed example shows a white vehicle ahead and to the left of the red ego
car. Its LED pattern is a static illustration, not a computed mapping. For the
two-lamp overlap and response to moving vehicles, use **High beam visual**. The
Python runner and C++ bridge occupy separate
processes on the same laptop. Runner-to-bridge socket IPC is implemented; CAN
conversion and ECU lighting behavior remain planned.

The page uses a static 3D render with a local MetaDrive screen composite. It works without
JavaScript and has no playback, moving objects, or runtime data connection.
The Code graph and other views use the same local server.

## High And Low Beam Visuals

Open [High beam visual](beam-segments.html) or
[Low beam visual](beam-segments.html?mode=low) after starting the local server.
The same road map serves both tabs. Its default grid has 10 logical sectors and 10 m radial bands to
100 m. It retains the exact far-field boundaries of the former sectors `03–12`,
renumbered `00–09`; no remaining far-field cell becomes wider. The far-field
grid spans about ±14.22° with 11 straight radial divider rays. The two edge
cells extend to ±18° through 30 m to cover close-range lamp spill, then fade
to the far-field edges by 50 m. Inner cells stay about 1–2° near the center.
Indices remain left to right, starting at `00` on the left.
The map shows one set of grid lines; the former yellow near-field guide and
in-map lane and forward-axis labels have been removed. The wider near-field
edge extensions remain visible as fills.

The debug panel reports center and full-range lateral cell widths at 50 m and
100 m. When a visible test vehicle is in range, its angular extent is calculated
from `atan(vehicleWidthM / 2 / distance)`. Overlapping sectors and one adjacent
sector on each edge form a logical road mask. Each headlight is shown as an
8×8 matrix beside the road grid: the lower four rows (rows 5–8) stay on for low
beam, while high-beam mode adds upper rows 1–4 with both platforms centered.
The high-beam preview projects each masked sector from its distance
to both headlight positions, maps it to eight horizontal columns per matrix,
and switches off a distance-based number of top pixels in each affected
column. The example distances 30/50/70/100 m switch off the top 4/3/2/1
high-beam rows. The bands are ≤40 m: 4 rows, 41–60 m: 3, 61–85 m: 2, and
farther: 1. The 10-sector
`0x310` input provides distance but no vehicle-height bounds, so this is only
a coarse vertical approximation, not an object-shaped shadow calculation.
This is illustrative geometry, not calibrated glare control.

Two labeled markers on the car show the separate light origins. Each of the 16
matrix columns has a distinct diagnostic color in the map and controls to the left
it. Controls show whether each column is active, masked, or part of low beam.
Select a column control or colored footprint to outline its projected beam and
highlight the logical grid cells it reaches. The text below the controls lists
that column's covered sectors at 15, 50, and 100 m in the high tab or 10, 20,
and 40 m in the low tab by default. Select it again to show all columns. The colors
identify diagnostic channels; they are not emitted headlight colors.

The three-lane road uses 3.5 m lanes, with the ego car in the middle and one
adjustable, independently hideable test vehicle per lane. The left-lane target
is visible by default to show a partial ADB mask in the high tab; the center and right targets
can be enabled from their controls. Vehicle bodies use
configurable 4.5 × 1.8 m dimensions at the same scale as the grid. The default
100 m map uses about 11.25 SVG pixels per meter and reduces the scale for longer
configured ranges. Cell fills stay clean while stronger straight radial lines
and subdued range arcs make the sector layout easier to read.
Select **High beam visual** to see the centered 100 m, ±10° high-beam columns
and the always-on shorter low-beam base. Select **Low beam visual** to turn
rows 1–4 off and see rows 5–8 illuminate a 40 m, ±18° footprint. Its steering
wheel slider and draggable speed bar form a small driving dashboard. The wheel
drawing turns with the steering input, and dragging the speed bar changes the
calculated matrix aims. The two platforms use different angles: the outside
matrix turns three times farther, while the inside turns one third as far. The
overall swivel stays modest: the outside/inside angles are 6°/2° at 0 km/h,
3.75°/1.25° at 60 km/h, and 1.5°/0.5° at 120 km/h. On a left turn, the left
matrix is inside; right turns mirror the behavior. High beam returns
both platforms to center. The low-beam tab uses the same column
selection and vehicle controls for road context, with ADB masking inactive.
Its road display zooms to the first 60 m by default, so the 40 m footprint is
larger on screen. The range cap and sector labels move into the close-up;
vehicles set beyond it remain in the controls but leave the visible map.
The view depth scales with configured low-beam range and radial band size.

The dashboard uses an illustrative speed rule. Wheel input spans −90° to +90°;
speed spans 0–120 km/h and starts at 40 km/h. The outside matrix target is
`(wheel angle / 90°) × 6° × (1 − 0.75 × speed / 120)` after clamping both inputs.
The inside matrix swivels one third as far, so the outside aim is three times
larger while the overall swivel stays modest. At full left wheel input, the
outer/inner angles are 6°/2° at 0 km/h, 3.75°/1.25° at 60 km/h, and 1.5°/0.5°
at 120 km/h; the same rule mirrors right turns. Speed reduces both angles more
strongly at higher speeds, while the car and road stay fixed. This is a preview
rule, not ECU firmware or a calibrated vehicle response.

All numeric values come from the defaults in `beam-segments.js`. Override
them with `window.AFS_BEAM_CONFIG` before that script runs, or pass matching
URL query keys; query values take precedence. For example,
`beam-segments.html?maxRangeM=300&sectorCount=31` displays a 300 m grid with
31 sectors. The default count follows the revised provisional `0x310`
10-sector proposal. `trimmedSectorsPerSide` defaults to 3; change it together
with `sectorCount` when exploring another boundary layout. The angle spans and beam footprints are visualization design
assumptions, not published Audi specifications. The default low-beam range,
half-angle, and maximum swivel can be explored with `lowBeamRangeM`,
`lowBeamHalfAngleDeg`, and `maxSwivelDeg` overrides. Dashboard limits and its
starting speed use `maxSteeringWheelDeg`, `maxSpeedKmh`, and `initialSpeedKmh`.
The scene has no live
simulator connection. Logical sectors remain separate from matrix pixels and
need physical column/row calibration. MAX7219 intensity is global per matrix;
ADB masking here switches individual pixels on/off. See the
[ADB grid and lamp design](../../docs/architecture/adb-grid-and-lamps.md).

Run the focused lamp geometry and page interaction checks with
`node tools/system_visualization/beam-model.test.cjs`,
`node tools/system_visualization/beam-segments.test.cjs`, and
`node tools/system_visualization/code-timestamp.test.cjs`.

The **Code updated** label beside the view tabs uses the newest modification
time reported by the current HTML page and its local CSS/JavaScript files. It
requests fresh `Last-Modified` metadata from the local viewer server on page
load and displays the time in the browser's local timezone.

## Code graph

The Code graph shows implemented classes and their interactions. Selected entry
functions complete paths through the simulation loop, browser display, and
runner-to-bridge socket. Files and folders are not graph nodes. Layer panels
group nodes by source folder; the bridge panel shows the implemented runner
receiver while CAN behavior remains planned. Dashboard and firmware remain
planned.

## Open System Visualization

From the repository root:

```bash
bash tools/system_visualization/start_system_visualization.sh
```

Open the printed URL (default
`http://127.0.0.1:8000/tools/system_visualization/`) for System Visualization,
then use the top navigation to switch views. Direct pages are
`http://127.0.0.1:8000/tools/system_visualization/system-in-action.html` and
`http://127.0.0.1:8000/tools/system_visualization/beam-segments.html` for
high beam, and add `?mode=low` for low beam. Pass a
port number to use another port. Press Ctrl+C to stop the server. Python 3 is
the only runtime requirement for viewing.

## Explore the Code graph

Click a circle to highlight its direct upstream and downstream connections.
The right panel explains the class or function, lists those connections, and
links to its source. Clicking a class or function with members also expands
smaller circles for its methods or fields; click again to collapse them. Parent
circles have 1.5 times the radius of child circles. Children retain their
parent's color tone. Interaction arrows point in call or data direction;
dashed arrows carry data, and dotted lines attach members. Arrow captions are
shown for direct connections after selecting a node; unrelated nodes and
arrows dim.
Parent circles follow the implemented paths within each layer: runner entry,
controls and scene storage; ego and surrounding extraction into the
combined scene; then the browser server and drawing steps. Their positions are
intentionally loose so arrows and expanded members have room. Search and layer
filters bring matching nodes toward the top while keeping their relative order.

The graph opens at a readable zoom near its first class. Search by class or
component name, or filter by layer/folder. Drag the graph background to pan,
scroll or use +/− to zoom, and choose **Fit** for a whole-map overview. Use
**Reset map** to clear search, filter, focus, and expanded members and return
to the readable view. Press Escape to clear focus.

## Follow A Functionality

The **Functionalities** section on the right lists seven implemented paths:
runner startup, ego extraction, surrounding extraction, scene
publication, browser display, manual driving control, and runner-to-bridge IPC. Select one to expand
the required members, focus the start of its route, and light up numbered
action arrows.
The action list shows the function or class at each end, the values passed,
and a source link. Select an action to focus its starting node and nearby
connection; pan to follow longer paths. Select the same
functionality or **Clear** to remove its highlights. The ordinary graph remains
available for clicking, expanding, searching, filtering, zooming, and panning.
Selecting a path temporarily clears search and layer filters so all its nodes
are visible; clearing the path restores those controls.

Parent nodes and expanded members have wider spacing so their connecting
arrows remain readable.

## Maintenance And Verification

`graph-data.js` contains curated classes, members, implemented interactions,
layer metadata, and parent positions. `functionality-data.js` contains the
separate, ordered implemented paths. `build_index.py` generates `code-index.js`
for source links and validation. The generated inventory is not displayed as
graph nodes.
After implementing or fixing code, review both curated models against the
change, regenerate the inventory, and run these checks in the same task. See
the [agent maintenance rules](../../agents/code_visualize.md) for what to
update when calls, arguments, behavior, or implementation status change.
The visitor illustration describes the target system and does not add planned IPC,
CAN, or firmware behavior to the implemented Code graph paths.

```bash
python3 tools/system_visualization/build_index.py
python3 tools/system_visualization/build_index.py --check
node tools/system_visualization/validate.mjs
node --check tools/system_visualization/graph-data.js
node --check tools/system_visualization/code-index.js
node --check tools/system_visualization/viewer.js
node --check tools/system_visualization/functionality-data.js
node --check tools/system_visualization/functionality-overlay.js
node --check tools/system_visualization/validate.mjs
```
