# C++ Vehicle / CAN Bridge

Native Linux gateway between the Python simulation runner, Python Dashboard, and the CAN network.

The bridge is a C++17 application built with CMake. It owns Unix Domain Socket IPC and the host CAN boundary. Runner scene reception, Dashboard request/status IPC, per-message CAN scheduling (`0x100`/`0x200` every 20 ms, `0x300` every 100 ms, and `0x400` every 50 ms), Linux SocketCAN TX/RX, and `0x500 AFS_Status` decoding/forwarding are implemented. CAN is opt-in: the runner and Dashboard IPC servers can run without a CAN adapter, or `--can-interface NAME` binds the CAN worker to an already configured interface.

## Module Layout

```text
include/afs_bridge/       # public interfaces and value types
src/
|-- app/                  # composition, configuration, startup, shutdown
|-- ipc/                  # simulation and Dashboard Unix-socket endpoints
|-- state/                # complete current snapshots and synchronization
|-- can/                  # DBC schema and CAN encoders/transport
`-- diagnostics/          # freshness, health, counters, and logging
scripts/                  # bridge launch and encoder smoke scripts
tests/                    # unit and Linux integration tests
```

The runner receiver validates messages on its IPC thread and replaces one
mutex-protected current scene. With CAN enabled, `CanRuntime` samples that
latest scene every 20 ms, uses `CanEncoder` and `CanFrameEncoder` to send
`0x100` and `0x200` every 20 ms, `0x300` every 100 ms, and the Dashboard's
`0x400` command every 50 ms. It listens for filtered `0x500` status and
forwards decoded snapshots through Dashboard IPC. `CommandValid` follows the
Dashboard connection lease, and clear-fault is a one-successful-SocketCAN-write
pulse. The ECU timeout for `0x300` is 250 ms to tolerate one missed periodic
frame plus timing margin. The suggested ECU reporting period for `0x500` is
50 ms. The transport binds only to an existing, up CAN
interface; it does not configure
interfaces or bitrates. Send/receive errors are logged and retried while the
IPC services remain available. Accepted ECU status is retained inside the
CAN runtime, logged, and included in Dashboard status IPC. The
bridge does not own the AFS/ADB control algorithm; STM32 remains responsible
for lighting decisions and physical output.

`afs_runner_bridge` receives versioned runner scenes and serves a separate
Dashboard socket. It reports fresh ego fields and a bounded list of nearby
runner vehicles, stores the latest accepted power/mode request and its ID, and
reports the latest accepted ECU status with freshness. Clear-fault is rejected
if CAN is disabled; otherwise it is queued as a one-frame pulse. Bridge
acceptance does not mean an ECU mode was executed. See the [Dashboard IPC
contract](../docs/architecture/dashboard-bridge-communication.md).

Start the production bridge with CAN disabled (runner and Dashboard IPC only):

```bash
bash bridge/scripts/run_runner_bridge.sh
```

To enable CAN, pass an existing configured interface name:

```bash
bash bridge/scripts/run_runner_bridge.sh --can-interface can0
```

The same option can select a preconfigured `vcan0`. The bridge requires the
interface to exist, be up, and be a CAN device. It does not create a virtual
interface, change link state, or configure bitrate. Use the operating-system
network tools to prepare the interface before launching the bridge.

Run the headless MetaDrive CAN encoding smoke check with:

```bash
bash bridge/scripts/run_can_frame_smoke.sh
```

It receives live runner scenes, encodes diagnostic batches every 20 ms, and
prints representative payloads with decoded signal values. This diagnostic
cadence is separate from production SocketCAN scheduling. Every
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
