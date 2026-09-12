# Agent Working Context

Read [AGENTS.md](AGENTS.md), this file, and [prompt-tracking.md](prompt-tracking.md) before changing architecture, CAN, hardware, or source.

## Workspace

- Commands and documentation paths are relative to the repository root.
- Runtime-facing MetaDrive, SocketCAN, bridge, Dashboard, and hardware commands require Linux.
- Clone locations and editor mounts are environment-specific and must not be hard-coded into project documentation or scripts.
- `simulation/metadrive/` is a large ignored upstream/local tree; search it only when examining MetaDrive itself.

## Current Refactor Design

- Latest task: reorganize the repository into `simulation_runner/`, `bridge/`, `dashboard/`, and `firmware/` components without implementing new runtime behavior. The reorganization is complete; further IPC, CAN, UI, or firmware implementation was not requested.
- The user confirmed that MetaDrive and the gateway run on the same Linux system, and that the Dashboard also communicates through the gateway.
- There are three application processes: Python MetaDrive plus adapter, native C++ gateway, and Python Dashboard.
- The adapter owns extraction and IPC publishing inside the simulation process. Python keeps lifecycle, driving controls, and simulator coordinate normalization.
- The proposed baseline is C++17/CMake, local Unix Domain Sockets with `SOCK_SEQPACKET`, and versioned JSON messages.
- The proposed gateway has a main/IPC thread and a CAN TX/RX worker. Short mutex-protected snapshot exchange occurs only inside that C++ process.
- Native SocketCAN, CAN scheduling/encoding/decoding, communication diagnostics, and Dashboard IPC belong to the gateway.
- STM32 remains Embedded C and owns AFS/ADB algorithms, actuator commands, feedback monitoring, and independent fault/timeouts.
- The DBC is a planned CAN signal dictionary. Generated C packing helpers may be shared by gateway and firmware; the IPC contract is separate.
- Source identity/age must remain distinct from CAN liveness. Exact message fields, timeout values, command-lifetime rules, and recovery behavior are not finalized.
- The old Python CAN/shared-memory/Dashboard-interface plans are superseded by C++ bridge module boundaries.
- The component layout is now `simulation_runner/`, `bridge/`, `dashboard/`, and `firmware/`. The ignored upstream MetaDrive checkout remains separate under `simulation/metadrive/`.

## Actual Implementation

- Existing source remains in `simulation_runner/src/metadrive_runner/`, its `controls/` package, and `simulation_runner/src/vehicle_extract/ego/`.
- The runner emits immutable `EgoSnapshot` objects through `on_snapshot`; the callback is the planned IPC publishing seam.
- `simulation_runner/src/ipc_adapter/` and `simulation_runner/src/vehicle_extract/surrounding/` are organized placeholders with no runtime behavior.
- `bridge/` now contains a C++17/CMake scaffold split into `app`, `ipc`, `state`, `can`, and `diagnostics`; it has no executable source yet.
- `dashboard/` now contains a Python package scaffold split into `app`, `gateway_client`, and `models`; it has no UI or IPC implementation yet.
- Native gateway behavior, Dashboard behavior, DBC, and STM32 firmware are not implemented. `firmware/` was not changed by the reorganization.
- The current embedded target remains STM32F407VE with an external CAN transceiver. Hardware details and final ADB calibration are still open.

## Documentation Resume Point

- [System overview](../architecture/overview.md) contains the process-level Mermaid flowchart, physical control/feedback paths, and a virtual-CAN note.
- [Data flow](../architecture/data-flow.md) shows the two proposed gateway threads and labels Unix socket IPC separately from in-process mutex access.
- Keep the distinction explicit: the component layout is built, while bridge IPC/CAN and Dashboard runtime behavior are only designed.
- Next design topics are IPC lifecycle/freshness, command acceptance versus execution, and a detailed implementation sequence when the user requests it.

## Previous Python Runtime Validation Handoff

- Before the architecture refactor discussion, the session paused after the MetaDrive timing model and old `F` behavior were reviewed and understood.
- Last source implementation: restored time-based automatic steering centering while preserving responsive steering/braking and the latched speed target.
- Implemented runtime code is limited to `simulation_runner/src/vehicle_extract/ego/` and `simulation_runner/src/metadrive_runner/`; the new IPC, C++ bridge, and Dashboard modules remain placeholders.
- Visual validation found project-owned environment-step pacing more representative than MetaDrive's per-physics-tick FPS limiting.
- Current timing model: `0.02 s` per physics tick, three ticks per environment step, `0.06 s` simulated per step, and approximately 16.7 paced steps/50 physics ticks per wall-clock second.
- The physics tick remains `0.02 s`; `--decision-repeat` can change the number of ticks grouped into each step when testing rendering and throughput, with `3` currently configured as the default.
- Driving mistakes are non-terminal in the project runner: crashes, road/route departure, and lane-line violations remain observable without respawning the ego vehicle. Route completion and horizon truncation still advance to the next seed.
- Old MetaDrive `F` behavior toggled between rendering each physics tick and batching the configured ticks before one render; the current runner disables that toggle and paces complete steps.
- Rendered mode injects `TargetSpeedKeyboardPolicy`, starts in expert mode, and switches with `T` to manual target-speed mode.
- In manual mode, `W/S` changes and latches target speed, `A/D` changes steering while held and returns automatically toward center after release, `C` centers steering immediately, and `Space` performs an emergency stop.
- A simulator-independent PI controller regulates throttle/brake, target changes are scaled by simulation `dt`, and expert-to-manual takeover synchronizes current vehicle state.
- The previous implementation session reported 21 direct ego, runner, and controller tests passing in Windows Python. Those tests were not rerun for this documentation task. The custom keyboard policy, steering centering, responsive control tuning, and non-terminal crash behavior still need rendered Linux validation.
- Resume by running `bash simulation_runner/scripts/start_metadrive_simulation.sh`, pressing `T`, and checking latched speed, automatic steering return, speed convergence, increased steering/brake sensitivity, emergency stop, and continued operation after a crash or road departure.
- When implementation is authorized, preserve and validate this existing simulation baseline before adding IPC, gateway, surrounding extraction, or Dashboard behavior.

## Read Order

1. [prompt-tracking.md](prompt-tracking.md)
2. [../README.md](../README.md)
3. [../architecture/overview.md](../architecture/overview.md)
4. [../architecture/components/bridge.md](../architecture/components/bridge.md)
5. [../architecture/components/metadrive.md](../architecture/components/metadrive.md)
6. [../architecture/data-flow.md](../architecture/data-flow.md)
7. [../architecture/components/dashboard.md](../architecture/components/dashboard.md)
8. [../can/README.md](../can/README.md)
9. Topic document for the file being changed.

## Source Locations

| Topic | Source |
|---|---|
| Recent prompt/change history | [prompt-tracking.md](prompt-tracking.md) |
| Python simulation runner and adapter | [../architecture/components/metadrive.md](../architecture/components/metadrive.md) |
| C++ gateway | [../architecture/components/bridge.md](../architecture/components/bridge.md) |
| Simulation-runner implementation plans | [plans/simulation_runner/](plans/simulation_runner/) |
| Bridge implementation plans | [plans/bridge/](plans/bridge/) |
| MetaDrive | [../architecture/components/metadrive.md](../architecture/components/metadrive.md) |
| Data flow | [../architecture/data-flow.md](../architecture/data-flow.md) |
| Dashboard | [../architecture/components/dashboard.md](../architecture/components/dashboard.md) |
| AFS ECU | [../architecture/components/afs-ecu.md](../architecture/components/afs-ecu.md) |
| Headlights | [../architecture/components/headlights.md](../architecture/components/headlights.md) |
| CAN and message specs | [../can/README.md](../can/README.md) |
| Tools | [../tools/tools.md](../tools/tools.md) |
| Hardware | [../hardware/hardware.md](../hardware/hardware.md) |
| Agent roadmap | [roadmap.md](roadmap.md) |
