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
        +-- left beam PCA9685 -> left LED zones
        +-- right beam PCA9685 -> right LED zones
```

The STM32F407VE provides the CAN controller. The MCP2551 provides the electrical interface
between STM32 CAN TX/RX and the physical CAN bus. The rig uses two feedback servos for
horizontal swivel; cover and tilt servos are intentionally out of scope for the first build.

## One Headlight Module

```text
fixed base
  |
feedback servo
  |
rotating platform
  |
  +-- low-beam output
  +-- high-beam LED zones: [Z0][Z1][Z2][Z3][Z4][Z5][Z6]
  +-- beam PCA9685 PWM input path
```

The servo swivels the whole platform for low-beam AFS. The LED zones dim independently for
high-beam ADB.

## Main Parts

| Part | Purpose |
|---|---|
| STM32F407VE board | AFS ECU controller |
| MCP2551 CAN transceiver | CAN physical layer transceiver |
| CAN-to-USB adapter | Linux host connection to the real CAN bus |
| Servo PCA9685 board | Shared servo PWM driver over I2C at servo frequency |
| Left beam PCA9685 board | PWM control for left headlight LED zones |
| Right beam PCA9685 board | PWM control for right headlight LED zones |
| LED current limiting / driver stages | Electrical protection and current handling for LED zones |
| Two feedback-capable servos | Left/right horizontal swivel with measured position |
| Two rotating headlight platforms | Lightweight mechanical headlight bodies |
| Fourteen LED zones | Seven simulated beam zones per headlight |
| 5-6 V servo supply | Dedicated servo power |
| LED supply | Dedicated LED power sized to the selected LED modules |
| Projection surface | White board or wall for visual beam behavior |

The CAN ADB input is a 16-sector logical grid. The first bench has fourteen physical LED zones,
so firmware calibration must map logical sectors to the available left/right LED channels.
That mapping is intentionally not fixed until the physical zone angles are measured.

## Important Constraints

- Servo power should not come from the STM32 board.
- LED power should not come from the STM32 board.
- Logic, servo, lighting, and CAN grounds need a common reference.
- CANH/CANL need proper termination on the physical bench bus.
- MCP2551 wiring and STM32 logic-level compatibility should be checked during hardware bring-up.
- Servo position feedback needs to return directly to STM32 ADC inputs.
- Analog feedback must stay within STM32 ADC limits; 0-3.3 V feedback servos are preferred.
- The servo PCA9685 board and beam PCA9685 boards should be separate because they use different output roles.
- PCA9685 beam boards do not replace LED current limiting; LEDs still need resistors, MOSFET stages, or constant-current drivers as appropriate.
- Moving-platform wiring needs strain relief and bounded yaw travel to avoid twisting wires.
- Servo calibration, mechanical limits, LED zone angles, and ADB shadow margins are hardware bring-up details, not fixed in docs yet.