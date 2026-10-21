# CAN Docs

This folder gives a short orientation to the project CAN bus and links to the current
human-readable message specs. [bridge/can/afs.dbc](../../bridge/can/afs.dbc) is the source of
truth for frame names, signal packing, scaling, and enum tables. The message specs also describe
cross-signal validation, timeouts, checksums, and behavior that a DBC alone cannot enforce.

## Folder Shape

```text
docs/can/
|-- README.md
`-- messages/
    |-- 0x200_Vehicle_Steering.md
    |-- 0x100_Vehicle_Speed.md
    |-- 0x300_Vehicle_Object.md
    |-- 0x400_Dashboard_Command.md
    `-- 0x500_AFS_Status.md
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
| Host encoding/decoding | C++ validation/projection and cantools-generated in-memory frame packing for `0x100`–`0x300` implemented; runtime CAN transport pending |
| Host transmit/receive | Raw Linux SocketCAN in the C++ gateway |
| Dashboard role | Python HMI; requests and decoded status through gateway Unix socket IPC |
| DLC | Message-specific and defined by the DBC; receivers reject frames whose DLC does not match the expected value |
| Byte order | Little-endian for multi-byte integers |
| Alive / grid freshness | `0x100` and `0x200` use a 4-bit rolling counter in byte `0` bits `0..3`; `0x300` has no counter and uses `GridValid` for source freshness/validity, with the ECU's CAN receive timeout for link loss |
| ECU input/link timeout | `0x100`, `0x200`, and `0x300` use a 100 ms ECU timeout with 20 ms transmissions (five expected periods) |
| Checksum | `0x400` and `0x500` use application XOR checksums; `0x100`, `0x200`, and `0x300` rely on Classical CAN CRC |
| Reserved fields | Transmit as `0`; each message file defines whether receivers ignore or reject nonzero reserved bits |

## Identifier Priority

CAN arbitration gives priority to the lower numeric identifier when nodes
start transmitting at the same time. The project assigns `0x100` to speed,
`0x200` to steering, `0x300` to the vehicle grid, and `0x400` to dashboard
commands. `0x500 AFS_Status` reports the ECU's executed state and faults, so it
is assigned a larger identifier and lower bus priority than those messages.

The `0x100` and `0x200` alive counters increment on every transmitted frame,
including invalid or repeated source data. `0x300` has no counter: the bridge
sets `GridValid` according to the latest source scene's validity and age, and
the ECU applies its 100 ms receive timeout if accepted frames stop arriving.
At 20 ms transmission periods, this is five expected periods. The ECU handles
low `SteeringValid`, `SpeedValid`, or `GridValid` immediately as unusable source
data; a received `0x300` frame with `GridValid=0` clears the active grid
immediately. It uses the latest valid grid without comparing it to prior grid
contents.

## Current Messages

The message specifications use "C++ bridge CAN module" for the native gateway's CAN boundary. They explain the schema in `bridge/can/afs.dbc` and record behavioral agreements and remaining decisions. The `0x300` single-frame sector layout, 10-sector preview geometry, four 25 m bands, cumulative subsector masks, radial footprint rule, missing-geometry fallback, and fail-closed behavior are agreed software design direction. `PerceptionDegraded` describes object-scan or required-geometry quality and implies `GridValid=0`; transfer, parse, and freshness faults invalidate the grid without setting this perception-specific flag. `ObjectListOverflow` identifies candidate objects dropped at the runner's configured object-list cap.

| ID | Name | Bus producer | Bus consumer | Purpose | Detail |
|---:|---|---|---|---|---|
| `0x100` | `Vehicle_Speed` | C++ bridge CAN module | AFS ECU | Simulated speed input | [messages/0x100_Vehicle_Speed.md](messages/0x100_Vehicle_Speed.md) |
| `0x200` | `Vehicle_Steering` | C++ bridge CAN module | AFS ECU | Simulated steering input | [messages/0x200_Vehicle_Steering.md](messages/0x200_Vehicle_Steering.md) |
| `0x300` | `Vehicle_Object` | C++ bridge CAN module | AFS ECU | One-frame 10-sector occupancy grid with a four-bit cumulative subsector mask per sector | [messages/0x300_Vehicle_Object.md](messages/0x300_Vehicle_Object.md) |
| `0x400` | `Dashboard_Command` | C++ bridge CAN module | AFS ECU | Dashboard HMI command encoded and sent by the bridge | [messages/0x400_Dashboard_Command.md](messages/0x400_Dashboard_Command.md) |
| `0x500` | `AFS_Status` | AFS ECU | C++ bridge CAN module | ECU executed status decoded by the bridge and displayed by the Dashboard | [messages/0x500_AFS_Status.md](messages/0x500_AFS_Status.md) |

## Signal Intent

| Message | Main signals |
|---|---|
| `Vehicle_Steering` | Alive counter, steering angle, validity, saturation |
| `Vehicle_Speed` | Alive counter, signed ego speed, validity, saturation |
| `Vehicle_Object` | Grid validity/quality flags, sector occupancy bit plus four cumulative subsector-mask bits for each of 10 sectors |
| `Dashboard_Command` | Alive counter, command validity, clear-fault request, requested headlight power, requested headlight mode, checksum |
| `AFS_Status` | Alive counter, executed mode, health, fault flags, servo feedback, applied logical-sector mask |

## DBC Ownership

A DBC is a text dictionary of CAN messages: it identifies each signal's bits, signedness, units, scaling, and enums. `bridge/can/afs.dbc` is maintained with the bridge CAN implementation and shared by the gateway, firmware, logs, and tests. It is separate from the Python/C++ IPC message specification.

The DBC can be edited in Vector CANdb++. The approved codec workflow uses cantools 45.0.0 to generate C pack/unpack functions when the DBC changes, checks the generated C files into `bridge/src/can/generated/`, and compiles them into the gateway. The C++ `CanFrameEncoder` currently uses generated signal encoders and packers for the `0x100`, `0x200`, and `0x300` in-memory frame values. See the regeneration command in [the CAN module notes](../../bridge/src/can/README.md). The same C codec can also be compiled into the future STM32 Zephyr firmware. Python is needed for code generation only, not at runtime or during a normal bridge build. C++ still owns sockets, scheduling, validation, and lifecycle; the STM32 Zephyr firmware owns AFS control. Timeouts and counter behavior need application logic alongside the DBC. The `0x300` grid is a single frame and requires no fragment assembly.

The Dashboard consumes decoded values and enums from gateway IPC. It does not load a DBC to own raw CAN transport.

## DBC Editing And Live Monitoring

Open and edit `bridge/can/afs.dbc` in Vector CANdb++. Use SavvyCAN to view CAN traffic and decode frames using that DBC. SavvyCAN can connect to a Linux SocketCAN interface such as `vcan0` for virtual traffic or `can0` for a physical adapter. A USB-CAN adapter for the Linux host must expose SocketCAN to work with the planned gateway and this monitoring setup.

The DBC only describes and decodes frames; it does not create CAN traffic or connect the PC to the bus. The bridge has an in-memory generated-code frame encoder and a diagnostic logger that checks live MetaDrive samples against the DBC, but the production application does not schedule or transmit CAN frames. Live monitoring needs a CAN adapter connected to the bus. `cantools` generates the C signal encoders and message pack/unpack functions from the DBC; it is separate from the DBC editor and live viewer.
