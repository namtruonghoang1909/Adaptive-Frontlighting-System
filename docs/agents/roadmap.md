# Agent Roadmap Notes

This file records future work, not authorization to implement it. The component trees have been reorganized; runtime IPC, CAN, Dashboard, and firmware work still requires an explicit implementation task. Follow [AGENTS.md](AGENTS.md) and [working-context.md](working-context.md).

## Proposed Migration Order

1. Preserve and validate the existing Python runner, controls, and ego extraction under `simulation_runner/`. (Organization complete.)
2. Specify the simulator-independent IPC messages, validity, sample/session identity, and reconnect/freshness behavior.
3. Add an optional Python publisher and a C++17/CMake IPC receiver while retaining standalone simulation use.
4. Define the DBC and native CAN conversion, then test pure packing/validation/scheduling.
5. Integrate SocketCAN on `vcan0` with synthetic inputs and injected ECU status.
6. Connect the separate Python Dashboard through gateway IPC and verify acceptance/results/freshness.
7. Bring up STM32 and physical `can0` HIL; keep control and fallback in Embedded C.
8. Retire transitional notes and tighten component-level build/run documentation after the process boundary works.

The [simulation-runner plans](plans/simulation_runner/) describe the preserved Python work; the [bridge plans](plans/bridge/) replace the superseded all-Python gateway design. No Python CAN sender currently exists to port. Keep project-owned code outside the ignored `simulation/metadrive/` dependency.

## Open Detailed-Design Decisions

- IPC fields, size limits, client roles, sample identity, and source-age/backlog policy.
- Command lifetime, reconnect behavior, request results, and duplicate action handling.
- Final DBC packing, enums, counters/checksum rules, publication periods, and timeouts.
- Dashboard UI toolkit; browser/backend transport if applicable.
- Steering, speed, reverse, and surrounding-object normalization.
- CAN adapter/transceiver selection and hardware wiring.
- Feedback servo, LED driver, mechanical limits, physical zone angles, and calibration.

Proposed baseline choices are C++17, CMake, Unix Domain Sockets with `SOCK_SEQPACKET`, and two gateway application threads. These describe the design and can be revisited for a concrete requirement.
