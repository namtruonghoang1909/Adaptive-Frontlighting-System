# Agent Roadmap Notes

This file records future work, not authorization to implement it. Runner-to-bridge observation IPC, Dashboard request/status IPC, standalone CAN signal/frame encoding APIs, opt-in SocketCAN TX/RX, `0x400` transmission, `0x500` decoding/forwarding, virtual CAN integration coverage, and the STM32 ECU CAN communication/status slice are implemented. Firmware build passes for `black_f407ve`; the earlier LED image was flashed and confirmed, but the CAN image has not yet been flashed. The Ubuntu VM detects the CAN adapter as `can0` with `gs_usb`; it is configured at 500 kbit/s, and bridge frames `0x100`–`0x400` were observed through controller loopback. The reported `ENOBUFS` warning needs diagnosis; physical bus exchange and ECU firmware hardware validation remain future work. Servo/matrix control is not implemented. Follow the [agent guide](README.md) and [working-context.md](working-context.md).

## Proposed Migration Order

1. Preserve and validate the Python runner, controls, ego/surrounding extraction, and latest-scene interface under `simulation_runner/`. (Implemented; rendered manual validation remains.)
2. Use MetaDrive's object registry for the surrounding snapshot. (Implemented.) A former LiDAR extraction and browser comparison were removed; the [LiDAR input investigation](plans/simulation_runner/lidar-input.md) remains historical research if sensor-based detection is revisited.
3. Complete cross-process integration verification for the runner publisher and C++ receiver using the [runner–bridge communication contract](../docs/architecture/runner-bridge-communication.md).
4. Build a native Dashboard window with operator controls and ego/ECU status. (Implemented; simulated ECU values are fallback.)
5. Define and implement Dashboard gateway IPC, then connect live runner and ECU status to the UI. (Implemented, including decoded `0x500` status with freshness.)
6. Connect the standalone CAN APIs to scheduled SocketCAN TX/RX and decode `0x500` ECU status. (Implemented on `feat/bridge-ecu/can`; startup is opt-in through `--can-interface NAME`.)
7. Add focused coverage and integrate on a preconfigured `vcan0` with synthetic inputs and injected ECU status. (Tests are implemented and the bridge CTest suite passes 8/8; this host cannot create or access a CAN interface, so execute vcan integration on a CAN-capable Linux host.)
8. Diagnose the reported transmit queue warning, flash and verify STM32 ECU CAN reception/transmission over a physical bus, then implement servo/matrix drivers and AFS control. Keep control and fallback in the ECU firmware.
9. Add a combined `start_system` launcher that starts the MetaDrive and Dashboard windows together with the bridge and coordinates shutdown. (Deferred by user during the native Dashboard conversion.)
10. Retire transitional notes and tighten component-level build/run documentation after the process boundary works.

The [simulation-runner plans](plans/simulation_runner/) describe the preserved Python work; the [bridge plans](plans/bridge/) replace the superseded all-Python gateway design. No Python CAN sender currently exists to port. Keep project-owned code outside the ignored `simulation/metadrive/` dependency.

## Open Detailed-Design Decisions

- Physical CAN adapter/ECU HIL validation.
- Reconciliation of gateway command acceptance with ECU-reported execution.
- If sensor-based detection is revisited, its range, resolution, noise, and
  relationship to simulator metadata.
- Confirm CAN transceiver, peripheral pin, and power wiring in [wiring-draft.md](../docs/hardware/wiring-draft.md) before connecting AFS hardware. The prior LED image was flashed to `black_f407ve`; the new ECU CAN image still needs hardware validation.
- CAN adapter/transceiver module selection and physical bus wiring.
- Feedback servo, LED driver, mechanical limits, physical zone angles, and calibration.

The gateway uses C++17, CMake, and Unix Domain Sockets with `SOCK_SEQPACKET`; it runs two IPC threads and an optional third CAN worker. These describe the design and can be revisited for a concrete requirement.
