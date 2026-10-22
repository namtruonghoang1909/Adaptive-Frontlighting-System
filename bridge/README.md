# C++ Vehicle / CAN Bridge

Native Linux gateway between the Python simulation runner, Python Dashboard, and the CAN network.

The bridge is a C++17 application built with CMake. It owns Unix Domain Socket IPC and the host CAN boundary. Runner scene reception, Dashboard request/status IPC, transport-independent signal validation/projection, and DBC-generated in-memory frame encoding for `0x100`, `0x200`, and `0x300` are implemented. Production scheduling, SocketCAN TX/RX, ECU status reception, and runtime CAN diagnostics remain future work.

## Module Layout

```text
include/afs_bridge/       # public interfaces and value types
src/
|-- app/                  # composition, configuration, startup, shutdown
|-- ipc/                  # simulation and Dashboard Unix-socket endpoints
|-- state/                # complete current snapshots and synchronization
|-- can/                  # DBC schema; runtime CAN code lives under src/can/
`-- diagnostics/          # freshness, health, counters, and logging
scripts/                  # bridge launch and encoder smoke scripts
tests/                    # unit and Linux integration tests
```

The runner receiver validates messages on its IPC thread and replaces one
mutex-protected current scene. The standalone `CanEncoder` validates freshness
and source values, advances alive counters, and projects vehicle footprints
into the agreed 10-sector signal model. `CanFrameEncoder` uses the generated C
codec from [can/afs.dbc](can/afs.dbc) to produce in-memory `{CAN ID, DLC,
payload}` values. The production bridge executable does not call these APIs;
the separate diagnostic logger uses them to verify live samples. The bridge
does not own the AFS/ADB control algorithm; STM32 remains responsible for
lighting decisions and physical output.

`afs_runner_bridge` receives versioned runner scenes and serves a separate
Dashboard socket. It reports fresh ego fields and a bounded list of nearby
runner vehicles, stores the latest accepted power/mode request and its ID,
and rejects clear-fault until ECU control exists. Bridge
acceptance does not mean a CAN frame was sent or an ECU mode was executed.
CAN signal validation, vehicle-grid projection, and DBC-generated in-memory
frame packing are available as pure APIs. SocketCAN, scheduling, and ECU
status remain unimplemented. See the [Dashboard IPC contract](../docs/architecture/dashboard-bridge-communication.md).

Run the headless MetaDrive CAN encoding smoke check with:

```bash
bash bridge/scripts/run_can_frame_smoke.sh
```

It receives live runner scenes, encodes the three runner-derived frames every
20 ms, and prints representative payloads with decoded signal values. Every
batch is checked with the generated C codec and captured for an independent
cantools check against the DBC. It uses no CAN interface; set
`AFS_CAN_SMOKE_STEPS` to change the number of headless simulation steps.

Build and start the runner receiver with one command:

```bash
bash bridge/scripts/run_runner_bridge.sh
```

The script configures and compiles the receiver, then runs it in the foreground.
Pass `--socket PATH` for the runner socket or `--dashboard-socket PATH` for
the Dashboard socket after the script name. Set
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

The Dashboard connects to `$XDG_RUNTIME_DIR/afs/dashboard-bridge.sock`, or
`/tmp/afs-<uid>/dashboard-bridge.sock` without `XDG_RUNTIME_DIR`. Set
`AFS_DASHBOARD_SOCKET` in both processes for a custom shared path.
