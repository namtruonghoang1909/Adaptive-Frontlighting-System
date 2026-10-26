# Firmware Hardware Check

This guide checks the ST-LINK/V2 connection from Ubuntu to the STM32F407VET6.
It separates USB detection, OpenOCD access to the probe, SWD access to the
target, and writing firmware.

## Check The ST-LINK And Target

From the repository root, run:

```bash
bash firmware/scripts/check_stlink.sh
```

The script checks for the project's ST-LINK/V2 USB ID (`0483:3748`) and then
runs OpenOCD with the project-owned
[`openocd_stm32f4_swd.cfg`](../scripts/openocd_stm32f4_swd.cfg). The config
declares that no external reset wire is connected, so OpenOCD uses the
Cortex-M4 `VECTRESET` software-reset path. The check resets and halts the core,
lists the target, then resumes it. It does not erase or program flash.

A successful probe should show the ST-LINK device, a target-voltage reading
(about 3.3 V when the board is powered and the probe senses the target supply),
and the `stm32f4x.cpu` target, with no halt error. OpenOCD wording varies by
version; success means the reset/halt command completes and OpenOCD exits
without an error.

## Fix `LIBUSB_ERROR_ACCESS`

If `lsusb` finds the ST-LINK but OpenOCD reports
`libusb_open() failed with LIBUSB_ERROR_ACCESS`, Linux can enumerate the probe
but the current user cannot open its USB device node. Add a udev rule for this
ST-LINK/V2 ID:

```bash
sudo tee /etc/udev/rules.d/49-stlinkv2.rules >/dev/null <<'EOF'
SUBSYSTEM=="usb", ATTR{idVendor}=="0483", ATTR{idProduct}=="3748", MODE="0660", GROUP="plugdev", TAG+="uaccess"
EOF
sudo udevadm control --reload-rules
```

Unplug and reconnect the ST-LINK to the Ubuntu guest, then rerun the check
script. The account should be in the `plugdev` group (`id -nG`). A probe error
after USB access succeeds is a later stage; inspect the reported target error
and continue with the wiring checks below.

## Check The SWD Wiring

If OpenOCD opens the ST-LINK but cannot examine the MCU, verify:

- The STM32 board is powered.
- ST-LINK GND and board GND are connected.
- ST-LINK SWDIO reaches STM32 PA13/SWDIO.
- ST-LINK SWCLK reaches STM32 PA14/SWCLK.
- The ST-LINK target-voltage reference is connected to the board's 3.3 V rail
  when required by the probe. This is a voltage reference, not a request to
  power the board from the ST-LINK.
- NRST is optional for this project's SWD setup; the OpenOCD config does not
  declare an external reset wire. Connecting NRST can still help recover a
  target that cannot be reached through normal SWD.

## Flash The Blink Image

After the reset/halt check succeeds, flash the already-built image from the
repository root. The wrapper repeats the check and selects the same
project-owned OpenOCD config before flashing:

```bash
bash firmware/scripts/flash_firmware.sh
```

This command erases and writes the STM32 flash. The earlier LED-blink app was
flashed and its board LED was confirmed working. The current Zephyr image also
contains the ECU CAN communication/status slice. After CAN2 is physically wired
through the transceiver to the adapter, configure the host bus at 500 kbit/s
and inspect traffic with:

```bash
ip -details link show can0
candump -tz -x can0
```

Expect bridge-originated IDs `100`, `200`, `300`, and `400`, and the ECU's
`500` status frame about every 50 ms. With the current firmware, `0x500`
reports `Safe_Default` and unavailable beam/servo control paths. Seeing a
frame proves CAN bus communication only; physical CANH/CANL exchange, ECU
transceiver wiring, and lamp behavior must be verified separately. The firmware
does not yet implement AFS actuation.

To inspect ECU startup and error messages through the same four SWD wires,
flash the current RTT-enabled image and run `bash firmware/scripts/read_rtt.sh`.
Reset the board after the reader connects for startup messages. Stop the reader
before flashing or attaching GDB; only one OpenOCD process can use the ST-Link
at a time. See the [RTT setup guide](rtt_debugging.md) for the full sequence and
troubleshooting steps.
