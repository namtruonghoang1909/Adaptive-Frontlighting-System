# CAN

The native CAN module provides signal/frame encoders, a Linux SocketCAN transport, a scheduled runtime, and an ECU status decoder. `CanEncoder` validates runner steering and speed, maintains the agreed alive counters, and projects complete vehicle footprints into the agreed 10-sector signal model. `CanFrameEncoder` accepts those signal values and returns standard CAN frame values for `0x100 Vehicle_Speed`, `0x200 Vehicle_Steering`, `0x300 Vehicle_Object`, and `0x400 Dashboard_Command`.

The message schema is [afs.dbc](../../can/afs.dbc). The checked-in files under `generated/` are cantools C output; `CanFrameEncoder` uses their signal encoders and message packers rather than defining a second bit layout. Signal structs are value-initialized so every reserved field stays zero, and `0x100`–`0x300` use no application checksum. `CanRuntime` samples the latest runner scene and sends `0x100`/`0x200` every 20 ms, `0x300` every 100 ms, and the current `0x400` Dashboard command every 50 ms using monotonic deadlines. `CommandValid` follows the Dashboard connection lease and accepted command; clear-fault remains pending until one successful SocketCAN write. It receives filtered standard `0x500` frames and forwards accepted status through Dashboard IPC. The Dashboard marks retained ECU values stale after 250 ms without an accepted report; this is a display threshold only. The `0x300` ECU link timeout is 250 ms, allowing one missed periodic frame plus timing margin; the ECU's suggested `0x500` reporting period is 50 ms. `SocketCanTransport` owns the Linux raw socket and rejects invalid, down, or non-CAN interfaces at startup. It does not create/configure interfaces. Project frames are converted to/from Linux `struct can_frame` at this boundary. The `0x500` decoder checks DLC, XOR checksum, reserved fields, enum ranges, mask bounds, and alive-counter progression. The separate `afs_can_frame_logger` remains a diagnostic encoder path and does not open SocketCAN. Normal CMake builds need neither cantools nor Python. The same generated C codec can be compiled into the future STM32 Zephyr firmware; STM32 retains AFS/ADB control.

Regenerate the C codec after changing the DBC, using cantools 45.0.0:

```bash
python3 -m cantools generate_c_source \
  --database-name afs \
  --use-round \
  --output-directory bridge/src/can/generated \
  bridge/can/afs.dbc
```

`--use-round` makes generated scaled-signal encoders round to the nearest raw
DBC value. Keep the generated C and header checked in with the DBC change.
