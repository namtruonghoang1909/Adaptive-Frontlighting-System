# ECU RTT Console

The STM32 firmware routes its `printk` messages to SEGGER RTT channel 0. OpenOCD
reads the RTT buffer in STM32 RAM through the existing ST-Link SWD connection,
and `read_rtt.sh` displays the messages in a terminal. No USB-UART adapter,
additional STM32 signal wire, or browser is needed.

```text
STM32 printk -> RTT buffer in RAM -> SWD -> ST-Link -> OpenOCD -> nc terminal
```

Run the commands below from the repository root in the Ubuntu VM that has the
ST-Link USB device attached.

## One-Time Setup

1. Install the Zephyr workspace and SDK as described in the [firmware
   guide](../README.md#initialize-the-zephyr-workspace). The reader uses the
   OpenOCD binary bundled with the project's Zephyr SDK 0.16.8.
2. Connect the board's 3.3 V target-voltage reference, GND, SWDIO, and SWCLK to
   the ST-Link. Power the STM32 board separately. The [hardware check
   guide](hardware_check.md#check-the-swd-wiring) gives the pin mapping and
   permission checks. Pass the ST-Link USB device through to Ubuntu if it is
   connected to the Windows host of the VM.
3. Check that `nc` (netcat) is available:

   ```bash
   command -v nc
   ```

   If it is missing, install the Ubuntu package:

   ```bash
   sudo apt update
   sudo apt install netcat-openbsd
   ```

4. Confirm Ubuntu and OpenOCD can reach the target:

   ```bash
   lsusb -d 0483:3748
   bash firmware/scripts/check_stlink.sh
   ```

   The second command should finish with `OpenOCD reset/halt check passed`.
   It checks the connection without writing flash. If it fails, follow the
   [hardware check guide](hardware_check.md).

The project firmware configuration enables `CONFIG_USE_SEGGER_RTT` and
`CONFIG_RTT_CONSOLE`, disables `CONFIG_UART_CONSOLE`, and leaves `CONFIG_PRINTK`
enabled. The console uses the existing SWD pins; USART1 is not needed for these
messages.

## Build, Flash, And Read

Close any running GDB, OpenOCD, or RTT reader session so the flash wrapper can
open the ST-Link. Then run:

```bash
bash firmware/scripts/build_firmware.sh --pristine
bash firmware/scripts/flash_firmware.sh
bash firmware/scripts/read_rtt.sh
```

The flash command writes the new image to the STM32. The reader starts OpenOCD
and connects to RTT channel 0. When it is ready, the terminal prints:

```text
Reading ECU RTT console on channel 0. Press Ctrl+C to stop.
Reset the board after connecting if you want to see startup messages.
```

Press the **STM32 board's RESET button** after these lines appear. The firmware
should then print messages similar to:

```text
AFS: CAN communication started at 500 kbit/s
AFS: reporting Safe_Default until beam and servo drivers are available
```

The current firmware prints startup information and CAN/LED errors, including
receive-queue overruns. It does not print every received CAN frame. A quiet
terminal after startup can be normal; use `candump -tz -x can0` to inspect CAN
bus traffic. A status-transmit error can appear while the ECU has no working
CAN peer. Press **Ctrl+C** to stop the RTT reader; this also closes OpenOCD and
releases the ST-Link for flashing or GDB.

## Reader Options And Troubleshooting

The reader uses local TCP port 9090 between OpenOCD and `nc`. It connects
automatically; there is no address to open in a browser. If that port is in
use, choose another:

```bash
AFS_RTT_PORT=9091 bash firmware/scripts/read_rtt.sh
```

| Symptom | Check |
|---|---|
| `nc` is missing | Run `sudo apt install netcat-openbsd` in Ubuntu. |
| `lsusb -d 0483:3748` shows nothing | Attach the ST-Link to the Ubuntu VM and reconnect it. |
| `LIBUSB_ERROR_ACCESS` | Apply the udev permission steps in [hardware_check.md](hardware_check.md#fix-libusb_error_access). |
| OpenOCD reports `open failed` or another probe error | Close other ST-Link users, then run `bash firmware/scripts/check_stlink.sh` and check board power/SWD wiring. |
| The reader connects but no ECU text appears after reset | Confirm the current RTT-enabled image was flashed, the board is running, and its heartbeat LED toggles. Review OpenOCD errors with the hardware check script. |
| Local port 9090 is occupied | Set `AFS_RTT_PORT` as shown above. |

OpenOCD scans the board's regular SRAM range (`0x20000000`–`0x2001ffff`) for
the SEGGER RTT control block. The current `black_f407ve` image places it there.
If the board target or memory layout changes, review the scan range in
[`read_rtt.sh`](../scripts/read_rtt.sh).
