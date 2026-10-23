# feat/bridge-ecu/can Branch Plan

## Goal

Complete the laptop-side CAN gateway on `feat/bridge-ecu/can`: transmit runner and Dashboard messages through SocketCAN, decode `0x500 AFS_Status`, forward ECU state to the native Dashboard, and verify the software path on Linux vcan. The bridge remains the only host CAN owner. The STM32 ECU retains AFS/ADB decisions, actuator outputs, input timeouts, and safe fallback. Firmware CAN implementation follows on this same branch.

## Starting Point

- Runner scene IPC and latest accepted `RunnerScene` are implemented.
- Dashboard request/status IPC and the native Dashboard are implemented.
- `CanEncoder` projects runner data; `CanFrameEncoder` uses the checked-in cantools codec.
- Optional production SocketCAN transport and scheduled runtime are implemented.

## Implementation Checklist

### SocketCAN runtime and message schedules

- [x] Add an RAII Linux raw CAN transport bound to an existing up CAN interface; keep CAN opt-in with `--can-interface NAME`.
- [x] Convert between project `CanFrame` and Linux `struct can_frame`; reject extended, remote, error, and oversized frames.
- [x] Send `0x100 Vehicle_Speed` and `0x200 Vehicle_Steering` every 20 ms, `0x300 Vehicle_Object` every 100 ms, and `0x400 Dashboard_Command` every 50 ms using monotonic deadlines.
- [x] Sample the newest runner scene and transmit invalid/fail-closed values for absent, stale, faulted, or degraded source data.
- [x] Lease `CommandValid` to an active Dashboard connection and an accepted command; clear it after disconnect.
- [x] Queue clear-fault until one successful SocketCAN write, with a valid safe-Off command if no mode request exists; reject clear-fault if CAN is disabled.
- [x] Keep request acceptance distinct from CAN send and ECU execution results.

### ECU status and Dashboard display

- [x] Receive filtered standard `0x500 AFS_Status` frames and decode through the generated DBC codec.
- [x] Validate DLC, XOR checksum, reserved fields, enum ranges, mask bounds, and alive-counter progression.
- [x] Retain the last accepted status with its host monotonic receive timestamp; rejected frames do not refresh it.
- [x] Forward decoded flags, executed mode, health, servo feedback, and applied dim-sector mask through Dashboard IPC.
- [x] Mark Dashboard status stale after 250 ms without a new accepted report; keep this as display freshness rather than ECU safety logic.
- [x] Keep simulated ECU values clearly labeled as fallback until the first valid status frame.

### Test coverage and integration

- [x] Add a `0x400` golden vector/checksum and reserved-mode rejection test.
- [x] Add pure Linux frame conversion tests for payload, DLC, padding, and unsupported frames.
- [x] Add `0x500` decoder coverage for fields, checksum, reserved bits, enums, masks, counters, and restart handling.
- [x] Add an opt-in `vcan` end-to-end test for runner-message fail-closed output, `0x400` transmission, one-frame clear-fault, Dashboard disconnect invalidation, malformed/valid `0x500`, and Dashboard status forwarding.
- [x] Build the bridge, runtime, and focused CAN tests.
- [x] Run the full bridge CTest suite (8/8, including Dashboard IPC/client mapping and Python-to-C++ runner IPC).
- [ ] Run the opt-in end-to-end test on a prepared `vcan0` interface.
- [ ] Verify the physical adapter and ECU on the bench when the adapter/ECU hardware is available.

### Project context

- [x] Update CAN message, IPC, bridge, architecture, and development documentation.
- [x] Update the roadmap, prompt history, and working context.
- [x] Synchronize Code graph nodes, interactions, and ordered Dashboard/CAN paths.

## Remaining Decisions And Limits

- ECU firmware still needs to define counter-gap handling when a scheduled host CAN write fails within a message sequence.
- Physical adapter/ECU validation requires the actual adapter, bus, and powered ECU. A vcan pass cannot verify electrical behavior, bitrate compatibility, or hardware fallback.
- STM32 firmware and physical lamp control remain outside this branch's host-side implementation.

## References

- [Bridge component design](../../docs/architecture/components/bridge.md)
- [System data flow](../../docs/architecture/data-flow.md)
- [Dashboard IPC contract](../../docs/architecture/dashboard-bridge-communication.md)
- [CAN overview](../../docs/can/README.md)
- [0x400 Dashboard_Command](../../docs/can/messages/0x400_Dashboard_Command.md)
- [0x500 AFS_Status](../../docs/can/messages/0x500_AFS_Status.md)
- [Bridge CAN module notes](../../bridge/src/can/README.md)
- [Bridge test instructions](../../bridge/tests/README.md)
- [Code graph maintenance rules](../code_visualize.md)
