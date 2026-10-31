# ECU Firmware Errors

This page records Zephyr ECU build/runtime failures. Probe and SWD issues have
a separate [ST-Link/OpenOCD guide](stlink_errors.md).

## `0x500 status transmit failed (-11)`

**Observed symptom:** ECU RTT output included repeated `AFS: 0x500 status
transmit failed (-11)` messages.

In the pinned Zephyr CAN API, `-11` is `-EAGAIN`; `can_send()` documents it as a
send timeout. The firmware currently gives a status send 5 ms to obtain a free
CAN transmit mailbox. This numeric return does not alone identify why the
mailbox stayed busy. Check the CAN controller state, bitrate, transceiver and
pin wiring, and whether an active peer is ACKing frames. Compare with Linux
`ip -details -statistics link show can0` and check whether the bridge receives
`0x500`.

## `0x500 status transmit failed (-114)`

**Observed symptom:** the same RTT log included `-114` on status transmit
attempts. In Zephyr's errno definitions this value corresponds to `-EALREADY`,
but `can_send()` documents `-EAGAIN` for mailbox timeout and does not list
`-EALREADY` as a normal send result. The numeric message alone is therefore not
enough to identify the cause. Preserve the full RTT log, verify the flashed
image matches the current source, and capture the CAN controller state and
physical bus setup before changing code.

## No ECU CAN Receive Lines In RTT

The project can enable temporary received-frame logging with
`CONFIG_AFS_CAN_RX_LOGGING=y`. Confirm the current image was built and flashed
with that setting, the RTT reader is attached, the bridge is transmitting, and
the ECU CAN controller is initialized. Follow the
[RTT guide](../../firmware/docs/rtt_debugging.md) and compare with the host-side
[CAN checks](can_errors.md).

For a firmware regression check, run:

```bash
bash tests/scripts/test_firmware.sh
```

The host CAN-service tests do not verify electrical communication on the board.
