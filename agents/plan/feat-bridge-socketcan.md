# feat/bridge/can Branch Plan

## Goal

Connect the existing runner-to-bridge scene receiver and transport-independent CAN encoders to the Linux CAN bus through SocketCAN. The production C++ bridge should transmit runner-derived 0x100 Vehicle_Speed, 0x200 Vehicle_Steering, and 0x300 Vehicle_Object frames, and receive/decode 0x500 AFS_Status frames. The native Dashboard and its bridge request/status IPC are implemented on `feat/dashboard`; this plan retains its previously defined CAN scope. Verify transport with Linux vcan0 before any hardware integration.

The branch ends at the host gateway boundary. The STM32 ECU retains AFS/ADB decisions, physical outputs, input timeouts, and safe fallback.

## Starting Point

- Runner IPC and its latest accepted RunnerScene interface are implemented.
- Dashboard IPC runs on a separate socket. The bridge retains accepted power/mode requests and IDs, reports runner status, and currently reports ECU status as unavailable.
- CanEncoder validates runner inputs and prepares signal values; CanFrameEncoder packs the three runner-derived frames with the checked-in cantools codec.
- afs_can_frame_logger exercises those APIs at 20 ms cadence, verifies generated-code round trips, and writes JSONL diagnostic captures. It does not transmit CAN.
- The production afs_runner_bridge executable runs runner and Dashboard IPC servers. No SocketCAN transport, production CAN worker, or ECU status decoder exists yet.
- The DBC defines 0x500 AFS_Status and its generated unpacker. Dashboard_Command 0x400 is also defined and the Dashboard source path is implemented, but runtime transmission of that command remains outside this plan's previously defined scope.

## Scope

### 1. Add a SocketCAN transport boundary

- [ ] Add a small RAII transport class under bridge/ that opens a Linux raw CAN socket, binds it to a named interface, sends standard Classical CAN frames, receives frames, and closes the file descriptor on shutdown.
- [ ] Require explicit interface selection through the bridge option --can-interface NAME. Require the interface to exist and be configured/up before starting; the bridge does not create interfaces, set bitrate, or change link state.
- [ ] Convert the project's CanFrame value to/from Linux struct can_frame at this boundary. Keep DBC packing in CanFrameEncoder and keep SocketCAN unaware of signal meanings.
- [ ] Configure receive filtering for the ECU status ID and make reads/writes pollable so transmit deadlines and receive traffic share one worker without blocking indefinitely.
- [ ] Report interface, bind, read, and write failures through bridge diagnostics; ensure socket resources are closed during normal shutdown and error handling.

### 2. Integrate scheduled transmission into the production bridge

- [ ] Compose the existing RunnerIpcServer, CanEncoder, CanFrameEncoder, and SocketCAN transport in the production bridge application.
- [ ] Run one CAN worker that reads a thread-safe copy of the latest accepted runner scene, encodes one batch, and sends 0x100, 0x200, and 0x300 every 20 ms.
- [ ] Use monotonic deadlines. Always encode the newest available scene; do not queue or replay missed intermediate observations.
- [ ] Continue sending invalid/fail-closed signal values when runner data is absent, stale, faulted, or degraded, so the ECU can clear unusable inputs and apply its own fallback policy.
- [ ] Keep source-sample freshness separate from CAN transmit cadence and alive counters. Track partial send failures so the counter behavior agrees with ECU receive validation.
- [ ] Coordinate worker stop, socket close, and runner IPC shutdown so the bridge exits cleanly.

### 3. Receive and decode ECU status

- [ ] Receive standard 0x500 AFS_Status frames with DLC 8 and decode signals using the checked-in generated C codec.
- [ ] Validate reserved fields, enum ranges, the documented XOR checksum over bytes 0 through 6, and alive-counter progression before accepting a status update.
- [ ] Replace a mutex-protected latest accepted status snapshot with its host monotonic receive timestamp. A rejected frame must not refresh the accepted-status timestamp.
- [ ] Log accepted status and receive/validation faults for this branch. Connecting decoded ECU status to the existing Dashboard status IPC remains follow-up work unless explicitly added to this branch's scope.

### 4. Verify transport and keep project context aligned

- [ ] Add focused unit coverage for frame-to-SocketCAN conversion and AFS_Status validation.
- [ ] Add Linux integration coverage using a preconfigured vcan0 interface: observe the three transmitted IDs and payloads, inject valid 0x500 status, and reject malformed status frames.
- [ ] Cover absent/stale runner input, SocketCAN send/receive errors, and clean worker shutdown without requiring a physical CAN adapter.
- [ ] Build the bridge and run its CTest suite plus the SocketCAN/vcan0 integration checks.
- [ ] Update bridge, CAN, architecture, and verification docs to distinguish implemented transport from hardware validation and future Dashboard work.
- [ ] Review and synchronize the Code graph source inventory, class interactions, and ordered functionality paths for the production CAN worker and SocketCAN transport; run the required graph checks.

## Out Of Scope

- Runtime transmission of 0x400 Dashboard_Command. The DBC definition, Dashboard UI, and bridge IPC request path exist, but the command's CAN transmission and lifetime policy are not included in this plan.
- Reworking the native Dashboard UI or its implemented bridge IPC protocol.
- STM32 firmware, AFS/ADB decisions, actuator control, and physical HIL validation.
- Python CAN encoding or SocketCAN access.
- DBC bit-layout changes unless implementation uncovers a documented schema defect.

## Decisions To Close Before Or During Implementation

- Alive-counter behavior when a scheduled SocketCAN write fails partway through a frame batch. CanEncoder currently advances counters once per encode cycle; ECU counter validation must tolerate or explicitly reject the resulting gap.
- Whether a bound interface entering bus-off keeps the bridge alive while reporting transport unavailable, or causes the CAN worker to stop and require a restart.
- Whether decoded ECU status should be added to the existing Dashboard IPC response in this branch or a follow-up change.

## Completion Criteria

- The production bridge sends complete 0x100, 0x200, and 0x300 frames on a 20 ms schedule over a configured SocketCAN interface.
- A missing or stale runner scene is never transmitted as fresh valid input.
- Valid 0x500 frames are decoded and retained; frames with a bad identifier, DLC, checksum, reserved field, enum, or alive counter are rejected and do not refresh status freshness.
- vcan0 integration verifies both TX and RX without a physical adapter.
- Socket and worker shutdown are deterministic, and the bridge, documentation, and Code graph agree about implemented behavior.

## References

- [Bridge component design](../../docs/architecture/components/bridge.md)
- [System data flow](../../docs/architecture/data-flow.md)
- [CAN overview](../../docs/can/README.md)
- [0x100 Vehicle_Speed](../../docs/can/messages/0x100_Vehicle_Speed.md)
- [0x200 Vehicle_Steering](../../docs/can/messages/0x200_Vehicle_Steering.md)
- [0x300 Vehicle_Object](../../docs/can/messages/0x300_Vehicle_Object.md)
- [0x400 Dashboard_Command](../../docs/can/messages/0x400_Dashboard_Command.md)
- [0x500 AFS_Status](../../docs/can/messages/0x500_AFS_Status.md)
- [Bridge CAN module notes](../../bridge/src/can/README.md)
- [Prior CAN encoding branch checklist](feat-bridge-can-encoding.md)
- [Code graph maintenance rules](../code_visualize.md)
