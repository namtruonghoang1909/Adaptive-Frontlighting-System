# Firmware Script Guide

Run these commands from the repository root in the Ubuntu VM that owns the
ST-Link USB connection. The scripts use the Zephyr workspace and SDK under
`firmware/`. Build and ST-Link checks are terminal operations; flashing writes
the STM32; RTT displays firmware messages in a terminal.

## Build The Firmware

```bash
bash firmware/scripts/build_firmware.sh
```

This builds the `black_f407ve` Zephyr application incrementally. To rebuild
from a clean build directory or bypass ccache:

```bash
bash firmware/scripts/build_firmware.sh --pristine
bash firmware/scripts/build_firmware.sh --no-ccache
```

**Observe:** compiler and west output appears in the terminal. A successful
build produces `firmware/build/zephyr/zephyr.elf` and
`firmware/build/zephyr/zephyr.hex`. Building alone does not access or change the
board.

## Check ST-Link And SWD Without Flashing

```bash
bash firmware/scripts/check_stlink.sh
```

The script checks that Linux sees the ST-Link, then asks OpenOCD to reset, halt,
identify, and resume the STM32 using the project's SWD configuration. It does
not write flash.

**Observe:** success ends with:

```text
OpenOCD reset/halt check passed; the STM32 target was resumed.
```

If it fails, check USB passthrough, board power, GND, 3.3 V target reference,
SWDIO, and SWCLK. See [hardware_check.md](../docs/hardware_check.md).

## Flash The Built Image

```bash
bash firmware/scripts/flash_firmware.sh
```

This requires the built HEX image, repeats the ST-Link reset/halt check, and
then invokes west/OpenOCD to program the STM32. Flash only after the build
completes successfully. Close any running RTT reader or GDB/OpenOCD session
first because they share the ST-Link.

**Observe:** west/OpenOCD progress and errors appear in the terminal. After a
successful flash, the current ECU application blinks the board's `led0` about
every 500 ms. That heartbeat confirms the application is running; it does not
confirm CAN wiring or headlight actuation.

## Read ECU Messages Over RTT

```bash
bash firmware/scripts/read_rtt.sh
```

This starts the SDK's OpenOCD RTT server over the existing ST-Link SWD wiring
and prints RTT channel 0 through `nc` in the same terminal. No USB-UART adapter
or browser is involved. After the reader prints that it is connected, press the
board's RESET button to see startup messages.

Expected startup output includes:

```text
AFS: CAN communication started at 500 kbit/s
AFS: reporting Safe_Default until beam and servo drivers are available
```

The firmware may also report CAN receive-queue, status-transmit, or LED errors.
It does not print every CAN frame; use `candump` for bus traffic. Press
**Ctrl+C** to stop RTT and release the ST-Link. If port 9090 is busy, choose
another local port:

```bash
AFS_RTT_PORT=9091 bash firmware/scripts/read_rtt.sh
```

More setup and troubleshooting details are in the
[RTT debugging guide](../docs/rtt_debugging.md).

## Observe ECU CAN Status

After flashing the current CAN-enabled image and wiring the ECU CAN transceiver
to the adapter's CAN bus, inspect the adapter from another terminal:

```bash
ip -details -statistics link show can0
candump -tz -x can0
```

The firmware is configured to transmit `0x500 AFS_Status` every 50 ms. A
correctly connected bus should show those frames while the ECU is powered and
running; the bridge can decode and forward them to the Dashboard when started
with `--can-interface can0`. The current ECU image reports `Safe_Default` and
unavailable beam/servo control because those actuator drivers are not
implemented. A Dashboard status display is not proof that physical lamps are
being controlled.

Seeing a frame echoed by the adapter itself in controller loopback does not
verify the physical transceiver or CANH/CANL. For physical bus verification,
restore normal CAN mode and use a second active node or ECU to acknowledge and
exchange frames. Check the
[host CAN bring-up guide](../../docs/hardware/hardware.md#host-can-bring-up)
for interface setup and bus checks.
