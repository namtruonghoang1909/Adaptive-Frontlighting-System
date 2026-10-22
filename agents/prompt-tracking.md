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

### 2026-10-22 - Remove An ADB Preview Beam Sector

**User prompt**

User asked for the Dashboard high-beam ADB demonstration to show a sector of
light actually missing instead of a road-colored trapezoid placed over a full
beam.

**Agent changes**

- Reworked the center preview to draw the low-beam base and high-beam fans
  separately. ADB mode omits a right-side high-beam fan sector around a small
  sample vehicle, so the road shows through the unlit area. Other lighting
  modes retain their intended previews.
- Updated Dashboard descriptions, working context, and the Code graph node and
  functionality summary to match the preview behavior.

**Files modified**

- `dashboard/src/afs_dashboard/app/window.py`, `dashboard/README.md`,
  `dashboard/src/afs_dashboard/app/README.md`,
  `docs/architecture/components/dashboard.md`, `agents/working-context.md`,
  `agents/prompt-tracking.md`,
  `tools/system_visualization/code-graph/graph-data.js`,
  `tools/system_visualization/code-graph/functionality-data.js`, and
  `tools/system_visualization/code-graph/code-index.js`.

**Verification**

- Python compilation, Code graph inventory freshness and validation (184 source
  nodes, 55 visible nodes, 58 interactions, seven layers, nine paths),
  JavaScript syntax, Markdown links/fences, and Git whitespace checks passed.
  The native window could not be visually inspected without a graphical session.

### 2026-10-21 - Fix Beam And Scrolling; Complete Non-CAN Bridge Path

**User prompt**

User reported that the lighting beams appeared to come from the car's sides,
asked for mouse-wheel/trackpad scrolling, and asked to finish the bridge. They
clarified that this branch should complete non-CAN bridge work and defer
SocketCAN until the adapter arrives.

**Agent changes**

- Moved the car and beam origins so light projects from front lamps ahead of
  the vehicle. Bound wheel and Linux scroll events across the main Dashboard.
- Extended runner observations and bridge Dashboard status with optional ego
  position/heading, a bounded fresh nearby-vehicle list, and retained request
  IDs for reconnect reconciliation. The UI uses labeled demo fallback when
  source data is stale or invalid.
- Updated IPC contracts, run/architecture guides, working context, branch plan,
  and Code graph. Runtime SocketCAN remains deferred.

**Files modified**

- `dashboard/src/afs_dashboard/app/window.py`,
  `dashboard/src/afs_dashboard/gateway_client/client.py`,
  `simulation_runner/src/ipc_adapter/publisher.py`,
  `bridge/include/afs_bridge/runner_ipc.hpp`,
  `bridge/include/afs_bridge/dashboard_ipc.hpp`,
  `bridge/src/ipc/runner_ipc.cpp`, `dashboard/README.md`, `bridge/README.md`,
  `docs/architecture/runner-bridge-communication.md`,
  `docs/architecture/dashboard-bridge-communication.md`, component guides,
  `README.md`, `docs/development.md`, `agents/working-context.md`,
  `agents/plan/feat-dashboard.md`, `agents/prompt-tracking.md`, and Code graph files.

**Verification**

- Bridge build, Python compile, and Dashboard shell syntax checks passed.
  The Code graph inventory was current (184 nodes), and graph validation passed
  (55 visible nodes, 58 interactions, seven layers, nine paths). JavaScript
  syntax, 155 local links and code fences across 24 Markdown files, and
  `git diff --check` passed. A graphical Tk session was unavailable.

### 2026-10-21 - Reorganize Dashboard Visuals And Controls

**User prompt**

User requested a top surrounding-object view, middle speed and steering meters,
and bottom command controls. The picture between the meters must respond to
mode selection, meter captions must sit below the circles, and mode buttons
must be grey and unavailable when headlights are off.

**Agent changes**

- Reordered the native window into the three sections, drew labeled simulated
  surrounding vehicles, and moved SPEED and STEERING below the meters.
- Added distinct local lighting previews for off, fixed/swivel low beam, and
  full/ADB high beam. The preview updates immediately even when the bridge is
  offline; the bridge result remains separate.
- Disabled and greyed mode controls while power is off, retaining the selected
  mode for the next power-on. Updated user guides, architecture notes, handoff
  context, and the Code graph.

**Files modified**

- `dashboard/src/afs_dashboard/app/window.py`,
  `dashboard/src/afs_dashboard/models/state.py`,
  `dashboard/src/afs_dashboard/gateway_client/client.py`,
  `dashboard/README.md`, `dashboard/src/afs_dashboard/app/README.md`,
  `docs/architecture/components/dashboard.md`, `README.md`,
  `agents/plan/feat-dashboard.md`, `agents/working-context.md`,
  `agents/prompt-tracking.md`,
  `tools/system_visualization/code-graph/graph-data.js`,
  `tools/system_visualization/code-graph/functionality-data.js`, and
  `tools/system_visualization/code-graph/code-index.js`.

**Verification**

- Syntax, inventory freshness, graph validation, Markdown links/fences, and
  whitespace checks are reported in the task handoff. The Dashboard window
  normally remains open until closed; the user's one-hour shell timeout is
  consistent with an interactive GUI staying open.

### 2026-10-21 - Launch Dashboard And Connect Bridge IPC

**User prompt**

User requested a Dashboard start script and chose to implement Dashboard-to-bridge
communication on `feat/dashboard` now. The native window and combined launcher
decision from the prior prompt still apply.

**Agent changes**

- Added `dashboard/scripts/start_dashboard.sh` for the native window.
- Added a separate Dashboard `SOCK_SEQPACKET` server in the C++ bridge and a
  reconnecting Python client. Mode/power requests are stored by the bridge;
  clear-fault is rejected until ECU control exists. Fresh runner speed/steering
  reaches the UI; other ego and ECU values remain labeled simulated.
- Updated run guides, protocol/architecture docs, branch context, and the Code
  graph for the implemented request/status path.

**Files modified**

- `dashboard/scripts/start_dashboard.sh`,
  `dashboard/src/afs_dashboard/gateway_client/client.py`,
  `dashboard/src/afs_dashboard/app/window.py`,
  `bridge/include/afs_bridge/dashboard_ipc.hpp`,
  `bridge/include/afs_bridge/runner_ipc.hpp`,
  `bridge/src/ipc/runner_ipc.cpp`, `bridge/src/app/runner_bridge_main.cpp`,
  `bridge/CMakeLists.txt`, `docs/architecture/dashboard-bridge-communication.md`,
  `dashboard/README.md`, `bridge/README.md`, `README.md`, `docs/development.md`,
  architecture/component guides, `agents/working-context.md`,
  `agents/plan/feat-dashboard.md`, `agents/prompt-tracking.md`, and Code graph files.

**Verification**

- Bridge build, Dashboard syntax, launcher shell syntax and `--help` passed.
  A manual bridge/Dashboard IPC smoke passed for handshake, accepted mode/power,
  rejected clear-fault, and live runner speed/steering. Final graph and
  documentation checks are recorded in the task handoff.

### 2026-10-21 - Convert Dashboard To A Native Window

**User prompt**

User clarified that the Dashboard should run as a program window rather than
through a localhost port. They want a future `start_system` command to open
MetaDrive and the Dashboard together, and chose to add that combined launcher
later.

**Agent changes**

- Replaced the Dashboard browser/HTTP layer with a Tkinter instrument cluster
  and a second native detailed-status window. Mode, power, and clear-fault
  controls call the existing local demo model directly.
- Updated the Dashboard entry point, run guidance, architecture, branch plan,
  and Code graph to describe the native window and future combined launcher.
- Removed the Dashboard-specific HTTP server and static browser assets.

**Files modified**

- `dashboard/pyproject.toml`, `dashboard/src/afs_dashboard/__main__.py`,
  `dashboard/src/afs_dashboard/app/window.py`,
  `dashboard/src/afs_dashboard/app/server.py`,
  `dashboard/src/afs_dashboard/app/static/`, `dashboard/README.md`,
  `dashboard/src/afs_dashboard/app/README.md`, `README.md`,
  `docs/development.md`, `docs/architecture/components/dashboard.md`,
  `docs/architecture/overview.md`, `docs/architecture/data-flow.md`,
  `docs/tools/tools.md`, `agents/roadmap.md`,
  `agents/plan/feat-dashboard.md`, `agents/working-context.md`,
  `agents/prompt-tracking.md`,
  `tools/system_visualization/code-graph/graph-data.js`,
  `tools/system_visualization/code-graph/functionality-data.js`,
  `tools/system_visualization/code-graph/code-index.js`

**Verification**

- Dashboard syntax and `--help` pass with the configured MetaDrive Python;
  Tkinter 8.6 imports there. The Code graph inventory is current with 174
  nodes, and its validator passes with 52 graph nodes, 51 interactions, and
  9 functionality paths. JavaScript syntax, 12 changed Markdown files' links
  and fences, and Git whitespace checks pass. In this shell, launching the
  window reports the expected missing `DISPLAY`; graphical review remains.

### 2026-10-21 - Restyle Dashboard As A Vehicle Cluster

**User prompt**

User asked for the current Dashboard to look like a real car dashboard, with
speed meters and buttons for selecting headlight modes.

**Agent changes**

- Replaced the two-tab console page with a car-style cluster: speedometer,
  steering dial, central lighting display, direct mode buttons, and power
  control. ECU health, requested mode, and bridge state remain visible.
- Kept illustrative data and local command endpoints. A mode or power change
  immediately sends a local demo command; detailed vehicle/ECU values remain
  available in an expandable section.
- Updated Dashboard documentation, handoff context, and the Code graph path
  and descriptions to match the current UI behavior.

**Files modified**

- `dashboard/src/afs_dashboard/app/static/index.html`,
  `dashboard/src/afs_dashboard/app/static/dashboard.css`,
  `dashboard/src/afs_dashboard/app/static/dashboard.js`,
  `dashboard/README.md`, `docs/architecture/components/dashboard.md`,
  `README.md`, `agents/plan/feat-dashboard.md`,
  `agents/working-context.md`, `agents/prompt-tracking.md`,
  `tools/system_visualization/code-graph/graph-data.js`,
  `tools/system_visualization/code-graph/functionality-data.js`,
  `tools/system_visualization/code-graph/code-index.js`

**Verification**

- Dashboard JavaScript syntax, 35 unique HTML IDs with all JavaScript ID
  references present, Code graph inventory/validator/syntax checks, and
  `git diff --check` pass. Browser rendering was not inspected in this environment.

### 2026-10-21 - Start The Local Dashboard

**User prompt**

User asked to pause SocketCAN work while the adapter is pending and implement
the Dashboard first. They specified a local browser app showing ego vehicle
data and ECU status, accepting user commands, and using mock values where no
source exists. They then asked to create and switch to a Dashboard branch
before continuing.

**Agent changes**

- Created and switched to `feat/dashboard`, preserving the working tree.
- Added a loopback-only browser Dashboard with User Commands and AFS Status
  sections, local demo command acceptance, simulated ECU execution, ego data,
  a ten-sector proximity grid, faults, source provenance, servo feedback, and dim output.
- Clearly marked all local sample values and command results as demo-only; no
  bridge IPC, CAN traffic, or hardware connection is implemented.
- Documented the local run command and remaining gateway integration work.
- Added Dashboard nodes and its demo control/status flow to the Code graph.

**Files modified**

- `dashboard/README.md`, `dashboard/pyproject.toml`,
  `dashboard/src/afs_dashboard/__main__.py`,
  `dashboard/src/afs_dashboard/app/__init__.py`,
  `dashboard/src/afs_dashboard/app/server.py`,
  `dashboard/src/afs_dashboard/app/README.md`,
  `dashboard/src/afs_dashboard/app/static/index.html`,
  `dashboard/src/afs_dashboard/app/static/dashboard.css`,
  `dashboard/src/afs_dashboard/app/static/dashboard.js`,
  `dashboard/src/afs_dashboard/models/__init__.py`,
  `dashboard/src/afs_dashboard/models/state.py`,
  `dashboard/src/afs_dashboard/models/README.md`,
  `dashboard/src/afs_dashboard/gateway_client/README.md`, `README.md`,
  `docs/development.md`, `docs/architecture/components/dashboard.md`,
  `docs/architecture/data-flow.md`, `docs/architecture/overview.md`,
  `agents/README.md`, `agents/roadmap.md`, `agents/working-context.md`,
  `agents/plan/feat-dashboard.md`, `agents/prompt-tracking.md`,
  `tools/system_visualization/README.md`,
  `tools/system_visualization/code-graph/build_index.py`,
  `tools/system_visualization/code-graph/code-index.js`,
  `tools/system_visualization/code-graph/graph-data.js`,
  `tools/system_visualization/code-graph/functionality-data.js`

**Verification**

- Code inventory freshness, graph validation (182 inventory entries, 57
  curated nodes, 57 interactions, seven layers, nine paths), Python/JavaScript
  syntax checks, Markdown links/fences, and whitespace checks pass. No test
  suite was run. The interactive viewer could not be checked in this session.

### 2026-10-21 - Plan SocketCAN Branch

**User prompt**

User asked for an agents/plan document describing the work planned for the
current feat/bridge/socketcan branch.

**Agent changes**

- Added a branch checklist for integrating the existing CAN encoders with
  production SocketCAN transmit, 0x500 status receive/decode, vcan0 coverage,
  and clean worker lifecycle. Dashboard IPC and runtime 0x400 transmission
  remain out of scope.
- Updated the agent guide and working context to point at the active branch
  plan and retain the CAN-encoding checklist as prior-branch context.
- No runtime implementation was changed.

**Files modified**

- agents/plan/feat-bridge-socketcan.md, agents/README.md,
  agents/working-context.md, agents/prompt-tracking.md

**Verification**

- Documentation links, code fences, and whitespace were checked; no tests or
  runtime checks were run.

### 2026-10-21 - Improve Commit Plan Grouping Rules

**User prompt**

User asked to update the commit planning rule based on corrections to the
recent plan: group by functionality, use smaller coherent commits, and keep a
file in only one commit. They also asked to discuss the next work and branch
name.

**Agent changes**

- Updated `agents/rules/committing.md` to require functionality-based grouping,
  one-commit ownership for each path, accurate file counts, and clear file-list
  headings that distinguish paths from commits. Rename paths stay together in
  one commit.
- Reviewed the bridge roadmap and current implementation status for the next
  work recommendation; no implementation or branch creation was requested.

**Files modified**

- `agents/rules/committing.md`, `agents/prompt-tracking.md`

**Verification**

- `git diff --check` passes. Prompt tracking retains exactly ten entries.

### 2026-10-20 - Verify DBC Frame Encoding With Headless MetaDrive

**User prompt**

User asked to run MetaDrive headless and add a simple logger to check the CAN
encoder output against the agreed DBC.

**Agent changes**

- Added a diagnostic C++ frame logger and shell launcher that receives live
  runner IPC, encodes frames at 20 ms intervals, prints representative IDs,
  payload bytes, and decoded signal values, and captures each batch.
- Added generated-C round-trip checks for every batch and an independent
  cantools verifier that decodes captured bytes against `bridge/can/afs.dbc`.
- Documented the smoke command and recorded the current result. The diagnostic
  path does not open SocketCAN and does not wire encoders into the production
  bridge executable.

**Files modified**

- `bridge/include/afs_bridge/can_frame_logger.hpp`,
  `bridge/src/app/can_frame_logger.cpp`,
  `bridge/src/app/can_frame_logger_main.cpp`,
  `bridge/scripts/run_can_frame_smoke.sh`,
  `bridge/scripts/verify_can_frame_capture.py`, `bridge/CMakeLists.txt`,
  `bridge/README.md`, `bridge/src/can/README.md`, `bridge/tests/README.md`,
  `README.md`, `docs/development.md`, `docs/verification/testing.md`,
  `docs/can/README.md`, `docs/architecture/components/bridge.md`,
  `docs/architecture/data-flow.md`,
  `agents/plan/feat-bridge-can-encoding.md`, `agents/working-context.md`,
  `agents/prompt-tracking.md`,
  `tools/system_visualization/code-graph/build_index.py`,
  `tools/system_visualization/code-graph/code-index.js`,
  `tools/system_visualization/code-graph/graph-data.js`,
  `tools/system_visualization/code-graph/functionality-data.js`

**Verification**

- Headless MetaDrive 0.4.3 completed 10 steps with 11 valid scenes. The logger
  encoded 48 scheduled batches (144 frames); generated C round-trip checks
  passed for every batch, and cantools matched all 144 frames to the DBC with
  reserved fields zero. The sample `0x300` payload was `00 01 00 00 00 C0 39 00`.
- The logger target built; shell and Python syntax checks passed. Code graph,
  inventory freshness (163 nodes), graph validation (49 visible nodes, 48
  interactions, seven layers, eight paths), JavaScript syntax, 95 Markdown
  links across 12 checked files, and `git diff --check` passed. A Firefox
  screenshot could not be captured: the existing profile was unresponsive and
  a separate headless profile timed out on the compositor framebuffer error.
