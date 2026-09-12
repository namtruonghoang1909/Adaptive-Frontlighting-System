# C++ Vehicle / CAN Bridge

Native Linux gateway between the Python simulation runner, Python Dashboard, and the CAN network.

The bridge is planned as a C++17 application built with CMake. It will own Unix Domain Socket IPC, current cross-thread state, CAN conversion and scheduling, raw SocketCAN TX/RX, communication diagnostics, and graceful lifecycle handling.

## Module Layout

```text
include/afs_bridge/       # public interfaces and value types
src/
|-- app/                  # composition, configuration, startup, shutdown
|-- ipc/                  # simulation and Dashboard Unix-socket endpoints
|-- state/                # complete current snapshots and synchronization
|-- can/                  # CAN conversion, scheduling, SocketCAN TX/RX
`-- diagnostics/          # freshness, health, counters, and logging
tests/                    # unit and Linux integration tests
```

The proposed runtime has a main/IPC thread and one CAN TX/RX worker thread. They exchange complete snapshots through short mutex-protected operations. The bridge does not own the AFS/ADB control algorithm; STM32 remains responsible for lighting decisions and physical output.

Only the component structure and CMake baseline exist. No gateway runtime is implemented yet.
