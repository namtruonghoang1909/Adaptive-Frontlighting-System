# C++ Bridge Component

The bridge is the native Linux gateway between the Python simulation runner, Python Dashboard, and CAN network. Its organized scaffold is under `bridge/`; runtime behavior is not implemented yet.

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
| `bridge/CMakeLists.txt` | C++17 project baseline and future targets |
| `bridge/include/afs_bridge/` | Public interfaces and value types |
| `bridge/src/app/` | Composition, configuration, startup, shutdown, and resource ownership |
| `bridge/src/ipc/` | Unix-socket clients, framing, parsing, validation, and replies |
| `bridge/src/state/` | Complete current input/status snapshots and synchronization |
| `bridge/src/can/` | CAN conversion, scheduling, raw SocketCAN TX/RX, and status decoding |
| `bridge/src/diagnostics/` | Freshness, communication health, counters, and logging |
| `simulation_runner/tests/` | Native unit and Linux IPC/SocketCAN integration tests |

The directories currently contain responsibility notes only. There is no gateway executable yet.

## IPC Clients

The simulation runner and Dashboard connect separately through Unix Domain Socket IPC. The proposed contract uses `SOCK_SEQPACKET` with versioned JSON messages.

- Simulation sends complete vehicle and surrounding-object observations.
- Dashboard sends persistent requested state and identified momentary actions.
- Bridge returns command acceptance, ECU-reported status, source freshness, and bridge health.
- Gateway acceptance and ECU execution are different states in the protocol and UI.

The bridge never reads MetaDrive objects or UI widgets directly.

## Internal Concurrency

The proposed gateway has a main/IPC thread and one CAN TX/RX worker. They exchange complete value snapshots inside the C++ process with short `std::mutex`-protected copy/replacement operations. Parsing, network I/O, encoding, and logging occur after releasing the lock.

Continuous observations use latest-state replacement rather than a replay queue. Discrete actions use identifiers and bounded pending work. Additional threads, queues, or condition variables require a concrete workload need.

## CAN And Control Ownership

The bridge converts accepted source data into the CAN representation, schedules transmissions, receives ECU status, and reports communication failures. A future DBC-derived codec will define mechanical packing.

STM32 independently validates CAN inputs and owns low-beam swivel, ADB dimming, actuator commands, feedback supervision, and fallback. The bridge must not calculate final servo targets, applied dim masks, or executed lighting mode.

## Related Docs

- [metadrive.md](metadrive.md) - simulation runner and adapter.
- [dashboard.md](dashboard.md) - separate HMI and bridge client.
- [../data-flow.md](../data-flow.md) - IPC, gateway threads, freshness, and CAN flow.
- [../../can/README.md](../../can/README.md) - CAN design and message specifications.
