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

### 2026-10-23 - Continue Firmware CAN On Bridge ECU Branch

**User prompt**

User renamed the current branch to `feat/bridge-ecu/can`, decided to develop
Bridge CAN and firmware CAN on the same branch for joint debugging, and asked
to commit the host-side Bridge CAN work before starting firmware implementation.

**Agent changes**

- Renamed the local branch; it has no upstream and has not been pushed.
- Updated the current handoff to use the new branch name and record firmware as
  the next phase on this branch.
- Prepared a seven-commit host-side sequence for review before staging or
  committing, as required by the repository commit rules.

**Files modified**

- `agents/plan/feat-bridge-socketcan.md`
- `agents/prompt-tracking.md`
- `agents/roadmap.md`
- `agents/working-context.md`

**Verification**

- Confirmed the local branch name and preserved the working tree. No tests were
  rerun for this commit-planning step.

### 2026-10-22 - Complete Dashboard CAN Command And Status Path

**User prompt**

User asked to implement the remaining CAN work: transmit Dashboard `0x400`,
forward decoded `0x500` status to the Dashboard, add conversion/decoder and
vcan integration coverage, and verify the physical adapter where possible.
User selected `CommandValid` to remain true while the Dashboard is connected,
then clarified that the USB-CAN adapter has not arrived and wants the laptop
implementation ready before delivery so hardware checks can run immediately.

**Agent changes**

- Added `0x400 Dashboard_Command` packing with XOR checksum and mode validation;
  production CAN sends it every 50 ms, leases `CommandValid` to an active
  Dashboard connection, and queues clear-fault for one successful SocketCAN
  write. CAN-disabled clear-fault requests are rejected.
- Forwarded validated `0x500` status to Dashboard IPC, including decoded mode,
  health, fault flags, feedback, applied sector mask, age, and freshness.
  Dashboard now displays live ECU values and clearly labels simulated fallback
  and stale status.
- Added pure Linux `can_frame` conversion, encoder/decoder/status/Dashboard IPC
  tests, Dashboard mapping coverage that distinguishes requested from executed
  mode, and an opt-in actual-process vcan test.
- Updated CAN, IPC, architecture, development, hardware, roadmap, branch-plan,
  working-context, and Code graph documentation and models.
- Added ready-to-follow SocketCAN setup and physical bus verification steps to
  the hardware guide.
- Bridge CTest passes 8/8; standalone Dashboard status tests pass 4/4. The vcan
  test builds but could not run: this host has no CAN interface and denies
  `CAP_NET_ADMIN` when creating `vcan0`. Physical adapter/ECU verification is
  pending hardware access.

**Files modified**

- `README.md`
- `agents/plan/feat-bridge-can-encoding.md`
- `agents/plan/feat-bridge-socketcan.md`
- `agents/prompt-tracking.md`
- `agents/roadmap.md`
- `agents/working-context.md`
- `bridge/CMakeLists.txt`
- `bridge/README.md`
- `bridge/can/afs.dbc`
- `bridge/include/afs_bridge/can_encoder.hpp`
- `bridge/include/afs_bridge/can_frame_encoder.hpp`
- `bridge/include/afs_bridge/dashboard_ipc.hpp`
- `bridge/src/app/README.md`
- `bridge/src/app/runner_bridge_main.cpp`
- `bridge/src/can/README.md`
- `bridge/src/can/can_frame_encoder.cpp`
- `bridge/src/can/generated/afs.c`
- `bridge/src/can/generated/afs.h`
- `bridge/src/ipc/runner_ipc.cpp`
- `bridge/tests/README.md`
- `bridge/tests/runner_ipc_end_to_end.py`
- `dashboard/README.md`
- `dashboard/src/afs_dashboard/app/README.md`
- `dashboard/src/afs_dashboard/app/window.py`
- `dashboard/src/afs_dashboard/gateway_client/README.md`
- `dashboard/src/afs_dashboard/gateway_client/client.py`
- `dashboard/tests/README.md`
- `docs/README.md`
- `docs/architecture/components/afs-ecu.md`
- `docs/architecture/components/bridge.md`
- `docs/architecture/components/dashboard.md`
- `docs/architecture/dashboard-bridge-communication.md`
- `docs/architecture/data-flow.md`
- `docs/architecture/overview.md`
- `docs/architecture/runner-bridge-communication.md`
- `docs/can/README.md`
- `docs/can/messages/0x100_Vehicle_Speed.md`
- `docs/can/messages/0x200_Vehicle_Steering.md`
- `docs/can/messages/0x300_Vehicle_Object.md`
- `docs/can/messages/0x400_Dashboard_Command.md`
- `docs/can/messages/0x500_AFS_Status.md`
- `docs/development.md`
- `docs/hardware/hardware.md`
- `docs/verification/testing.md`
- `docs/tools/tools.md`
- `tools/system_visualization/README.md`
- `tools/system_visualization/can-messages/can-messages.js`
- `tools/system_visualization/can-messages/index.html`
- `tools/system_visualization/code-graph/build_index.py`
- `tools/system_visualization/code-graph/code-index.js`
- `tools/system_visualization/code-graph/functionality-data.js`
- `tools/system_visualization/code-graph/graph-data.js`
- `tools/system_visualization/tests/can-messages.test.cjs`
- `bridge/include/afs_bridge/afs_status.hpp`
- `bridge/include/afs_bridge/can_runtime.hpp`
- `bridge/include/afs_bridge/socketcan_frame.hpp`
- `bridge/include/afs_bridge/socketcan_transport.hpp`
- `bridge/src/app/can_runtime.cpp`
- `bridge/src/can/afs_status.cpp`
- `bridge/src/can/socketcan_frame.cpp`
- `bridge/src/can/socketcan_transport.cpp`
- `bridge/tests/afs_status_test.cpp`
- `bridge/tests/can_frame_encoder_test.cpp`
- `bridge/tests/dashboard_ipc_integration.cpp`
- `bridge/tests/socketcan_frame_test.cpp`
- `bridge/tests/socketcan_vcan_end_to_end.py`
- `dashboard/tests/test_gateway_status.py`

**Verification**

- Bridge configure/build and CTest: 8/8 passed.
- `PYTHONPATH=dashboard/src python3 dashboard/tests/test_gateway_status.py`:
  4/4 passed.
- Optional vcan configuration/build succeeded; runtime execution is unavailable
  on this host. Physical adapter verification remains pending.
- Code graph inventory freshness and validation pass (200 inventory nodes,
  60 graph nodes, 70 interactions, seven layers, 11 paths). Headless Firefox
  review confirmed graph rendering, conversion node details/source link,
  direct-connection highlighting, functionality selection/clearing, search,
  Dashboard layer filtering, class expansion, zoom, and pan. Markdown
  link/fence checks passed on 33 changed Markdown files; whitespace checks pass.

### 2026-10-22 - Adjust CAN Message Periods

**User prompt**

User agreed to transmit `0x300 Vehicle_Object` every 100 ms and suggested a
50 ms producer period for non-time-critical `0x500 AFS_Status`, then asked to
adjust all related implementation and documentation.

**Agent changes**

- Split production scheduling: `0x100`/`0x200` remain at 20 ms; `0x300` is
  sent every 100 ms. Set `0x300`'s ECU receive timeout to 250 ms to tolerate
  one missed grid frame plus timing margin. Document that stale-grid reporting
  can lag by up to one 100 ms transmission period.
- Set the suggested ECU `0x500` reporting period and DBC cycle-time attribute
  to 50 ms. The bridge does not yet enforce a receive-expiry timeout for
  `0x500`.
- Updated message specs, DBC metadata/comments, generated header comments,
  bridge/architecture guides, CAN reference UI, agent plans/context, and Code
  graph descriptions.
- Local Python environments do not have cantools, so the generator could not
  be run. Only DBC comments/cycle-time metadata changed; generated codec layouts
  are unchanged, and the corresponding generated header comments were updated.
- Code graph inventory freshness and validation passed (194 inventory nodes,
  59 graph nodes, 65 interactions, 10 functionality paths). Headless Firefox
  review passed for CanRuntime details/source/upstream links, class-member
  expansion, search, layer filtering, production CAN path selection/clearing,
  zoom, pan, and the updated CAN message reference.
- CMake configure and the bridge build passed. Project tests and live CAN checks
  were not run. `git diff --check` and required graph syntax checks passed.

**Files modified**

- `bridge/src/app/can_runtime.cpp`, `bridge/include/afs_bridge/can_runtime.hpp`,
  `bridge/include/afs_bridge/can_encoder.hpp`, `bridge/can/afs.dbc`,
  `bridge/src/can/generated/afs.h`
- `bridge/README.md`, `bridge/src/can/README.md`, `docs/can/README.md`,
  `docs/can/messages/0x300_Vehicle_Object.md`,
  `docs/can/messages/0x500_AFS_Status.md`, `docs/development.md`,
  `docs/README.md`, `docs/architecture/components/bridge.md`,
  `docs/architecture/components/afs-ecu.md`, `docs/architecture/data-flow.md`,
  `docs/architecture/overview.md`,
  `docs/architecture/runner-bridge-communication.md`, `README.md`
- `tools/system_visualization/can-messages/can-messages.js`,
  `tools/system_visualization/can-messages/index.html`,
  `tools/system_visualization/tests/can-messages.test.cjs`,
  `tools/system_visualization/code-graph/graph-data.js`,
  `tools/system_visualization/code-graph/functionality-data.js`,
  `agents/plan/feat-bridge-socketcan.md`,
  `agents/plan/feat-bridge-can-encoding.md`, `agents/working-context.md`,
  `agents/prompt-tracking.md`, `tools/system_visualization/code-graph/code-index.js`

### 2026-10-22 - Implement Production SocketCAN Runtime

**User prompt**

User asked to continue CAN work on `feat/bridge/can` and selected opt-in CAN
startup: bind the CAN runtime only when `--can-interface NAME` is provided.

**Agent changes**

- Added a Linux SocketCAN RAII transport with interface validation, `0x500`
  receive filtering, pollable I/O, and standard Classical CAN frame conversion.
- Wired a 20 ms monotonic CAN worker into `afs_runner_bridge`. It samples the
  latest runner scene, sends `0x100`/`0x200`/`0x300`, validates `0x500` status,
  and retains accepted status with a host monotonic timestamp. CAN I/O faults
  are rate-limited and retried while runner/Dashboard IPC remain available.
- Updated bridge/CAN/architecture guidance, roadmap, branch checklist, Code
  graph model, and working context. Dashboard ECU status forwarding and
  `0x400` transmission remain out of scope.

**Files modified**

- `bridge/CMakeLists.txt`, `bridge/include/afs_bridge/afs_status.hpp`,
  `bridge/include/afs_bridge/can_runtime.hpp`,
  `bridge/include/afs_bridge/socketcan_transport.hpp`,
  `bridge/src/app/can_runtime.cpp`,
  `bridge/src/app/runner_bridge_main.cpp`, `bridge/src/can/afs_status.cpp`,
  `bridge/src/can/socketcan_transport.cpp`, `bridge/README.md`,
  `bridge/src/app/README.md`, `bridge/src/can/README.md`,
  `bridge/tests/README.md`, `docs/architecture/components/bridge.md`,
  `docs/architecture/data-flow.md`, `docs/architecture/overview.md`,
  `docs/architecture/runner-bridge-communication.md`,
  `docs/can/README.md`, `docs/can/messages/0x100_Vehicle_Speed.md`,
  `docs/can/messages/0x200_Vehicle_Steering.md`,
  `docs/can/messages/0x500_AFS_Status.md`,
  `docs/development.md`, `docs/hardware/hardware.md`, `docs/README.md`,
  `README.md`, `agents/plan/feat-bridge-socketcan.md`,
  `agents/roadmap.md`, `agents/working-context.md`,
  `tools/system_visualization/code-graph/graph-data.js`,
  `tools/system_visualization/code-graph/functionality-data.js`,
  `tools/system_visualization/code-graph/code-index.js`,
  `agents/prompt-tracking.md`.

**Verification**

- CMake configure and bridge runtime/executable builds passed. No tests were
  added or run. `vcan0` checks could not run because this environment denied
  opening the netlink socket (`Operation not permitted`).

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
