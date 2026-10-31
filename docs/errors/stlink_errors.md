# ST-Link And OpenOCD Errors

This page collects probe permissions and SWD access issues. The full hardware
check and build/flash workflows remain in
[`firmware/docs/hardware_check.md`](../../firmware/docs/hardware_check.md) and
[`firmware/docs/stlink_build_flash.md`](../../firmware/docs/stlink_build_flash.md).

## `LIBUSB_ERROR_ACCESS` / USB Permission Denied

**Symptom:** Linux lists the ST-LINK, but OpenOCD reports
`libusb_open() failed with LIBUSB_ERROR_ACCESS` (USB access denied).

This means the device was enumerated but the current user's process could not
open its USB device node. Apply the project ST-LINK/V2 udev rule and reload it
as described in [the hardware check](../../firmware/docs/hardware_check.md#fix-libusb_error_access),
then unplug/reconnect the probe and rerun:

```bash
bash firmware/scripts/check_stlink.sh
```

Do not use `sudo` as a permanent workaround; the udev rule grants the intended
user-session access.

## `timed out while waiting for target halted` / `Not halted`

**Observed symptom:** OpenOCD identified `stm32f4x.cpu` but failed while waiting
for the target to halt during the no-NRST check.

This is later than USB enumeration: OpenOCD reached the probe but did not
complete the target halt operation. First close other OpenOCD, GDB, CubeIDE, or
RTT sessions that may own the probe. Confirm board power, shared ground,
SWDIO→PA13, SWCLK→PA14, and the probe's 3.3 V target reference. The project
configuration intentionally supports the established four-wire SWD setup
without NRST; the message alone does not prove NRST is required. Re-run the
non-flashing hardware check and use its full output to continue diagnosis.

An OpenOCD notice such as `Unable to match requested speed 2000 kHz, using
1800 kHz` is informational by itself; the later reset/halt result determines
whether the check succeeded.

## RTT Reader Has No Output

Check that the RTT-enabled firmware is flashed, the board is running, and the
RTT reader can open the probe. Follow the
[RTT troubleshooting table](../../firmware/docs/rtt_debugging.md#reader-options-and-troubleshooting).
