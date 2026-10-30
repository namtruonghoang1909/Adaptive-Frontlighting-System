# C++ Bridge Component

The bridge is the native Linux gateway between the Python simulation runner, Python Dashboard, and CAN network. Its runner-facing scene receiver, Dashboard command/status socket, production CAN scheduler, Linux SocketCAN transport, and `0x500 AFS_Status` decoder are implemented. CAN starts only when `--can-interface NAME` is provided; the selected interface must already exist and be up. The bridge sends `0x400` Dashboard commands and forwards retained ECU status through Dashboard IPC.

## Position In The System

```text
simulation_runner -- Unix socket --\
                                    C++ bridge -- SocketCAN -- CAN bus -- STM32 ECU
dashboard --------- Unix socket --/      |
                                          `-- decoded status/health back to Dashboard
```

All three host applications run on the same Linux system as separate processes. The bridge is the only production host application that owns project CAN TX/RX.

## Directory Layout

| Location | Responsibility |
|---|---|
| `bridge/CMakeLists.txt` | C++17 runner receiver library and executable |
| `bridge/can/` | Bridge-owned CAN DBC, editable with Vector CANdb++ |
| `bridge/include/afs_bridge/` | Public interfaces and value types |
| `bridge/src/app/` | Composition, configuration, startup, shutdown, and resource ownership |
| `bridge/src/ipc/` | Unix-socket clients, framing, parsing, validation, and replies |
| `bridge/src/state/` | Complete current input/status snapshots and synchronization |
| `bridge/src/can/` | CAN signal validation/projection, DBC-generated frame packing, SocketCAN transport, and ECU status decoding |
| `bridge/src/diagnostics/` | Planned production freshness, communication health, counters, and logging |
| `tests/unix_socket/` | Runner and Dashboard Unix socket integration tests |
| `tests/can/bridge/` | Bridge CAN encoding, status, SocketCAN, and vcan tests |

`afs_runner_bridge` accepts the Python runner's versioned scene stream. When
CAN is enabled, its worker samples the latest scene on monotonic deadlines,
sends `0x100 Vehicle_Speed` and `0x200 Vehicle_Steering` every 20 ms,
`0x300 Vehicle_Object` every 100 ms, and the Dashboard's `0x400` command every
50 ms, and receives filtered `0x500 AFS_Status` frames. Invalid or stale source
data is encoded using the existing fail-closed signal policy. `CommandValid`
follows the Dashboard connection lease and accepted request; clear-fault is a
single successful SocketCAN-write pulse. Decoded status is mutex-protected, logged,
and forwarded through Dashboard IPC with freshness metadata. The separate `afs_can_frame_logger` diagnostic executable
continues to verify encoder batches against generated C and cantools without
transmitting CAN.

## IPC Clients

The simulation runner and Dashboard connect on separate Unix Domain Sockets. Both use `SOCK_SEQPACKET` with versioned JSON messages. The [runner contract](../runner-bridge-communication.md) and [Dashboard contract](../dashboard-bridge-communication.md) document their implementations and limits.

- Simulation sends complete vehicle and surrounding-object observations.
- The runner includes the active MetaDrive steering limit with each ego sample;
  the receiver validates the angle against that limit and retains a missing
  limit as unavailable for CAN validity handling.
- Dashboard sends persistent requested state and identified clear-fault actions.
- Bridge stores accepted power/mode requests with IDs, rejects clear-fault while CAN is disabled, and reports runner data, command validity, CAN availability, and decoded ECU status.
- Gateway acceptance and ECU execution remain separate states in the UI. The Dashboard shows simulated ECU fallback until a valid `0x500` sample arrives and marks retained status stale after 250 ms.

The bridge never reads MetaDrive objects or UI widgets directly.

## Internal Concurrency

The current bridge runs runner IPC in the main thread and Dashboard IPC in a
second thread. When enabled, a third thread runs the CAN worker. The runner
receiver copies its latest scene under a short mutex; encoding and CAN I/O
happen outside that lock. The worker uses monotonic 20 ms and 100 ms deadlines
for vehicle inputs and the object grid, samples only the latest state, and
receives ECU status through a `0x500` ID filter and forwards accepted snapshots
to Dashboard IPC.
Transient CAN I/O failures are rate-limited in logs and retried; they do not
stop the runner or Dashboard IPC services.

Continuous observations use latest-state replacement rather than a replay queue. Dashboard requests carry identifiers, and the client does not replay pending actions after disconnect.

## CAN And Control Ownership

The bridge validates and projects accepted source data into CAN signal values,
then the DBC-generated C codec packs runner-derived messages and Dashboard
commands into frames for SocketCAN transmission. The receiver accepts standard `0x500`
frames only after checksum, reserved-field, enum, mask, and alive-counter
validation. Counter gaps up to half the four-bit range are tolerated; duplicate
or backward values are rejected, and a quiet interval permits a new baseline.
Accepted status is retained by `CanRuntime` and `DashboardIpcServer` for the
Dashboard response. `tests/can/bridge/socketcan_vcan_end_to_end.py` exercises the
command and status paths on a prepared virtual interface.

For `0x300 Vehicle_Object`, the agreed design projects vehicle footprints from
runner IPC into 10 horizontal sectors and four equal distance bands across
0–100 m. One Classical CAN DLC 8 frame carries the occupancy bit and a
cumulative four-bit subsector mask for every sector, with validity/quality
flags. Byte 0 is reserved; `GridValid` reports whether the latest source grid
is fresh and usable. Wire bit 0 is farthest and bit 3 is nearest; masks
combine by OR. Radial range uses the nearest and farthest Euclidean distances
to the full vehicle footprint, clipped to 0–100 m. Any
detected transfer/validation fault or degraded object scan invalidates the
grid and clears sector records; the ECU ignores invalid records and falls back.
The bridge reports object locations; the ECU decides which matrix pixels to
mask.

STM32 independently validates CAN inputs and owns low-beam swivel, ADB dimming, actuator commands, feedback supervision, and fallback. The bridge must not calculate final servo targets, applied dim masks, or executed lighting mode.

## Related Docs

- [metadrive.md](metadrive.md) - simulation runner and adapter.
- [dashboard.md](dashboard.md) - separate HMI and bridge client.
- [../data-flow.md](../data-flow.md) - IPC, gateway threads, freshness, and CAN flow.
- [../../can/README.md](../../can/README.md) - CAN design and message specifications.
