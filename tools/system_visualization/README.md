# System Visualization

This tool has six tabs. **Code graph** maps implemented classes and calls.
**System in Action** illustrates the target prototype on a plain table.
**High beam visual** shows centered matrices and adaptive masking.
**Low beam visual** shows shorter, wider light that follows steering.
**CAN messages** maps every payload bit and explains each signal in the documented frames.
**Hardware wiring** shows component symbols, candidate pins, and selectable wire routes.

Run `bash tests/scripts/test_visualization.sh` from the repository root after
changing a page, model, or graph. It runs the model tests, JavaScript syntax
checks, and Code graph validation. To run one module, use for example
`bash tests/scripts/test_visualization.sh beam_model`. The full list is in the
[component test guide](../../tests/scripts/test_guide.md).

## Folder Layout

```text
tools/system_visualization/
├── code-graph/       Code graph page, model, inventory, and validator
├── beam-visual/      High/low beam page and lamp model
├── can-messages/     CAN frame reference page
├── hardware-wiring/  Pin-level bench wiring illustration and connection explorer
├── system-in-action/ Static hardware illustration and artwork
├── shared/           Common page styles and timestamp loader
├── index.html        Redirect to the Code graph
└── start_system_visualization.sh
```

Visualization tests are grouped by module under the repository-root
[`tests/visualization/`](../../tests/visualization/) tree.

The root `beam-segments.html` and `system-in-action.html` are small redirects
kept for existing links. New links should point to the folders above.

## System in Action

Open the [visitor 3D view](system-in-action/index.html) after starting the local
server below, or choose **System in Action** in the top navigation. The setup
runs left to right: a laptop displaying MetaDrive, a USB-CAN controller, CAN H
and CAN L through a shared breadboard, the STM32 ECU with its CAN transceiver,
and one MAX7219 8×8 LED matrix module per headlight. Each matrix uses its lower
four rows for low beam and its upper four rows for high beam and ADB masking.

The fixed example shows a white vehicle ahead and to the left of the red ego
car. Its LED pattern is a static illustration, not a computed mapping. For the
two-lamp overlap and response to moving vehicles, use **High beam visual**. The
Python runner and C++ bridge occupy separate
processes on the same laptop. Runner-to-bridge socket IPC and the host-side
SocketCAN conversion/runtime are implemented; ECU lighting behavior remains
planned.

The page uses a static 3D render with a local MetaDrive screen composite. It works without
JavaScript and has no playback, moving objects, or runtime data connection.
The Code graph and other views use the same local server.

## Hardware Wiring

Open [Hardware wiring](hardware-wiring/index.html) to trace the planned bench
connections from the Linux host and USB-CAN adapter through the STM32 ECU, servo
driver, feedback servos, and matrix modules. The light-grid canvas uses component
symbols, reference labels, pin names, and orthogonal colored wires. Select a net
to highlight its pins and wire runs and inspect the corresponding pin-to-pin row.
Filled dots mark connected wire branches; crossings without dots are separate.

This is a candidate schematic, not a build-ready wiring plan. Exact board
header positions, adapter and breakout models, pinouts, supplies, logic-level
interfaces, and termination still need verification. Candidate assignments and
open checks are tracked in the [wiring draft](../../docs/hardware/wiring-draft.md).
The matrix design uses one shared SPI2 clock/data bus and an individual GPIO
LOAD line per MAX7219; LOAD is the latch input, though some breakouts label it
`CS`. The current power plan uses the board's USB-C-fed 5 V rail for both
matrix modules; its source and header current capacity still need confirmation.
The current prototype choice connects 3.3 V STM32 SCK, MOSI, and LOAD signals
directly to the bare MAX7219 inputs for bench validation. At 5 V the specified
minimum logic-high input is 3.5 V, so direct operation is below guaranteed
specification; verify it on the bench and add a compatible buffer if needed.

## CAN Messages

Open [CAN messages](can-messages/index.html) for a quick reference to the five
documented frames: `0x100`, `0x200`, `0x300`, `0x400`, and `0x500`. Each frame
starts with a byte map divided into individual bit cells; arrows link the bits
to their signal names. The table below lists every signal or bit name, byte and
bit position, meaning, and sample value decoded from the example payload. The
`0x300` table lists each sector's occupancy bit and all four mask bits with
exact positions. This is a static design reference, not a live CAN monitor;
the detailed specifications remain in
[docs/can](../../docs/can/README.md).

## High And Low Beam Visuals

Open [High beam visual](beam-visual/beam-segments.html) or
[Low beam visual](beam-visual/beam-segments.html?mode=low) after starting the local server.
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
farther: 1. The 10-sector `0x300` design reports occupancy plus four near-to-far
distance bands, but no vehicle-height bounds, so this is only a coarse vertical
approximation, not an object-shaped shadow calculation.
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

All numeric values come from the defaults in `beam-visual/beam-segments.js`. Override
them with `window.AFS_BEAM_CONFIG` before that script runs, or pass matching
URL query keys; query values take precedence. For example,
`beam-visual/beam-segments.html?maxRangeM=300&sectorCount=31` displays a 300 m grid with
31 sectors. The default count follows the revised provisional `0x300`
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
`bash tests/scripts/test_components.sh visualization/beam_model`,
`bash tests/scripts/test_components.sh visualization/beam_segments`,
`bash tests/scripts/test_components.sh visualization/code_timestamp`, and
`bash tests/scripts/test_components.sh visualization/can_messages`.

The **Code updated** label beside the view tabs uses the newest modification
time reported by the current HTML page and its local CSS/JavaScript files. It
requests fresh `Last-Modified` metadata from the local viewer server on page
load and displays the time in the browser's local timezone.

## Code graph

The Code graph shows implemented classes and their interactions. Selected entry
functions complete paths through the simulation loop, browser display, and
runner-to-bridge socket. Files and folders are not graph nodes. Layer panels
group nodes by source folder; the bridge panel shows runner and Dashboard IPC
servers, the production SocketCAN runtime, frame conversion, and ECU status
decoder. The Dashboard panel shows the native window, reconnecting client, live
ECU status mapping, and simulated fallback model; firmware remains planned.

## Open System Visualization

From the repository root:

```bash
bash tools/system_visualization/start_system_visualization.sh
```

Open the printed URL (default
`http://127.0.0.1:8000/tools/system_visualization/`) to go to the Code graph,
then use the top navigation to switch views. Direct pages are
`http://127.0.0.1:8000/tools/system_visualization/system-in-action/index.html` and
`http://127.0.0.1:8000/tools/system_visualization/beam-visual/beam-segments.html` for
high beam; add `?mode=low` for low beam. Open
`http://127.0.0.1:8000/tools/system_visualization/can-messages/` for CAN layouts or
`http://127.0.0.1:8000/tools/system_visualization/hardware-wiring/` for wiring.
Pass a port number to use another port. Press Ctrl+C to stop the server. Python 3
is the only runtime requirement for viewing.

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

The **Functionalities** section on the right lists eleven implemented paths:
runner startup, ego extraction, surrounding extraction, scene publication,
browser display, manual driving control, runner-to-bridge IPC, the CAN frame
smoke path, production SocketCAN, the Dashboard CAN command/status roundtrip,
and native Dashboard bridge IPC. Select one to expand
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

`code-graph/graph-data.js` contains curated classes, members, implemented interactions,
layer metadata, and parent positions. `code-graph/functionality-data.js` contains the
separate, ordered implemented paths. `code-graph/build_index.py` generates `code-graph/code-index.js`
for source links and validation. The generated inventory is not displayed as
graph nodes.
After implementing or fixing code, review both curated models against the
change, regenerate the inventory, and run these checks in the same task. See
the [agent maintenance rules](../../agents/code_visualize.md) for what to
update when calls, arguments, behavior, or implementation status change.
The visitor illustration describes the target system and does not add planned IPC,
CAN, or firmware behavior to the implemented Code graph paths.

```bash
python3 tools/system_visualization/code-graph/build_index.py
python3 tools/system_visualization/code-graph/build_index.py --check
node tools/system_visualization/code-graph/validate.mjs
node --check tools/system_visualization/code-graph/graph-data.js
node --check tools/system_visualization/code-graph/code-index.js
node --check tools/system_visualization/code-graph/viewer.js
node --check tools/system_visualization/code-graph/functionality-data.js
node --check tools/system_visualization/code-graph/functionality-overlay.js
node --check tools/system_visualization/code-graph/validate.mjs
```
