# Hardware Overview

This page is a short orientation to the planned AFS/ADB bench hardware. See [visual.md](visual.md) for the intended physical layout, headlight design, CAN wiring, and component wiring.

## Bench Shape

```text
Linux VM + CAN adapter
        |
        | CANH / CANL
        v
3.3 V logic CAN transceiver
        |
        | STM32 CAN TX / RX
        v
STM32F407VE AFS ECU
        |                         ^
        | I2C                     | servo position feedback
        v                         |
fixed PCA9685 servo driver        |
        | 50 Hz PWM               |
        v                         |
left/right feedback swivel servos |
        |
        v
rotating headlight platforms
        |
        | I2C/SPI/PWM + LED power
        v
platform LED PWM/driver boards
        |
        v
7 LED beam zones per headlight
```

The STM32F407VE provides the CAN controller. A CAN transceiver provides the electrical
interface between STM32 CAN TX/RX and the physical CAN bus. The rig uses two feedback servos
for horizontal swivel; cover and tilt servos are intentionally out of scope for the first
build.

## One Headlight Module

```text
fixed base
  |
feedback servo
  |
rotating platform A
  |
  +-- platform LED PWM/driver board
  +-- seven LED zones: [Z0][Z1][Z2][Z3][Z4][Z5][Z6]
```

The servo swivels the whole platform for low-beam AFS. The LED zones dim independently for
high-beam ADB.

## Main Parts

| Part | Purpose |
|---|---|
| STM32F407VE board | AFS/ADB ECU controller |
| 3.3 V logic CAN transceiver | CAN physical layer transceiver |
| CAN-to-USB adapter | Linux host connection to the real CAN bus |
| PCA9685 servo driver | Servo PWM driver over I2C at servo frequency |
| Two feedback-capable servos | Left/right horizontal swivel with measured position |
| Two rotating headlight platforms | Lightweight mechanical headlight bodies |
| Two platform LED PWM/driver boards | Independent brightness control for LED zones |
| Fourteen LED zones | Seven simulated beam zones per headlight |
| 5-6 V servo supply | Dedicated servo power |
| LED supply | Dedicated LED power sized to the selected LED modules |
| Projection surface | White board or wall for visual beam behavior |

## Important Constraints

- Servo power should not come from the STM32 board.
- LED power should not come from the STM32 board.
- Logic, servo, lighting, and CAN grounds need a common reference.
- CANH/CANL need proper termination on the physical bench bus.
- Prefer a CAN transceiver with 3.3 V logic support for the STM32F407VE.
- Servo position feedback needs to return directly to STM32 ADC inputs.
- Analog feedback must stay within STM32 ADC limits; 0-3.3 V feedback servos are preferred.
- The servo PWM board and LED PWM/driver boards should be separate because they use different
  PWM frequency needs.
- A PCA9685-style LED board does not replace LED current limiting; LEDs still need resistors,
  MOSFET stages, or constant-current drivers as appropriate.
- Moving-platform wiring needs strain relief and bounded yaw travel to avoid twisting wires.
- Servo calibration, mechanical limits, LED zone angles, and ADB shadow margins are hardware
  bring-up details, not fixed in docs yet.