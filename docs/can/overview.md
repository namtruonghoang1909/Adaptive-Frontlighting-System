# CAN Overview

The AFS/ADB prototype uses CAN between the Linux host tools and the physical STM32F407VE AFS
ECU. The actual bus contract should be a DBC file, expected at `can/afs.dbc` when it is
created.

## Bus Shape

| Item | Current direction |
|---|---|
| Bus type | Classical CAN |
| Identifier type | 11-bit standard IDs |
| Nominal bitrate | 500 kbit/s |
| Host interface | SocketCAN `vcan0` for virtual tests, `can0` for hardware |
| Host encoding | MetaDrive CAN Bridge uses `cantools` with `can/afs.dbc` |
| Host transmit | MetaDrive CAN Bridge uses `python-can` on SocketCAN |
| DBC use | Dashboard, MetaDrive CAN Bridge, logs, tests, and firmware should use the same DBC |

## Signal Intent

- Angles are human-readable degrees.
- Speed is human-readable km/h.
- Distance is human-readable meters.
- Modes and states should use DBC value tables.
- ADB perception input should be compact object-level data, not raw lidar arrays.
- Reserved or unused fields should be explicit in the DBC.
- Exact bit packing belongs in the DBC, not in architecture docs.

## Ownership

Once `can/afs.dbc` exists, it is the source of truth for frame names, signals, scaling, and
enums. These Markdown files are orientation notes only.