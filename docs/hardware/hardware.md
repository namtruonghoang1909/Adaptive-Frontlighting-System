# Hardware Overview

This page is a short orientation to the planned Adaptive Front-lighting System bench hardware. The hardware demonstrates two lighting behaviors: low-beam AFS swivel and high-beam ADB beam dodging. See the [hardware wiring view](../../tools/system_visualization/hardware-wiring/index.html) for a Proteus-style pin-level schematic, [visual.md](visual.md) for the intended physical layout and headlight design, [wiring-draft.md](wiring-draft.md) for candidate signal and power connections, and the [hardware datasheet index](datasheets/README.md) for downloaded vendor documents and unresolved model-specific references.

## Bench Shape

```text
Linux VM + CAN adapter
        |
        | CANH / CANL
        v
MCP2551 CAN transceiver
        |
        | STM32 CAN TX / RX
        v
STM32F407VET6 AFS ECU
        |                         ^
        | I2C                     | servo position feedback
        v                         |
servo PCA9685 board               |
        | 50 Hz PWM               |
        v                         |
left/right feedback swivel servos |
        |
        v
rotating headlight platforms
        |
        +-- SPI -> left 8x8 MAX7219 matrix
        `-- SPI -> right 8x8 MAX7219 matrix
```

The STM32F407VET6 provides the CAN controller. The MCP2551 provides the electrical interface
between STM32 CAN TX/RX and the physical CAN bus. The rig uses two feedback servos for
horizontal swivel; cover and tilt servos are intentionally out of scope for the first build.
The firmware platform is Zephyr 3.7 RTOS. The earlier LED image was flashed to
the `black_f407ve` target over ST-Link, and the board LED blink was confirmed.
The current CAN receive/status image builds, but has not yet been flashed or
tested against a physical CAN bus. Peripheral pin routing and draft assignments
still need verification before connecting AFS hardware.
See the [firmware setup guide](../../firmware/README.md).

## One Headlight Module

```text
fixed base
  |
feedback servo
  |
rotating platform
  |
  +-- one 8x8 LED matrix for both beam modes
      +-- upper four rows: high-beam extension and ADB masking
      `-- lower four rows: low-beam base
```

In normal low-beam swivel mode, rows 1–4 are off, rows 5–8 are on, and the two
servos turn the whole matrix platforms by different angles with steering. The
outside matrix turns farther than the inside one; right turns mirror left
turns. In high-beam modes, the servos return to center, rows 5–8 stay on, and
rows 1–4 add the longer beam after centered feedback is confirmed. ADB switches
off affected upper pixels. The preview illustrates a 40 m, ±18° low beam with
±6° maximum outside-matrix swivel and a centered 100 m, ±10° high beam. The
outside matrix swivels three times farther than the inside matrix. These
values and row optics need bench calibration.

## Main Parts

| Part | Purpose |
|---|---|
| STM32F407VET6 board (`STM32F4VE ver 36C SN:2024C`) | AFS ECU controller; candidate Zephyr target `black_f407ve`; see the [MCU datasheet and revision note](datasheets/README.md#downloaded-documents) |
| MCP2551 CAN transceiver | CAN physical layer transceiver; see its [datasheet](datasheets/mcp2551-datasheet-rev-g.pdf) |
| CAN-to-USB adapter | Linux host connection to the real CAN bus; select one that exposes SocketCAN for the bridge and SavvyCAN monitoring |
| Servo PCA9685 board | Shared servo PWM driver over I2C at servo frequency; see the [PCA9685 datasheet](datasheets/pca9685-datasheet.pdf) |
| Left 8x8 MAX7219 matrix module | Left low/high beam pixel output and ADB masking; see the [MAX7219/MAX7221 datasheet](datasheets/max7219-max7221-datasheet-rev-6.pdf) |
| Right 8x8 MAX7219 matrix module | Right low/high beam pixel output and ADB masking |
| Matrix LED modules | Small-signal display LEDs and their MAX7219 drivers for a bench demonstration |
| Two feedback-capable servos | Left/right horizontal swivel with measured position |
| Two rotating headlight platforms | Lightweight mechanical headlight bodies |
| Two 8x8 LED matrices | One proposed matrix per headlight; 128 pixels total |
| 5-6 V servo supply | Dedicated servo power |
| Board USB-C 5 V rail | Proposed source for both matrix modules; verify source and board/header current capacity |
| Projection surface | White board or wall for visual beam behavior |

The provisional CAN ADB input is a 10-sector horizontal grid. Firmware maps
those sectors to eight horizontal columns on each matrix. The High beam visual
preview uses distance as a coarse vertical heuristic, switching off 4/3/2/1
top high-beam rows at example distances of 30/50/70/100 m; the lower four
low-beam rows stay active. Accurate vehicle-shaped shadows require vertical
object bounds and optical calibration.

## Important Constraints

- Servo power should not come from the STM32 board.
- In this wiring draft, matrix VCC uses the board's USB-C-fed 5 V rail. Verify
  the USB-C source and board/header path can carry the combined load; use a
  separate 5 V supply if that path is insufficient.
- Logic, servo, lighting, and CAN grounds need a common reference.
- CANH/CANL need proper termination on the physical bench bus.
- MCP2551 wiring and STM32 logic-level compatibility should be checked during hardware bring-up.
- Servo position feedback needs to return directly to STM32 ADC inputs.
- Analog feedback must stay within STM32 ADC limits; 0-3.3 V feedback servos are preferred.
- The servo PCA9685 remains on I2C at servo frequency. The two MAX7219 modules
  share SPI2 clock/data and use separate GPIO LOAD lines so each matrix can
  latch updates independently.
- A MAX7219 provides on/off pixels plus a global 16-step matrix brightness setting. It cannot set a separate brightness level for each pixel. [Check the MAX7219 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX7219-MAX7221.pdf).
- The MAX7219 operates from 4.0–5.5 V and specifies a 3.5 V minimum
  logic-high input at a 5 V supply. The selected prototype connects STM32
  3.3 V SCK, MOSI, and separate LOAD GPIOs directly to the modules for bench
  validation; this is below the specified threshold and is not guaranteed.
  If direct signaling is unreliable, add a compatible one-way buffer. Matrix
  VCC remains on the board's USB-C-fed 5 V rail. See the local
  [MAX7219/MAX7221 datasheet](datasheets/max7219-max7221-datasheet-rev-6.pdf).
- The matrix modules are display hardware for a bench demonstration. Their brightness and optics need evaluation before treating them as headlight emitters.
- Moving-platform wiring needs strain relief and bounded yaw travel to avoid twisting wires.
- Servo calibration, mechanical limits, matrix pixel angles, low-beam cutoff, high-beam reach, and ADB shadow margins require hardware bring-up calibration.

## Host CAN Bring-Up

The Ubuntu VM enumerates the USB-CAN adapter as `can0`, with the `gs_usb`
driver bound. The user configured it at the DBC bitrate of 500 kbit/s and
verified controller loopback with a test frame. This confirms the host driver
and adapter controller path; physical CANH/CANL communication remains
untested. Inspect and configure the interface from the repository root with:

```bash
lsusb -d 1d50:606f
ip -details -statistics link show can0
ethtool -i can0
sudo ip link set can0 down
sudo ip link set can0 type can bitrate 500000
sudo ip link set can0 up
ip -details -statistics link show can0
```

### Test The Adapter Controller Loopback

If the adapter firmware supports controller loopback, this checks the Linux
SocketCAN send/receive path without requiring another CAN node or putting test
frames onto the physical bus. In one terminal, start the monitor:

```bash
candump -tz -x can0
```

In another terminal, enable loopback and send a test frame:

```bash
sudo ip link set can0 down && \
  sudo ip link set can0 type can bitrate 500000 loopback on && \
  sudo ip link set can0 up
```

Only if all three setup commands succeed, send `cansend can0 123#DEADBEEF` from
another terminal. The monitor should show ID `123` with data `DEADBEEF`. The
Linux `gs_usb` driver exposes controller loopback only when the adapter
firmware advertises that capability. If loopback is unsupported, do not send
the frame; reapply the normal 500 kbit/s configuration from the previous step.
Controller loopback does not test the adapter's physical transceiver or
CANH/CANL wiring. See the
[Linux SocketCAN documentation](https://docs.kernel.org/networking/can.html)
for local loopback and controller modes.

The adapter passed this check in the Ubuntu VM: `candump -tz -x can0` showed
both a TX echo and a matching RX frame for `123 [4] DE AD BE EF` while
controller loopback was enabled. The user also confirmed that `can-utils` is
installed.

After a successful loopback test, restore normal bus mode:

```bash
sudo ip link set can0 down
sudo ip link set can0 type can bitrate 500000 loopback off
sudo ip link set can0 up
```

### Test Bridge Transmission Through Adapter Loopback

This checks that the bridge's production SocketCAN worker can write its
scheduled frames through the adapter. First enable controller loopback using
the commands above. In one terminal, monitor the bridge's four transmitted
message IDs:

```bash
candump -tz -x can0,100:7FF,200:7FF,300:7FF,400:7FF
```

From the repository root in another terminal, launch the bridge with CAN:

```bash
bash bridge/scripts/run_runner_bridge.sh --can-interface can0
```

The monitor should show IDs `100`, `200`, `300`, and `400`. Without a runner
or Dashboard connected, their validity/command fields remain cleared; this
check verifies transport writes, not live signal values or ECU execution.
Stop the bridge with Ctrl+C, stop `candump`, then restore normal bus mode with
the commands above. Do not send in normal mode on an isolated physical bus;
the physical bus test below requires a second active CAN node to acknowledge
frames.

This check passed in the user's Ubuntu VM: each listed ID had matching TX and
RX loopback entries, and the alive counters advanced at the configured
periods. The bridge also reported `No buffer space available` during the run.
The excerpt confirms successful frames around that warning but is not enough
to identify its cause. Check `ip -details -statistics link show can0` after a
run and confirm whether controller loopback was active when the warning
appeared before changing queue settings.

### Verify The Physical CAN Bus

Physical transmit/receive testing needs another powered CAN node at 500 kbit/s
to acknowledge frames, correct CANH/CANL wiring, and termination at the bus
ends. Do not send test frames on an unrelated live bus. The STM32 application
now builds CAN2 receive/decode and periodic `0x500` status reporting, but the
image has not yet been flashed and transceiver wiring remains to be verified.
Until output drivers exist, status reports `Safe_Default` and unavailable
beam/servo control. Once a second node is ready, monitor the bus with:

```bash
candump -tz -x can0
```

When the ECU firmware can receive CAN, start the bridge with
`bash bridge/scripts/run_runner_bridge.sh --can-interface can0`; then start the
Dashboard and MetaDrive as described in [development.md](../development.md).
Confirm that `0x100`, `0x200`, `0x300`, and `0x400` appear, then verify that the
ECU reports `0x500`. The Dashboard should show fresh ECU status only after a
valid report. The synthetic `0x500` injector belongs to the `vcan0` integration
test and is not part of physical bring-up.

For the planned host-side CAN workflow, Vector CANdb++ edits the DBC and SavvyCAN displays decoded traffic. See [CAN DBC editing and monitoring](../can/README.md#dbc-editing-and-live-monitoring) for the DBC, SocketCAN, and live-traffic requirements.
