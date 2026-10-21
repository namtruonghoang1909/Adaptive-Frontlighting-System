# CAN

The native CAN module provides two transport-independent APIs. `CanEncoder` validates runner steering and speed, maintains the agreed alive counters, and projects complete vehicle footprints into the agreed 10-sector signal model. `CanFrameEncoder` accepts those signal values and returns standard CAN frame values for `0x100 Vehicle_Speed`, `0x200 Vehicle_Steering`, and `0x300 Vehicle_Object`.

The message schema is [afs.dbc](../../can/afs.dbc). The checked-in files under `generated/` are cantools C output; `CanFrameEncoder` uses their signal encoders and message packers rather than defining a second bit layout. Signal structs are value-initialized so every reserved field stays zero, and `0x100`–`0x300` use no application checksum. The production bridge executable does not call the APIs or schedule/transmit frames. The separate `afs_can_frame_logger` diagnostic executable exercises them against live runner IPC and checks captured payloads with both generated C unpackers and cantools. It does not open SocketCAN. Normal CMake builds need neither cantools nor Python. The same generated C codec can be compiled into the future STM32 Zephyr firmware; STM32 retains AFS/ADB control.

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
