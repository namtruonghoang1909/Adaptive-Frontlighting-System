# C++ Bridge Component

The bridge is the native Linux gateway between the Python simulation runner, Python Dashboard, and CAN network. Its runner-facing scene receiver, Dashboard command/status socket, and latest source-state retention are implemented. Standalone APIs validate/project CAN signal values and pack the `0x100`, `0x200`, and `0x300` payloads through DBC-generated C. A separate diagnostic logger exercises those APIs with live runner IPC; the production bridge executable does not call them. Runtime CAN transport remains planned.

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
| `bridge/src/can/` | CAN signal validation/projection and DBC-generated in-memory frame packing; planned scheduling, raw SocketCAN TX/RX, and status decoding |
| `bridge/src/diagnostics/` | Planned production freshness, communication health, counters, and logging |
| `bridge/tests/` | Native unit and Linux IPC/SocketCAN integration tests |

`afs_runner_bridge` accepts the Python runner's versioned scene stream. The
standalone CAN encoder API accepts a validated scene and produces signal values
for steering, speed, and the 10-sector vehicle grid. A separate frame encoder
uses cantools-generated C signal encoders and message packers to create
in-memory frame values. The separate `afs_can_frame_logger` diagnostic
executable runs this path against live runner scenes, verifies batches with
generated C unpackers, and checks captured frames independently with cantools.
Production CAN integration, SocketCAN, and runtime CAN
diagnostics remain future work.

## IPC Clients

The simulation runner and Dashboard connect on separate Unix Domain Sockets. Both use `SOCK_SEQPACKET` with versioned JSON messages. The [runner contract](../runner-bridge-communication.md) and [Dashboard contract](../dashboard-bridge-communication.md) document their implementations and limits.

- Simulation sends complete vehicle and surrounding-object observations.
- The runner includes the active MetaDrive steering limit with each ego sample;
  the receiver validates the angle against that limit and retains a missing
  limit as unavailable for CAN validity handling.
- Dashboard sends persistent requested state and identified clear-fault actions.
- Bridge stores accepted power/mode requests with IDs, rejects clear-fault while the ECU is unavailable, and reports current runner freshness, ego fields, and a bounded list of nearby vehicles.
- Gateway acceptance and simulated ECU execution are different states in the UI. Decoded ECU status is not available yet.

The bridge never reads MetaDrive objects or UI widgets directly.

## Internal Concurrency

The current bridge runs runner IPC in the main thread and Dashboard IPC in a second thread. The runner receiver copies its latest scene under a short mutex; socket I/O and JSON handling run outside that lock. A separate CAN worker is planned for runtime scheduling and transport.

Continuous observations use latest-state replacement rather than a replay queue. Dashboard requests carry identifiers, and the client does not replay pending actions after disconnect.

## CAN And Control Ownership

The bridge's standalone API validates and projects accepted source data into
CAN signal values, then the DBC-generated C codec packs the three
runner-derived messages into in-memory frames. A diagnostic executable calls
these APIs to check live samples; the production bridge does not yet call them.
Scheduling, SocketCAN, ECU-status reception, and runtime CAN communication
diagnostics are not part of the current implementation.

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
