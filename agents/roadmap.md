# Agent Roadmap Notes

This file records future work, not authorization to implement it. Runner-to-bridge observation IPC and standalone CAN signal/frame encoding APIs are implemented; SocketCAN transport, Dashboard, and firmware work still needs a scoped implementation task. Follow the [agent guide](README.md) and [working-context.md](working-context.md).

## Proposed Migration Order

1. Preserve and validate the Python runner, controls, ego/surrounding extraction, and latest-scene interface under `simulation_runner/`. (Implemented; rendered manual validation remains.)
2. Use MetaDrive's object registry for the surrounding snapshot. (Implemented.) A former LiDAR extraction and browser comparison were removed; the [LiDAR input investigation](plans/simulation_runner/lidar-input.md) remains historical research if sensor-based detection is revisited.
3. Complete cross-process integration verification for the runner publisher and C++ receiver using the [runner–bridge communication contract](../docs/architecture/runner-bridge-communication.md).
4. Connect the standalone CAN validation/projection and DBC frame-packing APIs to bridge scheduling, SocketCAN RX/TX, and freshness handling.
5. Add golden-vector and boundary coverage for pure packing/validation, then test scheduling.
6. Integrate SocketCAN on `vcan0` with synthetic inputs and injected ECU status.
7. Connect the separate Python Dashboard through gateway IPC and verify acceptance/results/freshness.
8. Bring up the STM32 Zephyr firmware and physical `can0` HIL; keep control and fallback in the ECU firmware.
9. Retire transitional notes and tighten component-level build/run documentation after the process boundary works.

The [simulation-runner plans](plans/simulation_runner/) describe the preserved Python work; the [bridge plans](plans/bridge/) replace the superseded all-Python gateway design. No Python CAN sender currently exists to port. Keep project-owned code outside the ignored `simulation/metadrive/` dependency.

## Open Detailed-Design Decisions

- IPC fields, size limits, client roles, sample identity, and source-age/backlog policy.
- Command lifetime, reconnect behavior, request results, and duplicate action handling.
- Runtime CAN scheduling, SocketCAN transport, publication periods, and timeout handling.
- Dashboard UI toolkit; browser/backend transport if applicable.
- Steering, speed, reverse, and gateway-facing observation projection from the normalized scene snapshots.
- If sensor-based detection is revisited, its range, resolution, noise, and
  relationship to simulator metadata.
- CAN adapter/transceiver selection and hardware wiring.
- Feedback servo, LED driver, mechanical limits, physical zone angles, and calibration.

Proposed baseline choices are C++17, CMake, Unix Domain Sockets with `SOCK_SEQPACKET`, and two gateway application threads. These describe the design and can be revisited for a concrete requirement.
