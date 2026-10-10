# Agent Working Context

Read the [agent guide](README.md), relevant files in [rules/](rules/README.md), this file, and [prompt-tracking.md](prompt-tracking.md) before changing source or architecture.

## Workspace

- Commands and documentation paths are relative to the repository root.
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

- Work is paused after clarifying the process boundary: `simulation_runner` and the C++ bridge are separate processes, while the bridge's proposed IPC and CAN workers are threads within its own process. The existing design proposes a Unix `SOCK_SEQPACKET` connection from a Python IPC adapter to the bridge, then mutex-protected latest-state replacement between bridge threads. Cross-process shared memory was discussed but not selected or implemented. When work resumes, define the complete observation message, sample identity, freshness, bounded delivery, and reconnect behavior before coding IPC. See [data-flow.md](../docs/architecture/data-flow.md).
- On 2026-10-07, the runner's cached LiDAR extraction, `LidarSnapshot`, browser comparison, and dedicated launcher were removed. `SceneSnapshot` now contains only ego and registry-derived surrounding objects. The working tree remains unstaged and uncommitted for review.
- `SceneSnapshot` validates matching timestamp, source, seed, episode step, and simulation time. The browser scene payload uses schema version 2 because the LiDAR field was removed. MetaDrive's own LiDAR sensor and rendered overlay configuration remain in its environment setup; no project extractor consumes those rays.
- The latest verification passed 39 dependency-free test functions, a real one-step headless MetaDrive run (2 valid published scenes), a one-step run with the optional local scene server, Code graph inventory and graph validation (104 inventory nodes, 39 visible nodes, 35 interactions, six paths), updated temporary DOM interaction checks, JavaScript syntax, 61 Markdown link/fence/whitespace checks, and Git whitespace validation. The scene server needs local bind permission outside the sandbox; its startup succeeded when rerun with that permission. A graphical browser view was not inspected.
- The code map is a development aid for understanding the codebase, not an AFS project component,
  runtime feature, or milestone. Report tooling work separately from project progress. Every code
  change requires map synchronization in the same task against the current working tree, following
  [code_visualize.md](code_visualize.md).
- The working tree contains the completed runner latest-scene interface, surrounding extraction integration, configurable radius, sibling `scene_display` development package, Linux runtime scripts, concise `simulation_runner/runner.md`, tests, aligned documentation, and the interactive architecture explorer under `tools/system_visualization/`.
- `tools/system_visualization/` now has a class interaction graph. Implemented classes and selected entry functions are grouped into MetaDrive runner, object extraction, and scene display layer panels. Click a parent to expand or collapse methods/fields at 2/3 of the parent radius, with the same color tone. Direct upstream/downstream interactions highlight while unrelated nodes dim. Search, layer/folder filtering, pan/zoom, and a right-hand description and connection panel are available. CAN bridge, Dashboard, and firmware panels explicitly have no implemented runtime classes. Source files are linked from details, not shown as graph nodes.
- The Code graph has a Functionalities section in the right panel. Six implemented paths highlight ordered arrows for ego extraction, surrounding extraction, scene publication, browser display, manual driving, and runner startup. Selection expands required members and focuses the path start; clearing removes the overlay. Parent spacing and child offset keep arrows readable. Existing graph click, search, filter, and camera controls remain available.
- The viewer now starts and resets at 90% zoom near the first visible class. Node, layer, interaction, and functionality labels are larger. Search and layer filters return to a readable close view; selecting a long functionality path focuses its first node at readable scale, with panning and action clicks available to follow the rest. **Fit** remains the whole-map overview.
- Parent class/function positions are curated in `graph-data.js` so the runner entry, manual control, extraction branches, scene storage, and browser rendering read in a logical order within their layer panels. Search and layer filters compact visible positions without losing their relative order. Expanded children still orbit each parent.
- Parent circles have radius 54 and child circles radius 36, preserving the 1.5:1 ratio. Ordinary interaction captions appear only after selecting a node, on its direct connections. The later node enlargement and always-visible captions were rolled back at the user's request; the logical node arrangement remains.
- `bash tools/system_visualization/start_code_graph.sh` serves the viewer and repository source links at `http://127.0.0.1:8000/tools/system_visualization/`; pass a port number to change it. The local HTTP smoke check returned 200 for the viewer, generated index, and a source file.
- The standalone `tools/lidar_demo.py` PNG helper and later browser LiDAR comparison were removed at the user's request.
- `graph-data.js` is the authoritative curated class, member, layer, interaction, and parent-position model. Each node has a source inventory ID and each edge has evidence. `build_index.py` generates the bundled `code-index.js` from repository-owned application/tool sources; regenerate it when source paths, indexed Python symbols, or definition lines change. See `agents/code_visualize.md` for the maintenance workflow.
- `functionality-data.js` is the authoritative list of ordered implemented paths, separate from the base graph model. `functionality-overlay.js` highlights them; the only integration added to `viewer.js` is a path reveal/framing method.
- The root README explains how to open the Code graph and what its six functionality paths show. Agent rules require every implementation and fix to review the generated inventory, class interactions, and ordered paths in the same task; affected models are updated, validated, and reported before handoff.
- The code graph is development tooling and ready for user review. The previous simulation work and agent-folder consolidation remain unstaged and uncommitted. Inspect the existing status and diff before further changes; wait for the user's explicit request before staging or committing. Follow [committing.md](rules/committing.md).
- The rendered scene display in [runner.md](../simulation_runner/runner.md) still needs graphical inspection. The next implementation discussion is the registry-derived observation contract and IPC boundary. The [LiDAR input investigation](plans/simulation_runner/lidar-input.md) is retained as historical research, not current implementation guidance.
- Recording, replay, named scenarios, IPC, gateway runtime, Dashboard runtime, CAN behavior, and firmware behavior are outside this implementation.
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
bash tools/system_visualization/start_code_graph.sh
python3 tools/system_visualization/build_index.py --check
node tools/system_visualization/validate.mjs
node --check tools/system_visualization/graph-data.js
node --check tools/system_visualization/code-index.js
node --check tools/system_visualization/viewer.js
node --check tools/system_visualization/functionality-data.js
node --check tools/system_visualization/functionality-overlay.js
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
syntax, and Git whitespace checks passed. The local Code graph server returned
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

- There are three planned application processes: Python MetaDrive plus adapter, native C++ gateway, and Python Dashboard.
- Python owns lifecycle, driving controls, extraction, coordinate normalization, and future IPC publication.
- C++ owns IPC reception, current gateway state, CAN conversion/scheduling, SocketCAN, decoded ECU status, and communication diagnostics.
- STM32 owns AFS/ADB decisions, actuator commands, feedback monitoring, and independent faults/timeouts.
- The proposed cross-process baseline remains C++17/CMake and Unix Domain Sockets with `SOCK_SEQPACKET` carrying versioned JSON. Exact IPC fields and freshness policy remain design work.
- CAN geometry compression and lighting decisions do not belong in Python extraction.

## Other Component Status

- `bridge/` is a C++17/CMake scaffold split into `app`, `ipc`, `state`, `can`, and `diagnostics`; no runtime executable exists.
- `dashboard/` is a Python package scaffold split into `app`, `gateway_client`, and `models`; no UI or IPC implementation exists.
- DBC and STM32 firmware behavior are not implemented. `firmware/` remains unchanged.

## Source Locations

| Topic | Source |
|---|---|
| User run guide | [../simulation_runner/runner.md](../simulation_runner/runner.md) |
| Simulation implementation | [../simulation_runner/README.md](../simulation_runner/README.md) |
| Development scene display | [../simulation_runner/src/scene_display/README.md](../simulation_runner/src/scene_display/README.md) |
| Interactive architecture explorer | [../tools/system_visualization/README.md](../tools/system_visualization/README.md) |
| Recent prompt/change history | [prompt-tracking.md](prompt-tracking.md) |
| Python simulation architecture | [../docs/architecture/components/metadrive.md](../docs/architecture/components/metadrive.md) |
| System data flow | [../docs/architecture/data-flow.md](../docs/architecture/data-flow.md) |
| C++ gateway | [../docs/architecture/components/bridge.md](../docs/architecture/components/bridge.md) |
| Dashboard | [../docs/architecture/components/dashboard.md](../docs/architecture/components/dashboard.md) |
| AFS ECU | [../docs/architecture/components/afs-ecu.md](../docs/architecture/components/afs-ecu.md) |
| CAN and message specs | [../docs/can/README.md](../docs/can/README.md) |
| Verification | [../docs/verification/testing.md](../docs/verification/testing.md) |
| Agent roadmap | [roadmap.md](roadmap.md) |
| LiDAR input investigation | [plans/simulation_runner/lidar-input.md](plans/simulation_runner/lidar-input.md) |
