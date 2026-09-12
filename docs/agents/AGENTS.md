# Project Guidance For Agents

Read [../AGENTS.md](../AGENTS.md), [working-context.md](working-context.md), and [prompt-tracking.md](prompt-tracking.md) before updating project architecture or handoff notes.

## Current Repository State

- `simulation_runner/` is the Python simulation application. Its MetaDrive runner, controls, ego extractor, scripts, and tests were moved intact from the former Python `bridge/`.
- `simulation_runner/src/ipc_adapter/` is an organized placeholder; IPC publishing is not implemented.
- `bridge/` is now the C++17/CMake vehicle and CAN gateway. Its app, IPC, state, CAN, diagnostics, include, and test areas contain responsibility notes only.
- `dashboard/` is an organized Python package scaffold. UI and gateway-client behavior are not implemented.
- `firmware/` remains the STM32 Embedded C component and was not changed by the reorganization.
- Surrounding extraction, DBC, native gateway runtime, Dashboard runtime, and STM32 firmware remain unimplemented.
- There was no implemented Python CAN sender to port.

## Runtime Boundaries

- Three application processes run on the same Linux system: Python simulation plus adapter, C++ bridge, and Python Dashboard.
- MetaDrive lifecycle, driving controls, extraction, coordinate normalization, and IPC publishing belong to `simulation_runner/`.
- Dashboard commands and status pass through the bridge. The Dashboard never opens SocketCAN or reads bridge memory.
- The C++ bridge is the sole production host owner of project CAN TX/RX and communication diagnostics.
- STM32 owns AFS/ADB decisions, actuator commands, feedback checks, and independent fault/timeout handling.
- Gateway object conversion may compress geometry into a CAN representation. Glare decisions, dimming output, and swivel targets remain on STM32.

## Proposed Technical Baseline

- C++17 and CMake.
- Unix Domain Sockets with `SOCK_SEQPACKET` and versioned JSON for the two local Python clients.
- A main/IPC thread and one CAN TX/RX worker inside the bridge, exchanging complete snapshots under a short mutex.
- Latest-state replacement for continuous observations; identified bounded work for momentary actions.
- Source freshness remains separate from IPC connection state and CAN alive counters.

These are design choices, not implemented behavior. Exact IPC fields, timing, reconnect policy, command lifetime, and CAN details still require detailed design.

## CAN And Verification

- Future `can/afs.dbc` defines CAN bits, scaling, units, and enums; the IPC specification is a separate contract.
- DBC-derived C packing functions may be compiled into both C++ bridge and C firmware. Timeouts, counters/checks, multi-frame assembly, and control logic remain explicit application behavior.
- `vcan0` tests host transport. Full SIL also needs a software ECU; physical HIL uses `can0`, a CAN adapter/transceiver path, STM32, and the rig.
- Treat historical test results as historical and report only checks run in the current task.

## Documentation Workflow

1. Read [../architecture/overview.md](../architecture/overview.md), [../architecture/data-flow.md](../architecture/data-flow.md), and the affected component page.
2. Inspect actual directories before describing current implementation.
3. Keep plans under `plans/simulation_runner/` or `plans/bridge/` according to ownership.
4. Keep Mermaid process and thread boundaries explicit; include prose for readers without diagram rendering.
5. Update working context and the latest-ten prompt history when paths, architecture, or resume state change.
6. Check active links, code fences, whitespace, and stale paths. Do not install dependencies merely to verify documentation.
