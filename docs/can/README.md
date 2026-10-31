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
| Host CAN owner | C++17 gateway |
| Host encoding/decoding | C++ validation/projection, generated-code packing for `0x100`–`0x400`, and `0x500` status decoding/forwarding implemented |
| Host transmit/receive | Opt-in raw Linux SocketCAN; enable with `--can-interface NAME` |
| Dashboard role | Python HMI; requests, runner status, and decoded ECU status through gateway Unix socket IPC |
| DLC | Message-specific and defined by the DBC; receivers reject frames whose DLC does not match the expected value |
| Byte order | Little-endian for multi-byte integers |
| Message periods | `0x100`/`0x200`: 20 ms; `0x300`: 100 ms; `0x400`: 50 ms; `0x500`: 50 ms suggested ECU status period |
| Alive / grid freshness | `0x100`, `0x200`, and `0x400` use a 4-bit rolling counter in byte `0` bits `0..3`; ECU accepts forward deltas 1–8, rejects duplicates and other deltas, and permits counter restart after 500 ms without an accepted frame. `0x300` has no counter and uses `GridValid` for source freshness/validity, with the ECU's CAN receive timeout for link loss |
| ECU input/link timeout | `0x100`/`0x200`: 100 ms; `0x300`: 250 ms, allowing one missed 100 ms frame plus timing margin; valid `0x400`: 200 ms |
| Checksum | `0x400` and `0x500` use application XOR checksums; `0x100`, `0x200`, and `0x300` rely on Classical CAN CRC |
| Reserved fields | Transmit as `0`; each message file defines whether receivers ignore or reject nonzero reserved bits |

## Identifier Priority

CAN arbitration gives priority to the lower numeric identifier when nodes
start transmitting at the same time. The project assigns `0x100` to speed,
`0x200` to steering, `0x300` to the vehicle grid, and `0x400` to dashboard
commands. `0x500 AFS_Status` reports the ECU's executed state and faults, so it
is assigned a larger identifier and lower bus priority than those messages.

The `0x100` and `0x200` alive counters advance once per scheduled encoding
cycle, including invalid or repeated source data. The `0x400` counter advances
on each scheduled command frame. The ECU accepts modulo-16 forward deltas from
1 through 8, so occasional lost transmissions do not immediately reject the
next frame; duplicates and deltas 9–15 are rejected. After 500 ms without an
accepted frame for that message, the next counter value establishes a new
baseline. `0x300` has no counter: the bridge
sets `GridValid` according to the latest source scene's validity and age, and
the ECU applies its per-message receive timeout if accepted frames stop
arriving. Speed and steering arrive every 20 ms and time out after 100 ms
(five periods). The object grid arrives every 100 ms and times out after
250 ms, allowing one missed frame plus timing margin. A valid `0x400` command
expires after 200 ms (four 50 ms periods). Low `SteeringValid`,
`SpeedValid`, or `GridValid` marks the corresponding source unusable when
received; a `0x300` frame with `GridValid=0` clears the active grid immediately.
Because the bridge samples the object grid on its 100 ms transmit schedule, a
source becoming stale just after a grid transmission can take up to one period
to be reported. The ECU uses the latest valid grid without comparing it to
prior grid contents.

## Current Messages

The message specifications use "C++ bridge CAN module" for the native gateway's CAN boundary and document the ECU CAN receiver policy implemented in the Zephyr app. The `0x300` single-frame sector layout, 10-sector preview geometry, four 25 m bands, cumulative subsector masks, radial footprint rule, missing-geometry fallback, and fail-closed behavior are agreed software design direction. `PerceptionDegraded` describes object-scan or required-geometry quality and implies `GridValid=0`; transfer, parse, and freshness faults invalidate the grid without setting this perception-specific flag. `ObjectListOverflow` identifies candidate objects dropped at the runner's configured object-list cap.

| ID | Name | Bus producer | Bus consumer | Purpose | Detail |
|---:|---|---|---|---|---|
| `0x100` | `Vehicle_Speed` | C++ bridge CAN module | AFS ECU | Simulated speed input | [messages/0x100_Vehicle_Speed.md](messages/0x100_Vehicle_Speed.md) |
| `0x200` | `Vehicle_Steering` | C++ bridge CAN module | AFS ECU | Simulated steering input | [messages/0x200_Vehicle_Steering.md](messages/0x200_Vehicle_Steering.md) |
| `0x300` | `Vehicle_Object` | C++ bridge CAN module | AFS ECU | One-frame 10-sector occupancy grid with a four-bit cumulative subsector mask per sector | [messages/0x300_Vehicle_Object.md](messages/0x300_Vehicle_Object.md) |
| `0x400` | `Dashboard_Command` | C++ bridge CAN module | AFS ECU | Dashboard request transmitted every 50 ms; ECU expires it after 200 ms | [messages/0x400_Dashboard_Command.md](messages/0x400_Dashboard_Command.md) |
| `0x500` | `AFS_Status` | AFS ECU | C++ bridge CAN module and Dashboard | ECU currently reports Safe_Default bring-up status every 50 ms; bridge receives and forwards accepted status | [messages/0x500_AFS_Status.md](messages/0x500_AFS_Status.md) |

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

The DBC can be edited in Vector CANdb++. The approved codec workflow uses cantools 45.0.0 to generate C pack/unpack functions when the DBC changes, checks the generated C files into `bridge/src/can/generated/`, and compiles them into the gateway and STM32 Zephyr application. `CanFrameEncoder` packs the `0x100`–`0x400` frames; both ECU and bridge use the generated unpacker for `0x500`, with application validation layered on top. See the regeneration command in [the CAN module notes](../../bridge/src/can/README.md). Python is needed for code generation only, not at runtime or during normal builds. C++ owns host sockets, scheduling, and lifecycle; Zephyr firmware owns ECU-side CAN validation and status, while physical AFS actuation remains future work. Timeouts and counter behavior live in application logic alongside the DBC. The `0x300` grid is a single frame and requires no fragment assembly.

The Dashboard consumes decoded values and enums from gateway IPC. It does not load a DBC to own raw CAN transport.

## DBC Editing And Live Monitoring

Open and edit `bridge/can/afs.dbc` in Vector CANdb++. Use SavvyCAN to view CAN traffic and decode frames using that DBC. SavvyCAN can connect to a Linux SocketCAN interface such as `vcan0` for virtual traffic or `can0` for a physical adapter. A USB-CAN adapter for the Linux host must expose SocketCAN to work with the gateway and this monitoring setup.

For Linux adapter enumeration, bitrate configuration, controller-loopback
checks, and physical-bus verification, follow the [CAN interface hardware guide](../hardware/can_interface.md).
For recorded failures such as `ENOBUFS`, `ERROR-PASSIVE`, local loopback echoes,
or a blank SavvyCAN view, see [CAN errors](../errors/can_errors.md).

Launch the optional monitor from the repository root with `bash scripts/start.sh savvycan`. It opens the GUI but does not select an interface or pass the DBC as a command-line argument. In SavvyCAN, create a **QT SerialBus Devices → SocketCAN** connection for the already configured interface, then use **DBC File Manager** to load `bridge/can/afs.dbc`. The interface bitrate is configured in Linux before opening SavvyCAN. The launcher remains separate from `scripts/start.sh system`; see the [project scripts guide](../../scripts/dialogue.md) and SavvyCAN's [connection](https://www.savvycan.com/docs/connectionwindow.html) and [DBC manager](https://www.savvycan.com/docs/dbc_manager.html) guides.

The DBC only describes and decodes frames; it does not create CAN traffic or connect the PC to the bus. The production bridge sends `0x100`–`0x400` and receives `0x500` only when started with `--can-interface NAME`. The separate diagnostic logger checks live MetaDrive samples against the DBC without opening SocketCAN. Live physical monitoring needs a CAN adapter connected to the bus; virtual integration is available with the opt-in CTest `socketcan_vcan_end_to_end` on a prepared `vcan0`. `cantools` generates the C signal encoders and message pack/unpack functions from the DBC; it is separate from the DBC editor and live viewer.

## CAN Regression Tests

Run `bash tests/scripts/test_can.sh` for bridge CAN regression coverage and ECU host
CAN-service tests. Focus one bridge area with commands such as
`bash tests/scripts/test_can.sh bridge encoder` or
`bash tests/scripts/test_can.sh bridge socketcan`; run only ECU host cases with
`bash tests/scripts/test_can.sh ecu`. These are host software checks and do not
require an adapter. See the [component test guide](../../tests/scripts/test_guide.md)
for dependencies and the optional `vcan0` test.
