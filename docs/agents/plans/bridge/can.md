# C++ CAN Gateway Plan

## Status

The former Python CAN-interface plan is superseded by the [C++ gateway design](../../../architecture/components/bridge.md). The reorganized `bridge/src/can/` directory documents the native module boundary, but no CAN runtime is implemented.

## Proposed Work After Implementation Is Authorized

- Build the C++17/CMake application under `bridge/`.
- Receive simulator-independent observations and Dashboard requests through Unix socket IPC.
- Hold current snapshots inside the C++ process, shared by main/IPC and CAN-worker threads under short locks.
- Encode and schedule vehicle/object/command inputs; receive, validate, decode, and timestamp AFS status.
- Use raw Linux SocketCAN for `vcan0` tests and `can0` hardware integration.
- Generate CAN packing helpers from the shared DBC; keep timeout/counter/checksum behavior in application logic.
- Verify pure conversion, IPC failures, freshness, virtual CAN, and clean shutdown before HIL.

Exact protocol values and timing remain detailed-design work. Preserve the existing Python runner; no runtime Python CAN implementation needs replacement.
