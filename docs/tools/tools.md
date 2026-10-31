# Tools and Environment

## Runtime Rule

The runtime platform is Linux. Run commands from the repository root and use repository-relative paths. MetaDrive, SocketCAN, the C++ bridge, Dashboard, CAN tests, and hardware-facing tools do not depend on a particular clone location or editor mount.

## Tool Summary

| Area | Tool | Role |
|---|---|---|
| Runtime OS | Linux | Simulator and SocketCAN host |
| Simulation | MetaDrive | Ego and surrounding-vehicle source |
| Simulation adapter | Python | MetaDrive lifecycle, extraction, normalization, and IPC publishing |
| Gateway | C++17 | Runner and Dashboard Unix socket services; opt-in SocketCAN TX/RX, `0x400` commands, and `0x500` status forwarding implemented |
| Gateway build | CMake | Native executable and unit/integration test targets |
| Snapshot types | Python frozen dataclasses / C++ value types | Complete observations with explicit validity/freshness |
| Gateway concurrency | `std::thread`, `std::mutex`, monotonic clock, `poll()` | Runner IPC, Dashboard IPC, and optional scheduled CAN worker |
| Local IPC | Unix Domain Sockets, `SOCK_SEQPACKET`, versioned JSON | Simulation and Dashboard clients to C++ gateway |
| CAN API | Native Linux SocketCAN | Gateway runtime transmit and receive |
| DBC handling | `cantools` as a build/test tool | Generates checked-in C pack/unpack functions used by gateway encoder and status decoder |
| CAN stack | SocketCAN | `vcan0` for tests and `can0` for hardware |
| CAN monitor | SavvyCAN, `candump`, `cansend` | Traffic inspection and injection |
| Dashboard UI | Python UI toolkit | Command and status HMI |
| Embedded target | STM32F407VET6 | Physical AFS/ADB ECU |
| Hardware debug | Logic analyzer, multimeter, ST-Link | Electrical and firmware bring-up |
| Regression checks | [Component test scripts](../../tests/scripts/test_guide.md) · [Focused test dispatcher](../../tests/scripts/test_components.sh) · [Full suite](../../tests/test_all.sh) · [Central test tree](../../tests/README.md) | Run one component/module suite, or all suites through the single root test command |
| Code map | [Interactive System Visualization](../../tools/system_visualization/README.md) | Class interactions, expandable members, and highlighted sequences for implemented functionality |
| Visitor 3D view | [System in Action](../../tools/system_visualization/system-in-action/index.html) | Static MetaDrive-to-headlight prototype render; one 8×8 MAX7219 matrix per side and no live data |
| High beam visual | [High beam visual](../../tools/system_visualization/beam-visual/beam-segments.html) | Centered matrices with low rows on and upper high-beam rows masked around vehicles |
| Low beam visual | [Low beam visual](../../tools/system_visualization/beam-visual/beam-segments.html?mode=low) | Shorter, wider rows 5–8 footprint with a steering wheel and speed bar that set both matrix angles |
| CAN messages | [CAN messages](../../tools/system_visualization/can-messages/index.html) | Signal names, byte/bit positions, meanings, and example values for the documented CAN frames |
| Hardware wiring | [Hardware wiring](../../tools/system_visualization/hardware-wiring/index.html) | Proteus-style component symbols, candidate pins, selectable wire routes, and pin-to-pin notes; not a build-ready schematic |

The Python runner, controls, ego extractor, and automatically started runner IPC publisher are under `simulation_runner/`. The C++ `bridge/` receives runner scenes and Dashboard requests on separate local Unix sockets and owns optional SocketCAN scheduling and transport. Python DBC tooling runs during generation/testing, not inside the bridge's CAN loop. The Dashboard opens as a native Tkinter window with a reconnecting Python Unix-socket client and displays forwarded ECU status.

Development-tool implementations and their detailed maintenance instructions live under the
repository-root `tools/` directory. This document provides only a concise index.
