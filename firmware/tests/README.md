# ECU Host Tests

These tests compile the ECU's real CAN message service, RTE, controller, and
checked-in DBC codec with the host C compiler. A small CAN send fake captures
`0x500`, and an empty Zephyr utility-header stub lets the pure logic compile
without the board or Zephyr runtime. The tests cover alive-counter rollover and
restart, malformed frames and checksums, command validity and clear-fault
edges, freshness timeouts, safe fallback, and status packing.

From the repository root, run the ECU component suite:

```bash
bash tools/test_components.sh ecu
```

This runs the host tests and builds the `black_f407ve` Zephyr image. The host
tests exercise software logic; they cannot prove CAN pins, transceiver wiring,
RTT output, or lamp hardware. Those checks need the physical rig.
