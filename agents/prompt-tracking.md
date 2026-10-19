# Prompt Tracking

This file keeps the latest 10 user prompts that changed project context, files, or decisions.
Future agents should read this file with the rest of `agents/` before making changes.

## Maintenance Rules

- Keep entries newest first.
- Keep only the latest 10 entries; remove the oldest entry when adding an 11th.
- Record the user's prompt, what the agent changed, and any verification or blockers.
- Include files modified using repo-relative paths.
- If a prompt only asks a question and nothing changes, add it only when the answer affects future work.

## Entries

### 2026-10-19 - Rename The System Visualization Launcher

**User prompt**

User pointed out that the Code graph is one part of System Visualization and
asked to rename the start command accordingly.

**Agent changes**

- Renamed the launcher to `start_system_visualization.sh` and updated the
  command, script index, and viewer descriptions across project documentation
  and agent working context.
- Regenerated the source inventory for the new script path.

**Files modified**

- `tools/system_visualization/start_code_graph.sh` (renamed to
  `start_system_visualization.sh`), `tools/system_visualization/code-index.js`
- `README.md`, `tools/README.md`, `tools/system_visualization/README.md`,
  `docs/development.md`, `agents/working-context.md`,
  `agents/prompt-tracking.md`

**Verification**

- Launcher syntax and help output, source-inventory freshness, graph
  validation, documentation links/fences, and Git whitespace checks pass.

### 2026-10-19 - Put Project Design Before Tools In Root README

**User prompt**

User asked to describe the project design, system components, visuals, and
hardware before introducing tools such as the Code graph.

**Agent changes**

- Reorganized the README to lead with system design, an explicit component and
  hardware table, the matrix-beam design, and the high/low-beam visual gallery.
- Moved Code graph and viewer instructions into a later Development tools
  section and kept the real hardware photo placeholder and concept-view note.

**Files modified**

- `README.md`, `agents/prompt-tracking.md`

**Verification**

- Markdown links and fenced code blocks, prompt-history limit, and Git
  whitespace checks pass. No source code changed.

### 2026-10-18 - Show Code Update Time And Reduce Swivel Imbalance

**User prompt**

User asked for an updated-code timestamp beside the visualization tabs so a
reload makes the served version easier to identify. They also asked to keep
the overall swivel modest while making the outside matrix turn much farther
than the inside matrix.

**Agent changes**

- Added a shared **Code updated** label beside the tabs on all three pages. It
  checks the page and its local CSS/JavaScript `Last-Modified` headers without
  using cached metadata, then shows the newest time in local time.
- Reduced the low-beam outside-matrix limit from 8° to 6° and changed the
  inside matrix to one third of that target. Full wheel input now gives
  outside/inside angles of 6°/2° at 0 km/h, 3.75°/1.25° at 60 km/h, and
  1.5°/0.5° at 120 km/h.
- Updated the preview, tests, root README, viewer guide, headlight and hardware
  design notes, and working context.

**Files modified**

- `tools/system_visualization/code-timestamp.js`, `code-timestamp.test.cjs`,
  `index.html`, `system-in-action.html`, `beam-segments.html`, `styles.css`,
  `beam-model.js`, `beam-model.test.cjs`, `beam-segments.js`,
  `beam-segments.test.cjs`, `code-index.js`
- `README.md`, `tools/system_visualization/README.md`,
  `docs/architecture/adb-grid-and-lamps.md`,
  `docs/architecture/components/headlights.md`, `docs/hardware/hardware.md`,
  `agents/working-context.md`, `agents/prompt-tracking.md`

**Verification**

- All 10 beam geometry tests, 12 preview interaction tests, and 4 timestamp
  tests pass. Inventory freshness passes at 125 nodes; graph validation passes
  with 43 visible nodes, 40 interactions, seven layers, and seven paths.
  JavaScript syntax, Markdown link/fence checks, and Git whitespace checks pass.
- Local HTTP server startup was denied by the sandbox, so browser rendering and
  real HTTP header behavior could not be reviewed here. Unit checks cover the
  timestamp metadata selection and page wiring. The curated graph and paths
  remain unchanged because this work adds viewer status and adjusts preview
  geometry, not an AFS runtime path.

### 2026-10-18 - Reduce And Split Low-Beam Swivel

**User prompt**

User asked for different left/right matrix swivel angles, with the inside lamp
turning less, and a smaller overall response at higher speed.

**Agent changes**

- Reduced the preview's maximum outside-matrix swivel from 12° to 8°.
- Set the inside matrix to 65% of the outside angle. A left turn now moves the
  left matrix less than the right; right turns mirror the behavior.
- Made speed reduce the outer target to 62.5% at half speed and 25% at maximum
  speed. The dashboard now shows each matrix angle separately.
- Updated the root README, visualization guide, headlight and ADB design docs,
  hardware guide, and working context.

**Files modified**

- `tools/system_visualization/beam-model.js`, `beam-model.test.cjs`,
  `beam-segments.js`, `beam-segments.html`, `beam-segments.test.cjs`
- `tools/system_visualization/code-index.js`
- `README.md`, `tools/system_visualization/README.md`,
  `docs/architecture/adb-grid-and-lamps.md`,
  `docs/architecture/components/headlights.md`, `docs/hardware/hardware.md`,
  `agents/working-context.md`, `agents/prompt-tracking.md`

**Verification**

- The beam model tests (10) and page interaction tests (12) pass. JavaScript
  syntax, Code inventory freshness (124 nodes), graph validation (43 visible
  nodes, 40 interactions, seven layers, seven paths), and Git whitespace
  checks pass. Markdown links and fences pass in all seven updated documents.
  The curated graph and functionality paths are unchanged because this behavior
  belongs to the visualization model, not the AFS runtime graph.

### 2026-10-18 - Revise README Visual Gallery For Reader Scenarios

**User prompt**

User asked to remove System in Action concept imagery from the root README,
leave a blank spot for a real hardware photo, and include two high-beam and two
low-beam scenario pictures for a quick project overview.

**Agent changes**

- Removed the concept render from the README and left a marked slot for a photo
  of the built hardware. Kept a text link to System in Action as a design-only
  concept view.
- Added four named README screenshot slots: one and two cars in high beam, and
  full right steering at 50 and 10 km/h in low beam.
- Retried after `snapd.apparmor` became active. Firefox still reports
  `RenderCompositorSWGL failed mapping default framebuffer` and times out even
  on `about:blank`, so it cannot capture the four preview states in this shell.

**Files modified**

- `README.md`, `agents/prompt-tracking.md`

**Verification**

- Confirmed screenshot slots and the real-system photo placeholder in the
  README. Tested Firefox on both the AFS page and a blank page; the headless
  graphics backend failed, so no screenshot files were produced.

### 2026-10-18 - Remove Unrelated Root Installer And Empty Folder

**User prompt**

User asked for a quick file and folder review and to delete items that are spare
or unrelated to current project work.

**Agent changes**

- Removed the untracked root `fix-npm.sh`, a machine-level helper that changes
  global npm directory ownership and installs Codex; it is unrelated to AFS.
- Removed the empty root `tests/` directory. The component test directories
  remain in place.
- Kept `build/bridge` because the run guides use its built receiver, kept both
  bench images because the System in Action page uses them, and kept the empty
  `firmware/` component directory because firmware is part of the planned rig.

**Files modified**

- `fix-npm.sh` (deleted), empty `tests/` directory (removed),
  `agents/prompt-tracking.md`

**Verification**

- Confirmed the npm script contents, checked file references and ignored build
  status, and verified the root `tests/` directory was empty. No tests were run.

### 2026-10-18 - Refresh Root README For Two-Matrix Design

**User prompt**

User asked for the root README to reflect the agreed design and explain it more
visually, with placeholders where they can later paste screenshots of the
System Visualization tabs.

**Agent changes**

- Reorganized the root README around the current two-matrix architecture,
  explicit implemented/planned boundaries, an 8×8 row diagram, and a low/high
  beam comparison table.
- Embedded the existing bench concept render and added clearly marked,
  copy-ready screenshot placeholders for all four visualization tabs.
- Kept the viewer, simulation, test, and documentation entry points visible.

**Files modified**

- `README.md`, `agents/prompt-tracking.md`

**Verification**

- README links, code fences, screenshot asset path, stale names, and Git
  whitespace were checked. No runtime code changed.

### 2026-10-18 - Add Low-Beam Driving Dashboard And Speed Response

**User prompt**

User asked for a steering wheel and adjustable speed bar in the Low beam
visual tab, with a simple algorithm that changes swivel behavior by speed
while the car stays fixed.

**Agent changes**

- Added a low-beam dashboard with a rotating steering wheel drawing, wheel
  slider, draggable speed bar, speed readout, response percentage, and actual
  matrix swivel readout. The high-beam tab keeps the dashboard hidden and
  both matrices centered.
- Added a preview rule: clamp wheel input to ±90° and speed to 0–120 km/h,
  then set yaw to `(wheel / 90°) × 12° × (1 − 0.5 × speed / 120)`. Full wheel
  input gives 12° at 0 km/h, 9° at 60 km/h, and 6° at 120 km/h. The road and
  ego car remain stationary. These are illustrative values, not ECU firmware.
- Updated the viewer, project, component, hardware, mapping, tool, and agent
  guides. Regenerated the Code graph inventory; the curated graph and
  functionality paths remain unchanged because the dashboard is preview
  tooling rather than an implemented AFS runtime path.

**Files modified**

- `tools/system_visualization/beam-model.js`, `beam-model.test.cjs`,
  `beam-segments.html`, `beam-segments.css`, `beam-segments.js`,
  `beam-segments.test.cjs`, `code-index.js`,
  `tools/system_visualization/README.md`
- `README.md`, `docs/tools/tools.md`,
  `docs/architecture/components/headlights.md`,
  `docs/architecture/adb-grid-and-lamps.md`, `docs/hardware/visual.md`,
  `agents/working-context.md`, `agents/prompt-tracking.md`

**Verification**

- Twelve page interaction tests and ten lamp-model tests pass, including
  speed response, wheel direction, full-swivel viewport, fixed car position,
  high-beam centering, and configurable dashboard limits.
- Inventory freshness passes at 124 nodes; graph validation passes with 43
  visible nodes, 40 interactions, seven layers, and seven functionality paths.
  JavaScript syntax and Git whitespace checks pass. Browser screenshot review
  remains unavailable in this shell; interaction tests cover the dashboard.

### 2026-10-18 - Zoom Low-Beam Road Preview

**User prompt**

User asked to zoom in the Low beam visual because its 40 m shine occupied too
little of the 100 m road map.

**Agent changes**

- Cropped the low-beam SVG view to the first 60 m by default and narrowed the
  view width so the beam appears 25% larger on screen. The high-beam view and
  light geometry remain unchanged. The crop width accounts for both full
  steering extremes to keep the beam visible.
- Moved the low-beam range cap, sector labels, and grid debug panel into the
  close-up. Updated the range readout and explanatory text to identify the
  visible depth and note that farther vehicles leave the frame.
- Updated the project, tool, and agent context guides. Regenerated the Code
  graph inventory; curated graph and functionality paths remain unchanged
  because the zoom affects only explanatory preview tooling.

**Files modified**

- `tools/system_visualization/beam-segments.js`, `beam-segments.test.cjs`,
  `code-index.js`, `tools/system_visualization/README.md`
- `README.md`, `agents/working-context.md`, `agents/prompt-tracking.md`

**Verification**

- Ten page interaction tests and nine lamp geometry tests pass. The new test
  checks the low-beam viewport, range label, and both full-swivel footprints.
- Inventory freshness passes at 124 nodes; graph validation passes with 43
  visible nodes, 40 interactions, seven layers, and seven functionality paths.
  JavaScript syntax and Git whitespace checks pass. Graphical browser review
  remains unavailable in this shell; DOM geometry tests cover the close-up.

### 2026-10-18 - Split High And Low Beam Visuals With Swivel

**User prompt**

User asked to move the MAX7219 matrix display left of the road grid, rename
Beam Segments to High beam visual, add a Low beam visual with shorter and wider
light that swivels, and make the two-tab architecture explicit in the docs.
High mode centers both matrices and lights rows 1–4 above the always-on low
rows 5–8; low mode lights only rows 5–8 and permits swivel.

**Agent changes**

- Moved both matrix displays into the road card's left column and added High
  beam visual and Low beam visual navigation. The shared map now draws a
  100 m / ±10° high beam and 40 m / ±18° low beam with a steering slider for
  up to ±12° of low-beam swivel.
- Kept rows 5–8 lit in both tabs; rows 1–4 and ADB masking are active only in
  high mode. Both matrix platforms stay centered in high mode. Updated the
  project, tool, architecture, hardware, CAN, and agent context documents to
  describe these mode rules and distinguish preview values from firmware.
- Regenerated the Code graph inventory. Its curated graph and functionality
  paths remain unchanged because the visual tabs are explanatory tooling,
  not an implemented AFS runtime path.

**Files modified**

- `tools/system_visualization/beam-segments.html`, `beam-segments.css`,
  `beam-segments.js`, `beam-segments.test.cjs`, `index.html`,
  `system-in-action.html`, `styles.css`, `code-index.js`,
  `tools/system_visualization/README.md`, `tools/README.md`
- `README.md`, `docs/tools/tools.md`, `docs/development.md`,
  `docs/architecture/overview.md`, `docs/architecture/adb-grid-and-lamps.md`,
  `docs/architecture/components/headlights.md`,
  `docs/architecture/components/afs-ecu.md`,
  `docs/hardware/hardware.md`, `docs/hardware/visual.md`,
  `docs/can/messages/0x100_AFS_Status.md`,
  `docs/can/messages/0x310_Vehicle_Object.md`,
  `agents/working-context.md`, `agents/prompt-tracking.md`

**Verification**

- Nine page interaction tests and nine lamp geometry tests pass. JavaScript
  syntax and Git whitespace checks pass. Markdown links and fences pass for
  45 files; IDs are unique across three viewer pages.
- Inventory freshness passes at 124 nodes. Graph validation passes with 43
  visible nodes, 40 interactions, seven layers, and seven functionality paths.
  A graphical screenshot was unavailable in this shell; page interaction tests
  cover DOM geometry and control behavior.
