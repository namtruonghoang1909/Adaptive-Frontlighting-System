# Hardware Overview

This page is a short orientation to the planned Adaptive Front-lighting System bench hardware. The hardware demonstrates two lighting behaviors: low-beam AFS swivel and high-beam ADB beam dodging. See [visual.md](visual.md) for the intended physical layout, headlight design, CAN wiring, and component wiring.

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
STM32F407VE AFS ECU
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

The STM32F407VE provides the CAN controller. The MCP2551 provides the electrical interface
between STM32 CAN TX/RX and the physical CAN bus. The rig uses two feedback servos for
horizontal swivel; cover and tilt servos are intentionally out of scope for the first build.
The planned firmware platform is Zephyr RTOS. Confirm the exact development board before
choosing its Zephyr target and configuring CAN, ADC, I2C, and SPI pins.

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
| STM32F407VE board | AFS ECU controller |
| MCP2551 CAN transceiver | CAN physical layer transceiver |
| CAN-to-USB adapter | Linux host connection to the real CAN bus; select one that exposes SocketCAN for the planned gateway and SavvyCAN monitoring |
| Servo PCA9685 board | Shared servo PWM driver over I2C at servo frequency |
| Left 8x8 MAX7219 matrix module | Left low/high beam pixel output and ADB masking |
| Right 8x8 MAX7219 matrix module | Right low/high beam pixel output and ADB masking |
| Matrix LED modules | Small-signal display LEDs and their MAX7219 drivers for a bench demonstration |
| Two feedback-capable servos | Left/right horizontal swivel with measured position |
| Two rotating headlight platforms | Lightweight mechanical headlight bodies |
| Two 8x8 LED matrices | One proposed matrix per headlight; 128 pixels total |
| 5-6 V servo supply | Dedicated servo power |
| LED supply | Dedicated LED power sized to the selected LED modules |
| Projection surface | White board or wall for visual beam behavior |

The provisional CAN ADB input is a 10-sector horizontal grid. Firmware maps
those sectors to eight horizontal columns on each matrix. The High beam visual
preview uses distance as a coarse vertical heuristic, switching off 4/3/2/1
top high-beam rows at example distances of 30/50/70/100 m; the lower four
low-beam rows stay active. Accurate vehicle-shaped shadows require vertical
object bounds and optical calibration.

## Important Constraints

- Servo power should not come from the STM32 board.
- LED power should not come from the STM32 board.
- Logic, servo, lighting, and CAN grounds need a common reference.
- CANH/CANL need proper termination on the physical bench bus.
- MCP2551 wiring and STM32 logic-level compatibility should be checked during hardware bring-up.
- Servo position feedback needs to return directly to STM32 ADC inputs.
- Analog feedback must stay within STM32 ADC limits; 0-3.3 V feedback servos are preferred.
- The servo PCA9685 remains on I2C at servo frequency. The two MAX7219 modules use the STM32 SPI interface, with shared clock/data and separate chip-select/load signals or a supported daisy chain.
- A MAX7219 provides on/off pixels plus a global 16-step matrix brightness setting. It cannot set a separate brightness level for each pixel. [Check the MAX7219 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX7219-MAX7221.pdf).
- The MAX7219 operates from 4.0–5.5 V and specifies a 3.5 V logic-high input at a 5 V supply. STM32 3.3 V SPI outputs may need level shifting; confirm the exact module before wiring it directly.
- The matrix modules are display hardware for a bench demonstration. Their brightness and optics need evaluation before treating them as headlight emitters.
- Moving-platform wiring needs strain relief and bounded yaw travel to avoid twisting wires.
- Servo calibration, mechanical limits, matrix pixel angles, low-beam cutoff, high-beam reach, and ADB shadow margins require hardware bring-up calibration.

For the planned host-side CAN workflow, Vector CANdb++ edits the DBC and SavvyCAN displays decoded traffic. See [CAN DBC editing and monitoring](../can/README.md#dbc-editing-and-live-monitoring) for the DBC, SocketCAN, and live-traffic requirements.
