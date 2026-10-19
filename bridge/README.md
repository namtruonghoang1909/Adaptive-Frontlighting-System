# C++ Vehicle / CAN Bridge

Native Linux gateway between the Python simulation runner, Python Dashboard, and the CAN network.

The bridge is a C++17 application built with CMake. It owns Unix Domain Socket IPC, current cross-thread state, CAN conversion and scheduling, raw SocketCAN TX/RX, communication diagnostics, and graceful lifecycle handling as those modules are implemented.

## Module Layout

```text
include/afs_bridge/       # public interfaces and value types
src/
|-- app/                  # composition, configuration, startup, shutdown
|-- ipc/                  # simulation and Dashboard Unix-socket endpoints
|-- state/                # complete current snapshots and synchronization
|-- can/                  # CAN conversion, scheduling, SocketCAN TX/RX
`-- diagnostics/          # freshness, health, counters, and logging
scripts/                  # CMake build-and-run launcher
tests/                    # unit and Linux integration tests
```

The runner receiver validates messages on its IPC thread and replaces one
mutex-protected current scene. CAN worker, SocketCAN, Dashboard, and decoded ECU
status behavior are future modules. The bridge does not own the AFS/ADB control
algorithm; STM32 remains responsible for lighting decisions and physical output.

The runner IPC boundary is implemented: `afs_runner_bridge` receives versioned
scene packets and retains the newest valid scene. CAN conversion, SocketCAN,
Dashboard IPC, and ECU status remain unimplemented.

Build and start the runner receiver with one command:

```bash
bash bridge/scripts/run_runner_bridge.sh
```

The script configures and compiles the receiver, then runs it in the foreground.
Pass `--socket PATH` after the script name to override the socket path. Set
`AFS_BRIDGE_BUILD_DIR` or `AFS_BRIDGE_BUILD_TYPE` to customize the CMake build.

Run the receiver integration test with:

```bash
cmake -S bridge -B build/bridge
cmake --build build/bridge --target afs_runner_ipc_integration_test
ctest --test-dir build/bridge --output-on-failure
```

Start MetaDrive normally; the runner always publishes and retries until this
receiver is available. Set `AFS_BRIDGE_SOCKET` for a custom path; otherwise both
applications use `$XDG_RUNTIME_DIR/afs/runner-bridge.sock`, falling back to
`/tmp/afs-<uid>/runner-bridge.sock` when `XDG_RUNTIME_DIR` is unset.
The receiver prints each accepted scene packet as JSON in its terminal so you
can inspect the messages while testing.
