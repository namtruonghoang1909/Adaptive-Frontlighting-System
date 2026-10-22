# Tools and Environment

## Runtime Rule

The runtime platform is Linux. Run commands from the repository root and use repository-relative paths. MetaDrive, SocketCAN, the C++ bridge, Dashboard, CAN tests, and hardware-facing tools do not depend on a particular clone location or editor mount.

## Tool Summary

| Area | Tool | Role |
|---|---|---|
| Runtime OS | Linux | Simulator and SocketCAN host |
| Simulation | MetaDrive | Ego and surrounding-vehicle source |
| Simulation adapter | Python | MetaDrive lifecycle, extraction, normalization, and IPC publishing |
| Gateway | C++17 | Runner-facing Unix socket receiver implemented; CAN and Dashboard services planned |
| Gateway build | CMake | Native executable and unit/integration test targets |
| Snapshot types | Python frozen dataclasses / C++ value types | Complete observations with explicit validity/freshness |
| Gateway concurrency | `std::thread`, `std::mutex`, monotonic clock, `poll()` | Proposed main/IPC thread plus CAN TX/RX worker |
| Local IPC | Unix Domain Sockets, `SOCK_SEQPACKET`, versioned JSON | Simulation and Dashboard clients to C++ gateway |
| CAN API | Native Linux SocketCAN | Gateway runtime transmit and receive |
| DBC handling | `cantools` as a build/test tool | Proposed generation of C pack/unpack functions for gateway and firmware |
| CAN stack | SocketCAN | `vcan0` for tests and `can0` for hardware |
| CAN monitor | SavvyCAN, `candump`, `cansend` | Traffic inspection and injection |
| Dashboard UI | Python UI toolkit | Command and status HMI |
| Embedded target | STM32F407VE | Physical AFS/ADB ECU |
| Hardware debug | Logic analyzer, multimeter, ST-Link | Electrical and firmware bring-up |
| Code map | [Interactive System Visualization](../../tools/system_visualization/README.md) | Class interactions, expandable members, and highlighted sequences for implemented functionality |
| Visitor 3D view | [System in Action](../../tools/system_visualization/system-in-action/index.html) | Static MetaDrive-to-headlight prototype render; one 8×8 MAX7219 matrix per side and no live data |
| High beam visual | [High beam visual](../../tools/system_visualization/beam-visual/beam-segments.html) | Centered matrices with low rows on and upper high-beam rows masked around vehicles |
| Low beam visual | [Low beam visual](../../tools/system_visualization/beam-visual/beam-segments.html?mode=low) | Shorter, wider rows 5–8 footprint with a steering wheel and speed bar that set both matrix angles |
| CAN messages | [CAN messages](../../tools/system_visualization/can-messages/index.html) | Signal names, byte/bit positions, meanings, and example values for the documented CAN frames |

The Python runner, controls, ego extractor, and automatically started runner IPC publisher are under `simulation_runner/`. The C++ `bridge/` receives runner scenes and Dashboard requests on separate local Unix sockets; CAN transport remains planned. Runtime CAN transport will be native C++; Python DBC tooling runs during generation/testing, not inside the bridge's CAN loop. The Dashboard opens as a native Tkinter window with a reconnecting Python Unix-socket client.

Development-tool implementations and their detailed maintenance instructions live under the
repository-root `tools/` directory. This document provides only a concise index.
