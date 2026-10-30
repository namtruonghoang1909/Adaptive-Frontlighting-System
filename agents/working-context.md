# Agent Working Context

Read the [agent guide](README.md), relevant files in [rules/](rules/rules.md), this file, and [prompt-tracking.md](prompt-tracking.md) before changing source or architecture.

## Workspace

- Commands and documentation paths are relative to the repository root.
- [docs/development.md](../docs/development.md) indexes runnable scripts and the primary simulation, bridge, test, and viewer commands.
- Root `AGENTS.md` is an automatic-discovery pointer to the canonical [agent guide](README.md).
  Agent rules, working context, prompt history, roadmap, and plans now live together under
  the root `agents/` directory; the former `docs/agents/` tree has been removed.
- Runtime-facing MetaDrive, SocketCAN, bridge, Dashboard, and hardware commands require Linux.
- `simulation/metadrive/` is a large ignored upstream checkout. It can be inspected but must not be modified by project work.
- The configured MetaDrive Python environment may not contain pytest; use the direct-test fallback in [testing.md](../docs/verification/testing.md).
- Local cleanup removed the unused AtomicViz `.mcp.json`, workstation-specific VS Code
  settings, generated Python caches, and empty legacy `can_bridge` directories. Root MCP
  and VS Code settings are now ignored local configuration; the bundled code map needs no
  MCP server. Committed simulation screenshots remain validation evidence, and planned
  component scaffolds remain intentional.

## Current Task And Review State

- All project-owned tests now live under root `tests/`, grouped by component and module. Each top-level test area has a `README.md` describing what its folders or files cover; `tests/test_runner/test_test_tree.py` checks that these guides remain present. Run focused checks through `bash tests/scripts/test_components.sh COMPONENT/MODULE` or the matching `bash tests/scripts/test_<component>.sh [MODULE...]` entrypoint. `bash scripts/test_all.sh` is the only command that runs every software suite. Focused commands and prerequisites are in [test_guide.md](../tests/scripts/test_guide.md). Ignored upstream Zephyr/MetaDrive dependency tests remain with their vendor checkouts.
- The focused dispatcher accepts one component/module selector. The root `scripts/test_all.sh` runs runner, bridge (including the headless DBC frame smoke), Dashboard, ECU, visualization, launchers, and test-runner checks. The latest full run passed: 45 runner tests, 7 bridge CTest cases, 141 CAN-smoke frames checked against the DBC, 9 Dashboard tests, 5 ECU host cases plus the Zephyr build, 37 visualization tests plus Code graph validation, 9 launcher tests, and 6 test-runner tests at that run. The test-only cantools dependency is pinned in `tests/requirements.txt`; Unix socket integration tests need local socket permissions. `bridge-vcan` remains opt-in, and physical CAN/SWD/RTT/actuator validation is separate. See [testing.md](../docs/verification/testing.md).
- Focused test entrypoints now live under `tests/scripts/`; root `scripts/` retains only `test_all.sh` for testing. Earlier focused component checks passed: runner extraction 3, bridge encoder 2, SocketCAN conversion 1, bridge runner IPC 2, Dashboard commands 5, ECU CAN service 5, visualization beam model 1, and Dashboard IPC 1. The latest layout regression checks passed: launcher suite 9 tests, test-tree suite 5 tests, component-guide suite 2 tests (7 total), shell syntax, source inventory check (281 nodes), Code graph validation, and `git diff --check`. See [test_guide.md](../tests/scripts/test_guide.md).
- The [ECU RTT guide](../firmware/docs/rtt_debugging.md) now documents one-time Ubuntu/ST-Link setup, build and flash commands, starting the local RTT reader, expected messages, and connection troubleshooting. The firmware [guide](../firmware/README.md#read-ecu-diagnostics-over-rtt), [hardware check](../firmware/docs/hardware_check.md), and [development commands](../docs/development.md) link to it. Live RTT output still needs verification on the user's Ubuntu VM after flashing the current image.
- The active branch is `feat/bridge-ecu/can`. Its production SocketCAN transport sends `0x100`/`0x200` every 20 ms, `0x300` every 100 ms, and leased Dashboard `0x400` commands every 50 ms. It decodes `0x500`, forwards ECU status with freshness, and clears `CommandValid` on Dashboard disconnect. Frame conversion, decoder, Dashboard IPC lifecycle/status, encoder, and Python-to-C++ IPC tests pass (7/7 CTest). The opt-in `vcan0` integration test is implemented and builds, but cannot run here: no CAN interface is present and kernel netlink operations deny creating vcan0. The user's Ubuntu VM reports the USB-CAN adapter as `can0`, and `lsusb -t` shows it bound to `gs_usb`, confirming SocketCAN driver/interface registration. The user configured the adapter at 500 kbit/s and passed its controller-loopback test; `candump` showed a TX echo and matching RX frame. Bridge IDs `0x100`–`0x400` were observed through controller loopback; the reported `ENOBUFS` warning remains under investigation, and physical bus exchange is pending. The STM32 CAN RX/decode, freshness, and `0x500` TX slice now builds for `black_f407ve`; the earlier LED image was flashed and confirmed, but the current CAN image has not yet been flashed. The user reports the hardware is now available; physical bus and current-image firmware verification are the next steps. Host startup and result-observation steps are in [scripts/guide.md](../scripts/guide.md); build, ST-Link, flash, RTT, and ECU status checks are in [firmware/scripts/guide.md](../firmware/scripts/guide.md). The branch checklist is [feat-bridge-socketcan.md](plan/feat-bridge-socketcan.md). The agreed `0x300 Vehicle_Object` design is one 8-byte frame with ten sector records, each containing one `SectorOccupied` bit and a four-bit cumulative subsector mask. Legal masks are `0000`, `0001`, `0011`, `0111`, `1111`; wire bit 0 is farthest and bit 3 nearest. The 100 m range uses equal 25 m bands: `0–25: 1111`, `25–50: 0111`, `50–75: 0011`, `75–100: 0001`; combine vehicles' masks by OR. Use the agreed 10-sector visual geometry and the full vehicle footprint across every sector it overlaps. Radial range uses nearest and farthest Euclidean distance from ego to the footprint, clipped to 0–100 m; footprints wholly outside contribute no records. Include `VEHICLE` objects only. Truncation sets `GridValid=0`, clears sector records, and sets both `PerceptionDegraded=1` and `ObjectListOverflow=1`; `objects_valid=false`, `objects_degraded=true`, or a relevant vehicle with missing/unusable length, width, or relative heading also sets `PerceptionDegraded=1` and invalidates/clears the grid. Stale input (>250 ms) and any detected transfer/parse/validation fault invalidate/clear the grid but do not set perception diagnostics unless object quality is also degraded. `PerceptionDegraded=1` always implies `GridValid=0`. A fresh valid empty list remains a valid clear grid. Expected IPC sequence gaps are allowed; after a detected fault, a fresh accepted scene is required to restore `GridValid=1`. Runner IPC latches detected packet, parsing, freshness, and disconnect faults in the retained scene so stale data cannot be treated as valid CAN input. `CanEncoder` validates freshness and values, quantizes steering/speed, advances their alive counters, and projects complete vehicle footprints into ten sector/mask signal values. `CanFrameEncoder` uses the checked-in cantools C codec to return standard in-memory `0x100`, `0x200`, and `0x300` frames plus `0x400` Dashboard commands with reserved fields zero. The separate `afs_can_frame_logger` diagnostic executable can consume runner scenes at 20 ms cadence, log representative payloads, round-trip all batches with the generated C codec, and cross-check every captured frame with cantools and `bridge/can/afs.dbc`; it does not use SocketCAN. Production scheduling, SocketCAN conversion, `0x400` command transmission, and `0x500` Dashboard forwarding are implemented. The vcan end-to-end test is available; the physical adapter bitrate and bridge controller-loopback transmission of IDs `0x100`–`0x400` are verified; an `ENOBUFS` warning remains under investigation, and physical CANH/CANL exchange remains unverified. Physical ECU CAN verification is now the next hardware step; the firmware code is ready for flashing. The prior encoding checklist is [feat-bridge-can-encoding.md](plan/feat-bridge-can-encoding.md).
- The STM32 firmware workspace uses Zephyr 3.7.0 (`v3.7.0`), west 1.2.0, and Zephyr SDK 0.16.8 with ignored `firmware/.west`, `firmware/zephyr`, `firmware/modules`, imported projects, `firmware/.venv`, and `firmware/.sdk` all inside `firmware/`. Project-owned Zephyr app files are in `firmware/afs_ecu/`, organized as Application, RTE, BSW services, and ECU abstraction. The current app receives and validates `0x100`–`0x400`, uses 100 ms speed/steering, 250 ms grid, and 200 ms valid-command timeouts, accepts modulo-16 alive-counter deltas 1–8 with a 500 ms no-accepted-frame rebaseline, and emits DBC-packed `0x500` every 50 ms. CAN2 is selected by the board devicetree and set to 500 kbit/s in the app overlay. The app deliberately reports `Safe_Default`, `SafeFallback`, `BeamControlLost`, and `ServoControlLost` because physical control drivers do not exist yet. A pristine build for `black_f407ve` passed; the previous LED-only image was flashed over ST-Link and its board LED confirmed, but the new CAN image has not been flashed or physically tested. The board is marked `STM32F4VE ver 36C SN:2024C` with confirmed STM32F407VET6; the upstream board target matches but is not actively maintained. The [wiring draft](../docs/hardware/wiring-draft.md) proposes CAN2 PB12/PB13, shared SPI2 PB10/PC3 with LOAD candidates PD10/PD11, I2C1 PB8/PB9, and feedback ADC PA1/PA4. Matrix modules currently use the board USB-C-fed 5 V rail; verify supply and header current path. Direct STM32 3.3 V SPI/LOAD to MAX7219 at 5 V is below its specified 3.5 V VIH minimum and is not guaranteed. Only CAN2/SPI2 are documented Zephyr defaults; other assignments and modules need schematic/datasheet review. The user reports STM32CubeIDE programs this board with four-wire SWD (SWDIO, SWCLK, GND, 3.3 V VTref), without NRST. Project wrappers build, check ST-Link, and flash with the no-NRST OpenOCD config. The user's USB/CAN devices are outside this execution environment; physical firmware and adapter checks must run in the Ubuntu VM. See [hardware check](../firmware/docs/hardware_check.md), [AFS ECU component](../docs/architecture/components/afs-ecu.md), and [firmware guide](../firmware/README.md).
- The STM32 firmware workspace uses Zephyr 3.7.0 (`v3.7.0`), west 1.2.0, and Zephyr SDK 0.16.8 with ignored `firmware/.west`, `firmware/zephyr`, `firmware/modules`, imported projects, `firmware/.venv`, and `firmware/.sdk` all inside `firmware/`. Project-owned Zephyr app files are in `firmware/afs_ecu/`, organized as Application, RTE, BSW services, and ECU abstraction. The current app receives and validates `0x100`–`0x400`, uses 100 ms speed/steering, 250 ms grid, and 200 ms valid-command timeouts, accepts modulo-16 alive-counter deltas 1–8 with a 500 ms no-accepted-frame rebaseline, and emits DBC-packed `0x500` every 50 ms. CAN2 is selected by the board devicetree and set to 500 kbit/s in the app overlay. The app deliberately reports `Safe_Default`, `SafeFallback`, `BeamControlLost`, and `ServoControlLost` because physical control drivers do not exist yet. ECU `printk` uses SEGGER RTT channel 0; `bash firmware/scripts/read_rtt.sh` starts the SDK OpenOCD RTT server and local console over the existing four SWD wires. A pristine RTT-enabled build for `black_f407ve` passed; the previous LED-only image was flashed over ST-Link and its board LED confirmed, but the new CAN/RTT image has not been flashed or physically tested. The board is marked `STM32F4VE ver 36C SN:2024C` with confirmed STM32F407VET6; the upstream board target matches but is not actively maintained. The [wiring draft](../docs/hardware/wiring-draft.md) proposes CAN2 PB12/PB13, shared SPI2 PB10/PC3 with LOAD candidates PD10/PD11, I2C1 PB8/PB9, and feedback ADC PA1/PA4. Matrix modules currently use the board USB-C-fed 5 V rail; verify supply and header current path. Direct STM32 3.3 V SPI/LOAD to MAX7219 at 5 V is below its specified 3.5 V VIH minimum and is not guaranteed. Only CAN2/SPI2 are documented Zephyr defaults; other assignments and modules need schematic/datasheet review. The user reports STM32CubeIDE programs this board with four-wire SWD (SWDIO, SWCLK, GND, 3.3 V VTref), without NRST. Project wrappers build, check ST-Link, and flash with the no-NRST OpenOCD config. The user's USB/CAN devices are outside this execution environment; physical firmware and adapter checks must run in the Ubuntu VM. See [hardware check](../firmware/docs/hardware_check.md), [AFS ECU component](../docs/architecture/components/afs-ecu.md), and [firmware guide](../firmware/README.md).
- Runner IPC includes `ego.max_steering_deg`. The bridge requires a positive finite limit when present and validates `steering_deg` against it instead of a fixed ±90° bound. A null limit is retained as unavailable, so the CAN signal encoder clears `SteeringValid`.
- The high/low beam road map has 10 logical sectors. It retains exactly the old
  16-sector preview's central `03–12` far-field boundaries and widths, then
  renumbers them `00–09`. The far edges are about ±14.223°; the two edge cells
  extend to ±18° through 30 m for close-range lamp spill and blend by 50 m.
  The yellow near-field guide and LEFT/EGO/RIGHT and X FORWARD map labels
  remain removed. `0x300` reports occupancy and a four-bit cumulative
  subsector mask for each sector in one complete frame. `0x500` reports the
  10-sector applied mask in a 16-bit container. The agreed visual geometry is
  the software projection contract; physical lamp calibration remains future
  bench work.
- The shared [High beam visual](../tools/system_visualization/beam-visual/beam-segments.html) and [Low beam visual](../tools/system_visualization/beam-visual/beam-segments.html?mode=low) tabs render two 8×8 MAX7219-style matrices to the left of the road grid. High beam centers both platforms, keeps rows 5–8 on, and enables rows 1–4 with distance-based ADB pixel masking. Example distances 30/50/70/100 m mask 4/3/2/1 top rows in affected columns; the transition cutoffs are 40/60/85 m. These remain visual examples, separate from the agreed CAN bands of 0–25/25–50/50–75/75–100 m. Low beam turns rows 1–4 off and keeps rows 5–8 on. During turns, the outside matrix swivels three times farther than the inside matrix; the inside target is one third of the outside target, with left turns moving the left matrix less and right turns mirrored. The outside target is `(wheel / 90°) × 6° × (1 − 0.75 × speed / 120)` for clamped ±90° wheel input and 0–120 km/h. At full wheel input, outside/inside aim is 6°/2° at 0 km/h, 3.75°/1.25° at 60 km/h, and 1.5°/0.5° at 120 km/h. The car stays fixed. Default visual spans are 100 m / ±10° for high beam and 40 m / ±18° for low beam. These visualization values await physical calibration; the CAN subsector mask does not encode object height.
- The logical-sector geometry projects road masks to eight selectable horizontal columns per lamp; sector numbers are not wired directly to column numbers. The high-beam scene defaults to one visible left-lane vehicle and a partial ADB mask. The low-beam view shows the shorter, wider footprint and keeps ADB inactive. Its default viewport zooms to the first 60 m while the 40 m beam and up to ±6° outside-matrix swivel stay within frame. Each visualization tab shows a **Code updated** timestamp beside the tabs, based on the newest server modification time for its page and local CSS/JavaScript files. Center- and right-lane vehicles remain available through their controls; those beyond the close-up leave the visible map. The preview has no live simulator connection. Current checks are in the latest prompt-tracking entry.
- The merged System Visualization tool has six views: Code graph, static [System in Action](../tools/system_visualization/system-in-action/index.html), High beam visual, Low beam visual, static [CAN messages](../tools/system_visualization/can-messages/index.html) reference, and schematic-style [Hardware wiring](../tools/system_visualization/hardware-wiring/index.html). Its pages and assets are grouped under `tools/system_visualization/code-graph/`, `beam-visual/`, `can-messages/`, `hardware-wiring/`, `system-in-action/`, and `shared/`; focused tests live in `tests/`. The hardware wiring view shows candidate pins on component edges, separated selectable routes, and junction dots; exact header layouts and module circuits remain unverified. The CAN page shows byte maps split into bit cells with arrows linking signals to their table rows, followed by exact positions, meanings, and example values, including all 10 five-bit `0x300` sector records. Current documented formats are `0x100`, `0x200`, `0x300`, `0x400`, and `0x500`; standalone frame encoding and production SocketCAN transport are implemented, while live bus monitoring remains unverified. The common road grid has three lanes, 10 logical sectors, 11 straight divider rays, 10 m bands, and a 100 m maximum range. The two beam visual tabs share the road grid, vehicle controls, and matrix column selection. Angle spans and light patterns are design assumptions, not published Audi specifications. See the [ADB mapping design](../docs/architecture/adb-grid-and-lamps.md).
- The two-matrix visualization and design documentation are committed in `ca242fc` and `faaeacd`; the runner-to-bridge IPC implementation is committed in `9dde06b`. IPC test coverage and its documentation are committed.
- The [runner–bridge communication contract](../docs/architecture/runner-bridge-communication.md) is implemented for runner publication and C++ reception using `SOCK_SEQPACKET`/JSON, session and sequence identity, source monotonic timestamps, bounded publication, validation, and reconnect behavior. The publisher starts automatically on every runner invocation and retries until the receiver is available. Both processes share the `AFS_BRIDGE_SOCKET` override and the XDG or private per-user `/tmp` default. The receiver prints each accepted JSON packet to stdout and rejected packets to stderr for live inspection. Candidate limits are 20 Hz, 250 ms, 64 KiB, and 128 objects. Existing CTest covers C++ receiver protocol cases and the actual Python publisher against the C++ bridge with synthetic snapshots, including startup retry and bridge restart. Five dependency-free publisher projection/limit tests are in `tests/runner/ipc_publisher/test_ipc_publisher.py`. The optional finite MetaDrive live smoke passed with 11 accepted scenes over 10 steps. Host CAN validation, 10-sector projection, DBC-generated `0x100`–`0x400` encoding, optional SocketCAN runtime, frame conversion, and `0x500` decoding/forwarding are implemented. The focused bridge CTest suite passes 7/7; vcan execution is blocked by host network permissions. ECU firmware CAN RX/decode, timeout supervision, and periodic `0x500` status TX now build; AFS control and hardware validation remain future work. The runner publisher runs in a Python worker thread; the bridge retains a mutex-protected latest scene in its process and latches detected IPC faults so CAN inputs fail closed. See [data-flow.md](../docs/architecture/data-flow.md).
- The [Dashboard–bridge contract](../docs/architecture/dashboard-bridge-communication.md) is implemented on a separate 4096-byte `SOCK_SEQPACKET` socket. The Dashboard client reconnects and polls status; the bridge stores identified power/mode requests and their IDs. With CAN enabled, clear-fault queues one SocketCAN write, decoded `0x500` fields reach the UI, and retained ECU values become stale after 250 ms. Fresh runner speed, steering, position, heading, and up to 24 nearby vehicle positions also reach the UI. Invalid or unavailable data uses labeled demo fallbacks; the proximity grid remains simulated. Pending actions are not replayed on disconnect, but a stored request ID can confirm acceptance after reconnect. The Dashboard launcher is `bash dashboard/scripts/start_dashboard.sh`; `AFS_DASHBOARD_SOCKET`, bridge `--dashboard-socket`, and Dashboard `--socket` select a custom path. Root `scripts/start_system.sh` starts the bridge, Dashboard, and MetaDrive runner; separate root scripts also start each host component.
- The native Dashboard has three ordered sections: surrounding objects at the top; speed and steering meters with a local, mode-dependent lighting preview in the middle; and power/mode controls plus status cards at the bottom. Meter captions sit below the circles. Turning power off greys out and disables mode buttons, while retaining the selected mode for reactivation. The preview updates even if bridge IPC is offline, but acceptance remains separately reported. Beam polygons originate at the car's front lamps and extend forward. In the ADB preview, a high-beam sector around a sample vehicle is omitted from the lit polygons, leaving the road visible while the low-beam base stays lit. Main-window mouse-wheel and trackpad events scroll the canvas, including when the pointer is over child controls.
- On 2026-10-07, the runner's cached LiDAR extraction, `LidarSnapshot`, browser comparison, and dedicated launcher were removed. `SceneSnapshot` now contains only ego and registry-derived surrounding objects. Those extraction changes were committed on the object extraction branch and merged before this task.
- The initial visitor tab's timeline tests and browser checks passed before the static revision. That revision removed playback controls, story modules, and their tests. The earlier tabletop artwork was reviewed in headless Firefox at desktop and phone widths; the current matrix artwork was inspected directly. Current verification is recorded in the latest prompt-tracking entry; no simulation runtime behavior changed.
- `SceneSnapshot` validates matching timestamp, source, seed, episode step, and simulation time. The browser scene payload uses schema version 2 because the LiDAR field was removed. MetaDrive's own LiDAR sensor and rendered overlay configuration remain in its environment setup; no project extractor consumes those rays.
- The previous object-extraction verification passed 39 dependency-free test functions, a real one-step headless MetaDrive run (2 valid published scenes), a one-step run with the optional local scene server, Code graph validation, DOM interaction checks, JavaScript syntax, Markdown checks, and Git whitespace validation. The scene server needed local bind permission outside the sandbox.
- The code map is a development aid for understanding the codebase, not an AFS project component,
  runtime feature, or milestone. Report tooling work separately from project progress. Every code
  change requires map synchronization in the same task against the current working tree, following
  [code_visualize.md](code_visualize.md).
- The merged object-extraction work contains the runner latest-scene interface, surrounding extraction integration, configurable radius, sibling `scene_display` development package, Linux runtime scripts, `simulation_runner/runner.md`, tests, aligned documentation, and the interactive architecture explorer under `tools/system_visualization/`.
- `tools/system_visualization/` has a class interaction graph. Implemented classes and selected entry functions are grouped into MetaDrive runner, runner IPC adapter, object extraction, scene display, bridge receiver/Dashboard IPC/CAN signal/frame layers, native Dashboard window/client/simulated model, and the Zephyr ECU CAN communication/status slice. Click a parent to expand or collapse methods/fields at 2/3 of the parent radius, with the same color tone. Direct upstream/downstream interactions highlight while unrelated nodes dim. Search, layer/folder filtering, pan/zoom, and a right-hand description and connection panel are available. Physical AFS actuation remains unimplemented. Source files are linked from details, not shown as graph nodes.
- The Code graph has a Functionalities section in the right panel. Eleven implemented paths highlight ordered arrows for ego extraction, surrounding extraction, scene publication, the runner's browser display, manual driving, runner startup, runner-to-bridge IPC, the CAN frame smoke path, the Dashboard command/status CAN roundtrip, and native Dashboard bridge IPC. Selection expands required members and focuses the path start; clearing removes the overlay. Parent spacing and child offset keep arrows readable. Existing graph click, search, filter, and camera controls remain available.
- The viewer now starts and resets at 90% zoom near the first visible class. Node, layer, interaction, and functionality labels are larger. Search and layer filters return to a readable close view; selecting a long functionality path focuses its first node at readable scale, with panning and action clicks available to follow the rest. **Fit** remains the whole-map overview.
- Parent class/function positions are curated in `tools/system_visualization/code-graph/graph-data.js` so the runner entry, manual control, extraction branches, scene storage, and browser rendering read in a logical order within their layer panels. Search and layer filters compact visible positions without losing their relative order. Expanded children still orbit each parent.
- Parent circles have radius 54 and child circles radius 36, preserving the 1.5:1 ratio. Ordinary interaction captions appear only after selecting a node, on its direct connections. The later node enlargement and always-visible captions were rolled back at the user's request; the logical node arrangement remains.
- `bash tools/system_visualization/start_system_visualization.sh` serves all System Visualization pages and repository source links at `http://127.0.0.1:8000/tools/system_visualization/`; pass a port number to change it. The local HTTP smoke check returned 200 for the viewer, generated index, and a source file.
- The headless CAN frame smoke passed with MetaDrive 0.4.3: 10 simulation steps yielded 11 accepted scenes and 48 scheduled frame batches (144 frames). The generated C unpackers matched every signal and reserved zero; cantools independently decoded and matched all 144 captured frames against `bridge/can/afs.dbc`. Representative frame bytes and decoded values are printed by `bash tests/can/bridge/frame_smoke/run_can_frame_smoke.sh`; no CAN interface is opened.
- The standalone `tools/lidar_demo.py` PNG helper and later browser LiDAR comparison were removed at the user's request.
- `tools/system_visualization/code-graph/graph-data.js` is the authoritative curated class, member, layer, interaction, and parent-position model. Each node has a source inventory ID and each edge has evidence. `code-graph/build_index.py` generates `code-graph/code-index.js` from repository-owned application/tool sources, including selected Python symbols, C++ class declarations, and public SocketCAN frame-conversion declarations; regenerate it when source paths or indexed symbols change. See `agents/code_visualize.md` for the maintenance workflow.
- `tools/system_visualization/code-graph/functionality-data.js` is the authoritative list of ordered implemented paths, separate from the base graph model. `functionality-overlay.js` highlights them; the only integration added to `viewer.js` is a path reveal/framing method.
- The root README links the System Visualization and hardware wiring view. Agent rules require every implementation and fix to review the generated inventory, class interactions, and ordered paths in the same task; affected models are updated, validated, and reported before handoff. The curated class graph includes the production CAN runtime, SocketCAN transport, status decoder, standalone CAN APIs, diagnostic logger, and the Zephyr ECU CAN receive/status path. It shows both the production CAN path and no-bus diagnostic path; physical AFS actuation remains planned.
- The Code graph, System in Action, High beam visual, and Low beam visual tabs are development tooling and ready for user review. Inspect the existing status and diff before further changes; wait for the user's explicit request before staging or committing. Follow [committing.md](rules/committing.md).
- The rendered scene display in [runner.md](../simulation_runner/runner.md) still needs graphical inspection. The current CAN milestone is verifying production TX/RX on a preconfigured `vcan0`; the local environment denied netlink access. The [LiDAR input investigation](plans/simulation_runner/lidar-input.md) is retained as historical research, not current implementation guidance.
- Recording, scenario replay, named scenarios, CAN behavior, and firmware behavior are outside this visualization work. The high/low visual tabs are interactive geometry and headlight previews only; they have no connection to simulator objects or runtime messages.
- An older stash named `deferred scene snapshot interface and broader docs` exists from the earlier surrounding-extractor branch. Do not apply it wholesale because it contains obsolete viewer and broad-documentation work.

## Implemented Simulation Flow

- `simulation_runner/src/object_extraction/` owns immutable `EgoSnapshot`, `SingleObjectSnapshot`, `SurroundingSnapshot`, and `SceneSnapshot` datatypes plus ego and surrounding extraction.
- Surrounding extraction reads MetaDrive's public registry, filters supported traffic objects within a configurable `100 m` default center radius, and produces deterministic world and x-forward/y-left ego-relative measurements.
- The surrounding snapshot is simulator ground truth from the object registry. No sensor-derived object detection exists.
- `run_single_agent()` takes one monotonic timestamp after every reset and step, extracts ego and surrounding state, constructs one matching `SceneSnapshot`, and atomically replaces the current scene.
- `simulation_runner/src/metadrive_runner/snapshot_store.py` retains only the newest immutable scene. Public getters expose the complete scene, ego component, or surrounding component to other modules in the same Python process.
- The store clears after runner arguments/configuration are valid and before environment construction. The final published scene remains available after shutdown.
- `get_scene_snapshot()` is the consistent read for consumers needing the complete matching sample. Two separate component getter calls can span a publication.
- The existing `on_snapshot` callback still receives the exact published `EgoSnapshot` after the scene has been stored.
- `RunnerSummary.invalid_snapshots` counts invalid complete scenes: either ego or surrounding extraction invalidates the scene.
- `simulation_runner/src/ipc_adapter/` remains a placeholder. The in-process scene store is not cross-process communication.
- `simulation_runner/src/scene_display/` is an optional read-only consumer. Its Uvicorn thread calls `get_scene_snapshot()`, exposes normalized typed data at `/api/scene`, and serves one Canvas view of ego and surrounding traffic objects. It does not perform extraction or retain a sample history.
- The empty stale `observation_viewer/` and `vehicle_extract/` directories and their generated metadata were removed locally; active source uses `scene_display/` and `object_extraction/`.

## Run And Verification Commands

The [development guide](../docs/development.md) is the concise index of the
repository launch scripts and their component workflows. The simulation
launcher runs the matching requirements check automatically before startup;
run the checker by itself only to check readiness without launching MetaDrive.

Check runtime requirements without starting MetaDrive:

```bash
bash simulation_runner/scripts/check_simulation_requirements.sh --headless
bash simulation_runner/scripts/check_simulation_requirements.sh --rendered
bash simulation_runner/scripts/check_simulation_requirements.sh \
  --headless --scene-display
```

Run a finite headless scene-display smoke test:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh \
  --headless --realtime --scene-display --max-steps 10
```

Run the rendered scene display on a machine with a graphical session:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh --scene-display
```

All runner arguments and example modes are documented in [simulation_runner/runner.md](../simulation_runner/runner.md).

Validate the interactive architecture explorer:

```bash
bash tools/system_visualization/start_system_visualization.sh
python3 tools/system_visualization/code-graph/build_index.py --check
node tools/system_visualization/code-graph/validate.mjs
node --check tools/system_visualization/code-graph/graph-data.js
node --check tools/system_visualization/code-graph/code-index.js
node --check tools/system_visualization/code-graph/viewer.js
node --check tools/system_visualization/code-graph/functionality-data.js
node --check tools/system_visualization/code-graph/functionality-overlay.js
```

The dependency-free suite covers sample matching, runner publication, scene-display normalization, and prior runner/display behavior. Pytest may be unavailable in the configured MetaDrive environment, so direct invocation is supported. Earlier loopback checks returned `200` for health, waiting-scene, and bundled HTML endpoints, rejected an occupied port, and shut down cleanly. The rendered requirement check correctly reported a missing graphical display variable in this shell.

Historical verification of the previous architecture UI covered 3 fixed views, 22 nodes, 45 edges, temporary DOM interactions, and localhost asset checks. Those UI checks predate the expandable-map redesign.

At the expandable-map redesign, the generated inventory contained 96 source nodes; freshness, containment, source links/lines, architecture mappings, and the retained 22-node/45-edge architecture model passed validation. A temporary Chromium browser suite passed component/file/function/method expansion, recursive collapse, hidden-branch search, leaf/source inspection, flow toggling, keyboard focus, dragging, panning, zoom/fit/reset, planned scaffolds, a 390-pixel viewport, and reduced motion without JavaScript errors. Desktop and mobile screenshots were inspected. At that time, 59 active Markdown files passed link/fence checks; prompt tracking retained ten entries. JavaScript syntax and whitespace checks passed. Simulation runtime tests were not rerun for that tool-only change.

The LiDAR investigation used live headless MetaDrive `0.4.3` with seed `10`, map `3`, traffic density `0.6`, and LiDAR drawing off. The default observation returned `float32 (259,)`, cached 240 raw ray fractions, four hit rays, and four broad-phase candidates. A 36-ray/80 m configuration returned `float32 (71,)`, one hit ray, and 11 candidates; disabling LiDAR left the cached fields `None`. A noisy custom run confirmed that the combined observation vector differs from the raw cached ray list. These were exploratory probes, not project tests.

The LiDAR documentation update passed link, code-fence, and trailing-whitespace checks
for 61 active Markdown files; prompt tracking retains ten entries and Git whitespace
validation passes. No project source code changed in that investigation.

The live LiDAR comparison implementation passed 43 dependency-free test functions.
A real two-step headless MetaDrive `0.4.3` run at seed `10`, map `3`, and traffic
density `0.6` published matching scenes with 240 valid cached rays over 50 m and
four hit rays. The runner's new example options completed a 100-step headless
scene-display run and the local Uvicorn server started and shut down cleanly.
At that time the code map had 102 source nodes, 23 architecture nodes, and 48
curated edges. The LiDAR capture branch and comparison display were represented. The rendered
two-panel page was not visually inspected in this shell because no graphical display
or Chromium executable is available. The latest short server run ended before a
separate HTTP fetch, so it confirms startup and shutdown rather than a live page review.

The dedicated LiDAR display launcher passed Bash syntax and `--help` checks.
Its rendered preflight imported all required packages and found matching MetaDrive
assets, then correctly stopped because this shell has no `DISPLAY` or
`WAYLAND_DISPLAY`; the graphical windows remain unverified here. At that point the code-map
inventory included simulation-runner scripts (105 source nodes) and its
23-node/48-edge curated graph passes validation. JavaScript syntax and Git
whitespace checks pass.

The previous simple graph contained 35 hierarchy nodes (23 curated architecture nodes
and 12 meaningful containers or functions) and 48 curated architecture
relationships. Its generated source inventory has 103 nodes for source links
only. A temporary DOM smoke check exercised decreasing circle sizes by depth,
expand/collapse, the right-hand description, source links, hidden-node search,
and reset. Earlier flow checks are historical. Headless Firefox could not
produce a screenshot in this shell, so that layout needed graphical review.

At the class-graph redesign, it had 106 source inventory nodes, 44 class/function/member
nodes, 40 implemented interactions, and six layer panels. A temporary DOM
smoke check passed expansion/collapse, the exact 1.5-to-1 parent/child radius,
color inheritance, direct-connection focus, details, layer filter, search,
zoom, and reset. Source inventory freshness, graph validation, JavaScript
syntax, and Git whitespace checks passed. The local System Visualization server returned
HTTP 200 for the viewer and its key assets. A graphical screenshot remains
unavailable in this shell.

The earlier functionality overlay had seven source-linked implemented paths. At that time, the
inventory has 108 source nodes, while the base graph still has 44 nodes, 40
interactions, and six clusters. Temporary DOM checks covered ordered arrows,
path selection/switching/clearing, filter restoration, normal node expansion,
and the larger 400-unit column, 430-unit row, and 145-unit member spacing. A graphical
browser screenshot remains unavailable in this shell.

## Preserved Runner Behavior

- Default timing is a `0.02 s` physics tick, three ticks per environment step, and `0.06 s` simulated per published scene.
- `--decision-repeat` changes ticks grouped into a step. Rendered mode is paced by default; headless mode is unpaced by default.
- Driving mistakes remain in the current episode. Destination arrival and horizon truncation advance to the next seed.
- Rendered mode starts in expert control. `T` switches modes; `W/S` changes persistent target speed; `A/D` steers with automatic return; `C` centers; `Space` brakes immediately.
- MetaDrive's per-physics-tick limiter and `F` binding remain disabled. The project runner paces complete steps.

## System Boundaries

- The connected host system has three application processes: Python MetaDrive plus adapter, native C++ gateway, and Python Dashboard. Root `scripts/start_system.sh` launches all three, enables CAN only when `--can-interface NAME` is passed, and stops siblings when one exits. Separate root launchers start each host component. Firmware is built/flashed separately and runs on the STM32; it is not a host process. The Dashboard sends mode/power requests and receives runner plus decoded ECU status through its own bridge socket; labeled simulated ECU values are fallback until a valid `0x500` sample arrives.
- Python owns lifecycle, driving controls, extraction, coordinate normalization, and automatic runner socket publication.
- C++ owns IPC reception, gateway state, CAN validation/encoding, optional SocketCAN scheduling and transport, `0x400` transmission, and `0x500` decoding/forwarding. Dashboard IPC exposes request validity, CAN availability, ECU flags, outputs, and status age. Virtual integration execution and physical hardware verification remain pending.
- STM32 owns AFS/ADB decisions, actuator commands, feedback monitoring, and independent faults/timeouts.
- Runner observation and Dashboard request/status IPC use separate Unix Domain Sockets with `SOCK_SEQPACKET` carrying versioned JSON. The Dashboard shows fresh runner ego/nearby-vehicle data and decoded ECU status with labeled fallbacks and freshness.
- CAN geometry compression and lighting decisions do not belong in Python extraction.

## Other Component Status

- `bridge/` contains the C++17/CMake runner and Dashboard servers, DBC-generated `0x100`–`0x400` encoding, SocketCAN transport/runtime, `0x500` decoding and Dashboard forwarding, conversion/decoder/IPC tests, and an opt-in vcan end-to-end test. The vcan test builds but cannot execute in this host because netlink access is restricted. The user's adapter is enumerated as `can0`; bitrate and bridge controller-loopback transmission passed; `ENOBUFS` diagnosis and physical adapter/ECU validation remain pending.
- `dashboard/` contains a native Tkinter three-section vehicle dashboard, reconnecting bridge client, and simulated ECU/fallback ego and object model. The top shows fresh nearby runner vehicles or labeled simulated fallback, the middle shows speed/steering meters and a selection-dependent forward lighting preview, and the bottom shows power/mode controls and status. Mouse-wheel and trackpad scrolling works across the main window. Mode buttons are disabled while power is off. A second native window shows detailed vehicle/ECU data. Launch with `bash dashboard/scripts/start_dashboard.sh` in a graphical Linux session; the script uses the configured MetaDrive Python environment or `DASHBOARD_PYTHON`. No localhost port is used. Root `scripts/start_system.sh` opens this Dashboard with the bridge and MetaDrive runner.
- Zephyr 3.7 is pinned for STM32 firmware. CAN RX/decode, freshness supervision, and `0x500` status TX are implemented and build successfully; the new image still needs flashing and physical CAN validation. The earlier LED image is flashed and confirmed. AFS decisions, servo/matrix drivers, feedback, and physical fallback remain future work.

## Source Locations

| Topic | Source |
|---|---|
| User run guide | [../simulation_runner/runner.md](../simulation_runner/runner.md) |
| Simulation implementation | [../simulation_runner/README.md](../simulation_runner/README.md) |
| Development scene display | [../simulation_runner/src/scene_display/README.md](../simulation_runner/src/scene_display/README.md) |
| Interactive architecture explorer | [../tools/system_visualization/README.md](../tools/system_visualization/README.md) |
| Visitor walkthrough plan | [plans/tools/system-in-action.md](plans/tools/system-in-action.md) |
| Recent prompt/change history | [prompt-tracking.md](prompt-tracking.md) |
| Python simulation architecture | [../docs/architecture/components/metadrive.md](../docs/architecture/components/metadrive.md) |
| System data flow | [../docs/architecture/data-flow.md](../docs/architecture/data-flow.md) |
| C++ gateway | [../docs/architecture/components/bridge.md](../docs/architecture/components/bridge.md) |
| CAN signal projection | [../bridge/src/can/README.md](../bridge/src/can/README.md) |
| CAN frame smoke check | [../tests/can/bridge/frame_smoke/run_can_frame_smoke.sh](../tests/can/bridge/frame_smoke/run_can_frame_smoke.sh) |
| Dashboard | [../docs/architecture/components/dashboard.md](../docs/architecture/components/dashboard.md) |
| AFS ECU | [../docs/architecture/components/afs-ecu.md](../docs/architecture/components/afs-ecu.md) |
| CAN and message specs | [../docs/can/README.md](../docs/can/README.md) |
| Verification | [../docs/verification/testing.md](../docs/verification/testing.md) |
| Agent roadmap | [roadmap.md](roadmap.md) |
| LiDAR input investigation | [plans/simulation_runner/lidar-input.md](plans/simulation_runner/lidar-input.md) |
