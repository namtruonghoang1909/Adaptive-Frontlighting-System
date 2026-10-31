# AFS Firmware

The Zephyr application source is kept in `firmware/afs_ecu/`. The app uses an
AUTOSAR-inspired Application/RTE/BSW structure. It receives and validates
bridge CAN inputs, stores them behind an RTE-style boundary, checks input
freshness, and reports `0x500 AFS_Status`. Physical beam and servo control is
not implemented; the application reports `Safe_Default` and unavailable
control paths until those drivers are added. The board LED remains a 500 ms
heartbeat for bring-up.
For diagnosed firmware issues, see [ECU firmware errors](../docs/errors/firmware_errors.md)
and [ST-Link/OpenOCD errors](../docs/errors/stlink_errors.md).

## Workspace Layout

- `firmware/.west/`: local west workspace configuration, ignored by Git.
- `firmware/afs_ecu/`: project-owned Zephyr application and west manifest,
  pinning Zephyr to `v3.7.0`.
- `firmware/zephyr/`, `firmware/modules/`, and imported projects under
  `firmware/bootloader/` and `firmware/tools/`: local Zephyr dependencies
  fetched by west and ignored by Git.
- `firmware/.venv/`, `firmware/.sdk/`, and `firmware/build/`: local tools and
  generated files, ignored by Git.
- `firmware/docs/` and `firmware/scripts/`: hardware bring-up notes and scripts.

For each build, ST-Link, flash, and RTT script's expected result, see the
[firmware script guide](scripts/guide.md).
For the complete STM32 build and ST-Link flashing sequence, see
[Build and flash with ST-Link](docs/stlink_build_flash.md).

`requirements.txt` pins west to 1.2.0. The build uses Zephyr SDK 0.16.8 and the
`black_f407ve` board target. Zephyr's board definition matches the STM32F407VET6,
and the user has flashed the earlier LED app and confirmed the board LED blinks.
The new CAN application builds for that target. CAN2 is configured for 500
kbit/s through the board's chosen CAN controller and project overlay. Peripheral
routing, transceiver wiring, and bus communication still need physical
verification before connecting AFS hardware.

## Implemented ECU CAN Slice

The CAN service accepts standard `0x100 Vehicle_Speed`, `0x200
Vehicle_Steering`, `0x300 Vehicle_Object`, and `0x400 Dashboard_Command` frames.
It checks DLC, reserved fields, validity/mode ranges, the `0x400` XOR checksum,
and alive counters where present. For `0x100`, `0x200`, and `0x400`, the ECU
accepts modulo-16 forward counter deltas from 1 through 8, rejects duplicates
and other deltas, and permits a new baseline after 500 ms without an accepted
frame. The `0x300` grid has no alive counter.

Speed and steering expire after 100 ms, the object grid after 250 ms, and a
valid dashboard command after 200 ms. A rejected known frame immediately
invalidates that input; a receive-queue overrun discards queued payloads and
invalidates all four input categories until fresh frames arrive. Both
conditions latch `CanDecodeFault`;
a rising `ClearFaultRequest` clears that software diagnostic, while inputs
remain invalid until refreshed. The ECU sends `0x500 AFS_Status` every 50 ms
using the same checked-in DBC-generated C codec as the bridge.

Until servo and beam drivers are implemented, `0x500` reports `Safe_Default`,
`SafeFallback=1`, `ServoControlLost=1`, and `BeamControlLost=1`, with zero
applied dim mask and placeholder zero feedback. This is firmware bring-up
reporting; it does not confirm a physical lamp output. See the [CAN message
specifications](../docs/can/README.md) and [ECU component
guide](../docs/architecture/components/afs-ecu.md).

## Initialize The Zephyr Workspace

From the repository root, create the local Python environment and initialize
the Zephyr workspace inside `firmware/`:

```bash
python3.11 -m venv firmware/.venv
firmware/.venv/bin/pip install -r firmware/requirements.txt
firmware/.venv/bin/west init -l firmware/afs_ecu
(cd firmware && .venv/bin/west update)
firmware/.venv/bin/pip install -r firmware/zephyr/scripts/requirements.txt
```

Install the Zephyr SDK 0.16.8 minimal bundle and its ARM toolchain under
`firmware/.sdk/`. The minimal bundle includes host tools; the separate ARM
archive supplies the `arm-zephyr-eabi` compiler. Download and verify both
official release assets:

```bash
mkdir -p firmware/.downloads firmware/.sdk
curl -L --fail -o firmware/.downloads/zephyr-sdk-0.16.8_linux-x86_64_minimal.tar.xz \
  https://github.com/zephyrproject-rtos/sdk-ng/releases/download/v0.16.8/zephyr-sdk-0.16.8_linux-x86_64_minimal.tar.xz
curl -L --fail -o firmware/.downloads/toolchain_linux-x86_64_arm-zephyr-eabi.tar.xz \
  https://github.com/zephyrproject-rtos/sdk-ng/releases/download/v0.16.8/toolchain_linux-x86_64_arm-zephyr-eabi.tar.xz
curl -L --fail -o firmware/.downloads/sha256.sum \
  https://github.com/zephyrproject-rtos/sdk-ng/releases/download/v0.16.8/sha256.sum
(cd firmware/.downloads && grep -E 'zephyr-sdk-0.16.8_linux-x86_64_minimal.tar.xz|toolchain_linux-x86_64_arm-zephyr-eabi.tar.xz' sha256.sum | sha256sum -c -)
tar -xf firmware/.downloads/zephyr-sdk-0.16.8_linux-x86_64_minimal.tar.xz -C firmware/.sdk
tar -xf firmware/.downloads/toolchain_linux-x86_64_arm-zephyr-eabi.tar.xz \
  -C firmware/.sdk/zephyr-sdk-0.16.8
env PATH="$PWD/firmware/.venv/bin:$PATH" \
  firmware/.sdk/zephyr-sdk-0.16.8/setup.sh -h
```

The `-h` option installs the SDK host tools, including OpenOCD; the ARM
compiler archive is unpacked separately above. The west workspace root and its
Zephyr checkouts are under `firmware/`. The manifest is beside the application
in `firmware/afs_ecu/west.yml`. Run west commands from `firmware/`, or use the
project scripts that select that working directory automatically.

## Build The Application

From anywhere inside the repository, build for `black_f407ve` with:

```bash
bash firmware/scripts/build_firmware.sh
```

Use a pristine build after changing application or build configuration, or
disable ccache if the system's ccache directory is not writable:

```bash
bash firmware/scripts/build_firmware.sh --pristine
bash firmware/scripts/build_firmware.sh --no-ccache
```

The expected image is `firmware/build/zephyr/zephyr.elf` with a matching
`zephyr.hex`.

## Test The ECU Software

Run `bash tests/scripts/test_firmware.sh` from the repository root after changing
ECU logic. It runs the [host logic tests](../tests/can/ecu/can_service/) and
builds the STM32 image. To run only the host CAN-service tests, use
`bash tests/scripts/test_firmware.sh can_service`; they cover decoding, freshness,
conservative fallback, command policy, and `0x500` packing without a board.
See the root [test tree index](../tests/README.md) and
[component test guide](../tests/scripts/test_guide.md).

## Read ECU Diagnostics Over RTT

The firmware sends its existing `printk` startup and error messages to SEGGER
RTT channel 0. RTT uses the same four-wire SWD connection as flashing; it does
not need a USB-UART adapter or an extra STM32 pin. See the [RTT setup and
troubleshooting guide](docs/rtt_debugging.md) for the one-time setup, expected
output, and connection checks. From the repository root, build and flash the
current image, then start the reader:

```bash
bash firmware/scripts/build_firmware.sh --pristine
bash firmware/scripts/flash_firmware.sh
bash firmware/scripts/read_rtt.sh
```

The reader uses the SDK's OpenOCD and `nc` (netcat). Reset the STM32 after it
connects to see startup messages; press Ctrl+C to stop it. Close an active flash
or GDB session before starting the reader because OpenOCD needs exclusive
access to the ST-Link. The current bench-test build enables
`CONFIG_AFS_CAN_RX_LOGGING=y`, so RTT prints each received frame's ID, DLC, and
payload before decoding it. This creates frequent output while CAN traffic is
active. Set the option to `n` in `afs_ecu/prj.conf`, then rebuild pristine and
flash to disable this temporary instrumentation. See the
[firmware script guide](scripts/guide.md#read-ecu-messages-over-rtt) for an
example log line.

Other useful Zephyr commands, run from the repository root:

```bash
(cd firmware && .venv/bin/west update)
(cd firmware && .venv/bin/west build -t menuconfig -d build)
(cd firmware && .venv/bin/west debug -d build)
```

## Build And Flash The Board

Use the focused [STM32 build and ST-Link flashing guide](docs/stlink_build_flash.md)
for prerequisites, build options, the non-flashing probe check, flash behavior,
and expected results. The quick commands from the repository root are:

```bash
bash firmware/scripts/build_firmware.sh
bash firmware/scripts/check_stlink.sh
bash firmware/scripts/flash_firmware.sh
```

The build creates the image; the probe check does not write flash; flashing
erases and programs the STM32. CAN adapter setup and physical bus testing are
documented separately in the [CAN interface guide](../docs/hardware/can_interface.md).
