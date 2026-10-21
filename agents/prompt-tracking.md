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

### 2026-10-20 - Add DBC-Generated In-Memory CAN Frames

**User prompt**

User said to continue the CAN branch after the DBC was created and noted that
cantools was already installed by the parallel session.

**Agent changes**

- Generated and checked in the cantools C codec for the project DBC, then added
  a C++ frame interface/encoder for `0x100`, `0x200`, and `0x300`.
- Added the generated codec and C++ wrapper to CMake. The frame API preserves
  reserved zeros and returns frames in speed, steering, object order. Runtime
  scheduling, SocketCAN, and executable integration remain out of scope.
- Updated bridge/CAN/architecture status docs, the branch plan, working
  context, and the Code graph. Adjusted the inventory builder to index C/C++
  type definitions once instead of duplicating generated-header references.

**Files modified**

- `bridge/CMakeLists.txt`, `bridge/include/afs_bridge/can_frame_encoder.hpp`,
  `bridge/src/can/can_frame_encoder.cpp`,
  `bridge/src/can/generated/afs.c`, `bridge/src/can/generated/afs.h`,
  `bridge/README.md`, `bridge/src/can/README.md`,
  `bridge/tests/README.md`, `README.md`, `docs/can/README.md`,
  `docs/architecture/overview.md`, `docs/architecture/data-flow.md`,
  `docs/architecture/components/bridge.md`, `docs/development.md`,
  `agents/plan/feat-bridge-can-encoding.md`, `agents/roadmap.md`,
  `agents/working-context.md`, `agents/prompt-tracking.md`,
  `tools/system_visualization/code-graph/build_index.py`,
  `tools/system_visualization/code-graph/code-index.js`,
  `tools/system_visualization/code-graph/graph-data.js`,
  `tools/system_visualization/code-graph/functionality-data.js`

**Verification**

- cantools 45.0.0 generated `afs.c` and `afs.h` from `bridge/can/afs.dbc`.
- CMake compiled `afs_can_encoding` and `afs_runner_bridge` successfully.
- Code inventory freshness (155 nodes), graph validation (47 visible nodes,
  44 interactions, seven layers, eight paths), JavaScript syntax, and
  `git diff --check` passed. No tests were added or run.

### 2026-10-20 - Create The Five-Message CAN DBC

**User prompt**

User asked for `afs.dbc` so they could avoid entering every CAN signal manually
in Vector CANdb++.

**Agent changes**

- Created `bridge/can/afs.dbc` with the current `0x100` through `0x500`
  message IDs, transmitters, receivers, DLCs, cycles, bit layouts, scaling,
  value tables, and distinct names for reserved fields within each message.
- Updated CAN, bridge, architecture, and agent notes to identify the DBC as
  present while generated C payload packing and CAN transport remain pending.

**Files modified**

- `bridge/can/afs.dbc`, `bridge/README.md`, `bridge/src/can/README.md`,
  `README.md`, `docs/README.md`, `docs/can/README.md`,
  `docs/architecture/overview.md`, `docs/architecture/data-flow.md`,
  `docs/architecture/components/bridge.md`,
  `docs/temporary/desired_file_system.md`,
  `agents/plan/feat-bridge-can-encoding.md`, `agents/working-context.md`,
  `agents/prompt-tracking.md`

**Verification**

- Strict cantools parsing accepts all five messages and 69 signals. The
  documented example payloads were checked against the DBC bit positions.
  Code inventory freshness, graph validation, JavaScript syntax, Markdown
  links/fences, and Git whitespace checks pass. Generated C payload
  integration and live CAN behavior remain separate work.

### 2026-10-20 - Reassign CAN Message IDs

**User prompt**

User assigned speed `0x100`, steering `0x200`, vehicle objects `0x300`,
dashboard command `0x400`, and ECU status `0x500`.

**Agent changes**

- Updated CAN message specs, architecture references, branch notes, and viewer
  labels to the agreed identifiers.
- Renamed the speed and vehicle-object message spec files and updated links,
  viewer ordering, and its ID expectations.

**Files modified**

- `docs/can/README.md`, `docs/can/messages/0x100_Vehicle_Speed.md`,
  `docs/can/messages/0x200_Vehicle_Steering.md`,
  `docs/can/messages/0x300_Vehicle_Object.md`,
  `docs/can/messages/0x400_Dashboard_Command.md`,
  `docs/can/messages/0x500_AFS_Status.md`,
  `docs/architecture/adb-grid-and-lamps.md`,
  `docs/architecture/data-flow.md`,
  `docs/architecture/runner-bridge-communication.md`,
  `docs/architecture/components/bridge.md`,
  `docs/architecture/components/afs-ecu.md`,
  `docs/architecture/components/headlights.md`,
  `docs/architecture/components/metadrive.md`,
  `agents/working-context.md`, `agents/plan/feat-bridge-can-encoding.md`,
  `tools/system_visualization/README.md`,
  `tools/system_visualization/can-messages/index.html`,
  `tools/system_visualization/can-messages/can-messages.js`,
  `tools/system_visualization/tests/can-messages.test.cjs`,
  `tools/system_visualization/beam-visual/beam-segments.html`,
  `agents/prompt-tracking.md`

**Verification**

- No old `0x310` ID or superseded speed/object spec path remains in active files.
  Markdown link and fence checks, code inventory freshness, graph validation,
  viewer JavaScript syntax, and `git diff --check` pass. Tests were not run.

### 2026-10-20 - Lower AFS Status CAN Priority

**User prompt**

User requested that `AFS_Status` have a larger CAN identifier than steering,
speed, vehicle-grid, and dashboard-command frames because status reporting is
not critical.

**Agent changes**

- Changed the status identifier from `0x100` to `0x500`, giving it lower bus
  arbitration priority than `0x200`, `0x300`, `0x310`, and `0x400`.
- Updated the message specification, CAN overview, architecture references,
  branch context, and static CAN viewer to show the new identifier and order.

**Files modified**

- `docs/can/README.md`, `docs/can/messages/0x200_Vehicle_Steering.md`,
  `docs/can/messages/0x300_Vehicle_Speed.md`,
  `docs/can/messages/0x500_AFS_Status.md`,
  `docs/can/messages/0x400_Dashboard_Command.md`,
  `docs/architecture/adb-grid-and-lamps.md`,
  `docs/architecture/components/afs-ecu.md`,
  `docs/architecture/components/headlights.md`,
  `docs/architecture/data-flow.md`, `agents/working-context.md`,
  `agents/plan/feat-bridge-can-encoding.md`,
  `tools/system_visualization/README.md`,
  `tools/system_visualization/can-messages/`,
  `agents/prompt-tracking.md`

**Verification**

- At that point, no stale AFS_Status use of `0x100` remained in active files.
  Code inventory freshness, graph validation, CAN viewer JavaScript syntax,
  and `git diff --check` pass; tests were not run.

### 2026-10-20 - Implement CAN Signal Validation And Projection

**User prompt**

User asked for validation and encoding from the agreed CAN formats while
creating the DBC in a parallel session, and asked how generated C codecs fit
the transmit path.

**Agent changes**

- Clarified that C++ validates and prepares signal values, cantools generates
  C signal encoders/message packers from the CANdb++ DBC, and a later
  SocketCAN layer sends `{ID, DLC, payload}` frames.
- Added a standalone `CanEncoder` API for freshness/validity, steering and
  speed quantization/saturation, alive counters, and 10-sector full-footprint
  vehicle projection. It is not wired into the executable and does not create
  payload bytes until the DBC and generated codec are available.
- Updated the plan, bridge/CAN documentation, and code graph to distinguish
  implemented signal preparation from pending DBC payload packing/transport.

**Files modified**

- `bridge/CMakeLists.txt`, `bridge/include/afs_bridge/can_encoder.hpp`,
  `bridge/src/can/can_encoder.cpp`, `bridge/tests/can_encoder_test.cpp`,
  `bridge/README.md`, `bridge/src/can/README.md`, `bridge/tests/README.md`,
  `README.md`,
  `docs/architecture/components/bridge.md`, `docs/can/README.md`,
  `docs/development.md`, `agents/plan/feat-bridge-can-encoding.md`,
  `agents/working-context.md`,
  `tools/system_visualization/code-graph/graph-data.js`,
  `agents/prompt-tracking.md`

**Verification**

- The bridge compiles. Code inventory freshness, graph validation, graph-data
  JavaScript syntax, and `git diff --check` pass. Signal validation/projection
  CTest cases passed before the final saturation endpoint adjustment; they
  were not rerun after that small change. Firefox could not start because the
  installed Snap requires the unavailable `snapd.apparmor` service, so the
  graph was checked through its validator but not opened visually. The
  DBC-generated payload and golden-frame checks are pending the DBC.


### 2026-10-20 - Keep CAN Schema And Runtime Under Bridge

**User prompt**

User specified that laptop-side CAN implementation belongs under `bridge/`,
that there should be no root `can/` directory, and that Vector CANdb++ will
create/edit the DBC.

**Agent changes**

- Removed the handwritten DBC draft and the now-empty root `can/` directory.
- Updated project docs to place the CANdb++-authored DBC at
  `bridge/can/afs.dbc`; the approved cantools workflow checks generated C files
  into `bridge/src/can/generated/`.
- No CAN runtime implementation was added.

**Files modified**

- `README.md`, `docs/README.md`, `docs/temporary/desired_file_system.md`,
  `docs/can/README.md`, `docs/architecture/components/bridge.md`,
  `agents/plan/feat-bridge-can-encoding.md`, `agents/working-context.md`,
  `agents/prompt-tracking.md`

**Verification**

- Relative Markdown links and fenced blocks pass in the eight updated
  documents. `git diff --check` passes; no runtime code changed.


### 2026-10-20 - Select Zephyr For STM32 Firmware

**User prompt**

User said they want to use Zephyr with the STM32 ECU.

**Agent changes**

- Recorded Zephyr RTOS with C application code as the planned MCU firmware
  platform, while keeping firmware implementation status unchanged.
- Documented that the exact development board must be confirmed before
  selecting a Zephyr target or assigning peripheral pins. The official
  `black_f407ve` target is available for STM32F407VET6 but is not actively
  maintained.

**Files modified**

- `README.md`, `docs/architecture/overview.md`,
  `docs/architecture/components/afs-ecu.md`, `docs/can/README.md`,
  `docs/hardware/hardware.md`, `docs/temporary/desired_file_system.md`,
  `agents/roadmap.md`, `agents/working-context.md`,
  `agents/prompt-tracking.md`

**Verification**

- Checked changed Markdown links, fenced blocks, and whitespace. No firmware
  code or tests were changed.

### 2026-10-20 - Document CAN Editing And Monitoring Tools

**User prompt**

User asked to document Vector CANdb++ for DBC editing and SavvyCAN for
visualizing DBC-decoded CAN traffic from the host.

**Agent changes**

- Documented CANdb++ as the DBC editor and SavvyCAN as the live CAN viewer for
  SocketCAN interfaces. Clarified that live viewing needs a transmitting node
  and a compatible USB-CAN adapter, and that the project CAN runtime and DBC
  are not implemented yet.
- Added the SocketCAN compatibility constraint to the planned hardware list.

**Files modified**

- `docs/can/README.md`, `docs/hardware/hardware.md`,
  `agents/prompt-tracking.md`

**Verification**

- Relative Markdown links and code-fence pairing pass for all three updated
  documents. `git diff --check` passes.

### 2026-10-20 - Show Byte Maps In The CAN Messages Tab

**User prompt**

User confirmed that an out-of-range value should be marked invalid, and asked
for an eight-byte visual map with bit arrows linked to the current signal names.

**Agent changes**

- Kept saturated steering and speed values invalid so the ECU ignores the
  clamped payload values.
- Added a panel per payload byte, split into bit 7 through bit 0, with sample
  bit values and signal callouts linking to the existing table rows. DLC 8
  messages show eight panels; the three-byte `0x400` shows three.
- Updated the CAN page description, project/tool README, working context, and
  added tests for full bit coverage, sample bits, multi-byte signals, and links.

**Files modified**

- `docs/can/messages/0x200_Vehicle_Steering.md`,
  `docs/can/messages/0x300_Vehicle_Speed.md`,
  `agents/plan/feat-bridge-can-encoding.md`,
  `README.md`, `tools/system_visualization/README.md`,
  `tools/system_visualization/can-messages/index.html`,
  `tools/system_visualization/can-messages/can-messages.css`,
  `tools/system_visualization/can-messages/can-messages.js`,
  `tools/system_visualization/tests/can-messages.test.cjs`,
  `tools/system_visualization/code-graph/code-index.js`,
  `agents/working-context.md`, `agents/prompt-tracking.md`

**Verification**

- All four System Visualization test files pass. CAN byte-map tests verify all
  sample bits map to signals and callouts link to the matching table rows.
- Inventory freshness and graph validation pass (135 source entries, 43
  visible nodes, 40 interactions, seven layers, seven paths). JavaScript
  syntax checks, Markdown links/fences, and `git diff --check` pass. The curated
  graph is unchanged because this tool-page change adds no system runtime path.
- A browser preview could not run: local server binding is denied in the
  sandbox, and Firefox Snap refuses to launch because `snapd.apparmor` is not
  active.
