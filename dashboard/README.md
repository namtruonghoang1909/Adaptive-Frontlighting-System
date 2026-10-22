# AFS Dashboard

Native Tkinter Dashboard for operator requests and AFS status. It exchanges
commands and status with the C++ bridge over a local Unix socket. Runner speed,
steering, position, heading, and nearby vehicles are shown when fresh and
available. ECU data and fallback values are clearly marked as simulated. No
browser or localhost port is needed.

## Run

From the repository root:

```bash
bash dashboard/scripts/start_dashboard.sh
```

The script selects the configured MetaDrive Python environment, sets the
Dashboard import path, and opens the Dashboard window. Close the window to
exit. Set `DASHBOARD_PYTHON` to use another Python interpreter with Tkinter.

The window has three sections:

- **Top:** a top-down surrounding-object view. Fresh valid runner vehicles
  arrive through the bridge; simulated positions are labeled as a fallback.
- **Middle:** speed and steering gauges with their captions below the meters.
  Fresh runner speed and steering replace labeled demo fallback values. The
  picture between the gauges previews the selected lighting mode, including
  fixed low beam, swivel low beam, full high beam, an unlit ADB preview sector
  around a sample vehicle, and off.
- **Bottom:** headlight power and mode controls, request feedback, ECU health,
  and bridge state. Turning the headlights off greys out and disables mode
  buttons; turning them on restores the last selected mode.

Open **Detailed status** for live position and heading when available, plus the
simulated proximity grid, faults, servo feedback,
dim sectors, and the clear-fault action in a second window.

The UI keeps the operator request, bridge acceptance, and simulated ECU
execution separate. Accepted requests are retained by the bridge, but do not
reach CAN or the ECU yet. Clear fault is rejected while ECU control is absent.
The selection preview updates immediately, even when the bridge is offline;
the request result still reports that failure. Commands are not replayed. The
bridge retains the accepted request ID so the Dashboard can reconcile an
in-flight command after reconnecting.

Start the bridge separately with `bash bridge/scripts/run_runner_bridge.sh`.
Both programs use `$XDG_RUNTIME_DIR/afs/dashboard-bridge.sock`, falling back to
`/tmp/afs-<uid>/dashboard-bridge.sock`. Set `AFS_DASHBOARD_SOCKET` for both,
or pass `--dashboard-socket PATH` to the bridge and `--socket PATH` to the
Dashboard. The [IPC contract](../docs/architecture/dashboard-bridge-communication.md)
describes message fields and freshness.

## Source Layout

```text
src/afs_dashboard/
|-- app/
|   `-- window.py          # Native Tkinter window and controls
|-- gateway_client/client.py # Reconnecting bridge IPC client
`-- models/state.py        # Simulated ECU and fallback ego values
scripts/start_dashboard.sh  # Native window launcher
```

The Dashboard does not open SocketCAN, pack CAN frames, or access bridge process
memory. See [the component architecture](../docs/architecture/components/dashboard.md)
for ownership and remaining ECU integration.

A future combined launcher can start this window and the MetaDrive process
together. That launcher is not part of the current Dashboard command.
