# Build and Flash the STM32 with ST-Link

Run these commands from the repository root in the Ubuntu VM that has the
Zephyr workspace and the ST-Link USB device. The project targets the
`black_f407ve` board definition for the STM32F407VET6.

## Build the Firmware

Build incrementally:

```bash
bash firmware/scripts/build_firmware.sh
```

Use a pristine build after changing build configuration, or disable ccache if
its cache is unavailable:

```bash
bash firmware/scripts/build_firmware.sh --pristine
bash firmware/scripts/build_firmware.sh --no-ccache
```

Successful builds create `firmware/build/zephyr/zephyr.elf` and
`firmware/build/zephyr/zephyr.hex`. Building does not connect to or modify the
board.

## Check ST-Link Before Flashing

Connect ST-Link GND, SWDIO, and SWCLK to the board. Connect the target voltage
reference to 3.3 V when required by the probe. NRST is optional for this
project's OpenOCD setup. For USB passthrough, udev permissions, wiring, and
OpenOCD troubleshooting, see the [ST-Link hardware check](hardware_check.md).

Run the non-flashing check:

```bash
bash firmware/scripts/check_stlink.sh
```

It confirms Linux sees the ST-Link, then asks OpenOCD to reset, halt, identify,
and resume the STM32 using the project's no-NRST SWD configuration. It does not
erase or write flash. A successful check ends with:

```text
OpenOCD reset/halt check passed; the STM32 target was resumed.
```

## Flash the Built Image

After the probe check succeeds, flash the image:

```bash
bash firmware/scripts/flash_firmware.sh
```

The wrapper requires `zephyr.hex`, repeats the ST-Link check, then invokes
`west flash` with the project's OpenOCD configuration. Flashing erases and
writes the STM32. West/OpenOCD progress and errors appear in the terminal.

After a successful flash, the current application toggles `led0` about every
500 ms. That heartbeat confirms the firmware is running; it does not confirm
CAN wiring or lamp actuation. The current image receives and validates CAN
messages and reports `0x500 AFS_Status`, but keeps the outputs in
`Safe_Default` because matrix and servo drivers are not implemented. See the
[CAN interface guide](../../docs/hardware/can_interface.md) for host setup and
bus checks.

The flash wrapper forwards additional options to `west flash`. To read ECU
startup and error messages after flashing, follow the
[RTT debugging guide](rtt_debugging.md). Stop the RTT reader before flashing;
OpenOCD needs exclusive access to the ST-Link.
