# CAN Tests

This folder separates host-side CAN gateway tests from firmware CAN-service
tests. Both run without connecting the USB-CAN adapter to a physical bus.

## Bridge

| Folder | What it tests |
|---|---|
| [`bridge/encoder/`](bridge/encoder/) | CAN signal validation and packing runner values into DBC-defined frames. |
| [`bridge/status_decoder/`](bridge/status_decoder/) | Validation and decoding of ECU `0x500` status frames. |
| [`bridge/socketcan/`](bridge/socketcan/) | Conversion between project CAN frames and Linux `can_frame` values. A separate opt-in `vcan0` test exercises the live SocketCAN transport. |
| [`bridge/frame_smoke/`](bridge/frame_smoke/) | A headless runner-to-frame diagnostic, including generated-code round trips and independent DBC decoding. It does not open a CAN interface. |

Run one bridge area from the repository root:

```bash
bash tests/scripts/test_can.sh bridge encoder
bash tests/scripts/test_can.sh bridge status_decoder
bash tests/scripts/test_can.sh bridge socketcan
bash tests/scripts/test_can.sh bridge frame_smoke
```

The optional virtual-bus integration test is
`bash tests/scripts/test_components.sh bridge-vcan`; it requires a configured
`vcan0` interface.

## ECU

| Folder | What it tests |
|---|---|
| [`ecu/can_service/`](ecu/can_service/) | Host compilation of the firmware CAN service and its real decode, RTE, safe-fallback, freshness, and `0x500` status behavior. `stubs/` supplies the small Zephyr API surface needed by the host test build. |

Run only the ECU CAN-service host tests with
`bash tests/scripts/test_firmware.sh can_service` or
`bash tests/scripts/test_can.sh ecu`. These commands do not flash or exercise the
STM32. The [test tree index](../README.md) describes the complete project test
layout.
