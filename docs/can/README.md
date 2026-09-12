# CAN Docs

This folder gives a short orientation to the project CAN bus and links to the current
human-readable message specs. These Markdown files are design documentation until
`can/afs.dbc` exists. Once the DBC is created, it becomes the source of truth for frame
names, signal packing, scaling, enum tables, and value validation.

## Folder Shape

```text
docs/can/
|-- README.md
`-- messages/
    |-- 0x100_AFS_Status.md
    |-- 0x200_Vehicle_Steering.md
    |-- 0x300_Vehicle_Speed.md
    |-- 0x310_Vehicle_Object.md
    `-- 0x400_Dashboard_Command.md
```

`messages/` contains one detailed Markdown spec per frame. It does not need its own README or
message index file.

## Bus Summary

| Item | Value |
|---|---|
| CAN type | Classical CAN |
| Identifier type | 11-bit standard ID |
| Nominal bitrate | 500 kbit/s |
| Host interface | SocketCAN `vcan0` for virtual tests, `can0` for hardware |
| Host CAN owner | Proposed C++17 gateway |
| Host encoding/decoding | Planned DBC-derived native codec; `cantools` is a generation/test tool |
| Host transmit/receive | Raw Linux SocketCAN in the C++ gateway |
| Dashboard role | Python HMI; requests and decoded status through gateway Unix socket IPC |
| DLC | Message-specific and defined by the DBC; receivers reject frames whose DLC does not match the expected value |
| Byte order | Little-endian for multi-byte integers |
| Alive counter | 4-bit rolling counter in byte `0` bits `0..3`, increments by 1 modulo 16 |
| Checksum | Optional per-frame application checksum where payload space allows; `0x310` uses all remaining bytes for distance codes |
| Reserved fields | Transmit as `0`; each message file defines whether receivers ignore or reject nonzero reserved bits |

The alive counter is placed at the first payload bits for consistency and quick inspection.
It is not a CAN rule, and it does not make the following bytes unreadable by itself. The
receiver should first accept the frame ID, DLC, checksum where present, and reserved fields,
then use alive-counter sequence and timeout checks to decide whether decoded data is fresh
enough for control.

## Current Messages

The message specifications use "C++ bridge CAN module" for the native gateway's CAN boundary. The repository reorganization does not finalize or change the provisional signal values or byte layouts.

| ID | Name | Bus producer | Bus consumer | Purpose | Detail |
|---:|---|---|---|---|---|
| `0x100` | `AFS_Status` | AFS ECU | C++ bridge CAN module | ECU executed status decoded by the bridge and displayed by the Dashboard | [messages/0x100_AFS_Status.md](messages/0x100_AFS_Status.md) |
| `0x200` | `Vehicle_Steering` | C++ bridge CAN module | AFS ECU | Simulated steering input | [messages/0x200_Vehicle_Steering.md](messages/0x200_Vehicle_Steering.md) |
| `0x300` | `Vehicle_Speed` | C++ bridge CAN module | AFS ECU | Simulated speed input | [messages/0x300_Vehicle_Speed.md](messages/0x300_Vehicle_Speed.md) |
| `0x310` | `Vehicle_Object` | C++ bridge CAN module | AFS ECU | Two-frame nearest-distance sector grid for ADB beam dodging | [messages/0x310_Vehicle_Object.md](messages/0x310_Vehicle_Object.md) |
| `0x400` | `Dashboard_Command` | C++ bridge CAN module | AFS ECU | Dashboard HMI command encoded and sent by the bridge | [messages/0x400_Dashboard_Command.md](messages/0x400_Dashboard_Command.md) |

## Signal Intent

| Message | Main signals |
|---|---|
| `Vehicle_Steering` | Alive counter, steering angle, steering rate, validity, saturation |
| `Vehicle_Speed` | Alive counter, ego speed, acceleration, validity, saturation, reverse flag |
| `Vehicle_Object` | Alive counter, sector group, grid sample counter, grid validity, nearest distance code per sector |
| `Dashboard_Command` | Alive counter, command validity, clear-fault request, requested headlight power, requested headlight mode, checksum |
| `AFS_Status` | Alive counter, executed mode, health, fault flags, servo feedback, applied dim-zone mask |

## DBC Ownership

A DBC is a text dictionary of CAN messages: it identifies each signal's bits, signedness, units, scaling, and enums. The planned `can/afs.dbc` is shared by the C++ gateway, firmware, logs, and tests. It is separate from the Python/C++ IPC message specification.

The proposed workflow generates small C pack/unpack functions from the DBC and compiles them into both gateway and firmware. C++ still owns sockets, scheduling, validation, and lifecycle; Embedded C still owns AFS control. Timeouts, checksums/counter behavior, and multi-frame assembly need application logic alongside the DBC.

The Dashboard consumes decoded values and enums from gateway IPC. It does not load a DBC to own raw CAN transport.
