# Tools and Environment

## Runtime Rule

The runtime platform is Linux. Run commands from the repository root and use repository-relative paths. MetaDrive, SocketCAN, the C++ bridge, Dashboard, CAN tests, and hardware-facing tools do not depend on a particular clone location or editor mount.

## Tool Summary

| Area | Tool | Role |
|---|---|---|
| Runtime OS | Linux | Simulator and SocketCAN host |
| Simulation | MetaDrive | Ego and surrounding-vehicle source |
| Simulation adapter | Python | MetaDrive lifecycle, extraction, normalization, and IPC publishing |
| Gateway | C++17 | Native communication service; proposed, not implemented |
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

The current Python runner, controls, and ego extractor are under `simulation_runner/`. The organized `bridge/` and `dashboard/` scaffolds do not yet provide runtime behavior. Runtime CAN transport will be native C++; Python DBC tooling runs during generation/testing, not inside the bridge's CAN loop. Dashboard and simulation clients exchange IPC messages, while the bridge's threads share mutex-protected state. A browser Dashboard may additionally use HTTP/WebSocket between browser and Python backend.
