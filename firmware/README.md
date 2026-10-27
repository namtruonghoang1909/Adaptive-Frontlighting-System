# AFS Firmware

The Zephyr application source is kept in `firmware/afs_ecu/`. The app uses an
AUTOSAR-inspired Application/RTE/BSW structure. It receives and validates
bridge CAN inputs, stores them behind an RTE-style boundary, checks input
freshness, and reports `0x500 AFS_Status`. Physical beam and servo control is
not implemented; the application reports `Safe_Default` and unavailable
control paths until those drivers are added. The board LED remains a 500 ms
heartbeat for bring-up.

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

Run `bash tools/test_components.sh ecu` from the repository root after changing
ECU logic. It runs the [host logic tests](tests/README.md) and builds the
STM32 image. The host tests exercise CAN decoding, freshness, conservative
fallback, command policy, and `0x500` packing without a board.

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
access to the ST-Link. The current firmware does not print every CAN frame.

Other useful Zephyr commands, run from the repository root:

```bash
(cd firmware && .venv/bin/west update)
(cd firmware && .venv/bin/west build -t menuconfig -d build)
(cd firmware && .venv/bin/west debug -d build)
```

## Check And Flash The Board

First run the non-flashing ST-Link/target check described in
[docs/hardware_check.md](docs/hardware_check.md):

```bash
bash firmware/scripts/check_stlink.sh
```

The check performs a software reset, confirms that OpenOCD halts the core, and
resumes it. It does not erase or program flash. The flash wrapper repeats this
check and selects the same project OpenOCD configuration:

```bash
bash firmware/scripts/flash_firmware.sh
```

Flashing erases and writes the STM32. The wrapper also accepts West flash
options after its name. The current image runs CAN RX/decode and `0x500` status
transmission, with the `led0` devicetree-selected LED as a 500 ms heartbeat. The
earlier LED-only image was flashed and confirmed on the physical board; flash
and CAN-bus verification of this new image are still pending.
