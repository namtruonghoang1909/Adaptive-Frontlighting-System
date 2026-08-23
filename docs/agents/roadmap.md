# Agent Roadmap Notes

This file keeps future-work reminders for agents. It is not a public build plan.

## Near-Term Work

- Create the project DBC at `can/afs.dbc` when CAN work begins.
- Keep all CAN signal details aligned to the DBC and [../can/messages.md](../can/messages.md).
- Keep MetaDrive CAN Bridge code outside the ignored `simulation/metadrive/` tree.
- Build the MetaDrive CAN Bridge with a synthetic-output mode before binding it to MetaDrive APIs.
- Keep Dashboard, MetaDrive CAN Bridge, and firmware build details out of docs until the user asks
  for those specs.
- Update hardware docs if the selected board, transceiver, light units, servo model, LED
  driver, or power design changes.

## Open Decisions

- Final DBC signal packing and enum tables.
- Dashboard UI toolkit.
- MetaDrive steering, speed, and object-signal API mapping.
- Final feedback servo model and mounting geometry.
- Final LED zone hardware and LED driver choice.
- Servo calibration and mechanical limits.
- LED zone angles and ADB shadow margin.
- Exact CAN adapter and Linux interface name.