# Hardware Visual Plan

This page describes the intended physical hardware layout for the Adaptive Front-lighting System prototype. It demonstrates low-beam AFS swivel and high-beam ADB beam dodging. It is a
visual wiring and mechanical guide, not a pin-accurate schematic. Exact pin assignments,
connector part numbers, fuse sizes, and calibration values belong in the later hardware and
firmware build work.

## Full Bench Layout

```text
                 Linux runtime machine
       +------------------------------------+
       | Dashboard                          |
       | MetaDrive Simulation               |
       | CAN Bridge                         |
       | candump / SavvyCAN                 |
       +------------------+-----------------+
                          |
                          | USB
                          v
                  CAN-to-USB adapter
                          |
                 CANH ----+-----------------------------+
                 CANL ----+-----------------------------+
                 GND  ----+-----------------------------+
                          |                             |
                    120 ohm termination           120 ohm termination
                          |                             |
                          v                             v
                 +----------------+              +----------------+
                 | MCP2551 CAN    |              | optional CAN   |
                 | transceiver    |              | tool/node      |
                 +-------+--------+              +----------------+
                         |
                         | STM32 CAN TX/RX
                         v
                 +----------------+
                 | STM32F407VE    |
                 | AFS/ADB ECU    |
                 +--+----------+--+
                    |          |
                    | I2C      | ADC feedback
                    |          |
                    v          v
          +----------------+  servo feedback wires
          | PCA9685 servo  |
          | driver, 50 Hz  |
          +---+--------+---+
              |        |
              | PWM    | PWM
              v        v
       left feedback  right feedback
       swivel servo   swivel servo
              |        |
              v        v
       left headlight  right headlight
       LED platform    LED platform
```

## Main Project Flow

| Component | Where it runs | Responsibility |
|---|---|---|
| Dashboard | Linux runtime | Provides HMI command state to the CAN Bridge and displays decoded ECU status |
| MetaDrive Simulation | Linux runtime | Produces raw simulated ego and surrounding-vehicle data |
| CAN Bridge | Linux runtime | Reads Dashboard/MetaDrive state, sends DBC-encoded CAN frames, receives ECU status, and forwards decoded status |
| STM32F407VE ECU Firmware | Physical STM32 board | Receives CAN, decides final lighting behavior, drives servos/LEDs, and reports status |
| Headlight rig | Physical bench | Shows low-beam swivel and high-beam beam-zone dimming |

The CAN Bridge is a host-side adapter, not the ECU. The STM32F407VE firmware owns the final
actuator decisions.

## One Headlight Design

Each headlight is a lightweight rotating platform on a feedback servo.

```text
side view

         LED zone board / light bar
       +-----------------------------+
       | Z0 Z1 Z2 Z3 Z4 Z5 Z6       |
       +-------------+---------------+
                     |
              rotating platform A
                     |
              servo horn / bracket
                     |
              feedback swivel servo
                     |
                  fixed base
```

```text
top view, one headlight

       far left                          far right
        beam                               beam
         |                                  |
         v                                  v
      [ Z0 ][ Z1 ][ Z2 ][ Z3 ][ Z4 ][ Z5 ][ Z6 ]
                         ^
                       center

               platform yaw from servo
          <----------- center ----------->
```

Low-beam AFS uses the servo to swivel the whole platform horizontally. High-beam ADB keeps
the first-build platform centered and dims LED zones around the detected vehicle angle.

## Two-Headlight Front Layout

```text
front view facing projection wall

      left headlight module                 right headlight module
   +-------------------------+           +-------------------------+
   | L0 L1 L2 L3 L4 L5 L6   |           | R0 R1 R2 R3 R4 R5 R6   |
   +-----------+-------------+           +-------------+-----------+
               |                                       |
        left feedback servo                    right feedback servo
               |                                       |
   +-----------+-------------+           +-------------+-----------+
   | fixed left base        |           | fixed right base        |
   +------------------------+           +-------------------------+

                         projection wall / white board
```

The LED zones should be physically separated with small baffles or spacing so dimmed zones
are visible on the projection surface.

## CAN Bus Wiring

Use a normal two-wire CAN bus plus shared reference ground.

```text
CAN-to-USB adapter                      STM32 ECU node
+--------------+                        +-------------------+
| CANH --------+------------------------+ CANH              |
| CANL --------+------------------------+ CANL              |
| GND  --------+------------------------+ GND reference     |
+--------------+                        +-------------------+

120 ohm termination should be present across CANH/CANL at each end of the bus.
```

The STM32F407VE does not connect directly to CANH/CANL. It connects through a CAN
transceiver:

```text
STM32F407VE CAN_TX ----> TXD  CAN transceiver  CANH ---- bus CANH
STM32F407VE CAN_RX <---- RXD  CAN transceiver  CANL ---- bus CANL
STM32 GND ------------------- transceiver GND ----- bus/reference GND
```

The current planned transceiver is MCP2551. Because many MCP2551 modules are 5 V parts,
verify RX/TX logic compatibility before connecting them to the STM32. Use a 3.3 V-compatible
transceiver or level shifting if the selected module cannot interface safely with STM32 pins.

## Servo Wiring

The PCA9685 generates the servo PWM command. The servo feedback wire returns to the STM32 ADC,
not to the PCA9685.

```text
5-6 V servo supply + ----+------------------ servo V+
                         |
                         +------------------ PCA9685 servo V+

common GND -------------+------------------ servo GND
                        +------------------ PCA9685 GND
                        +------------------ STM32 GND

STM32 I2C SCL ---------- PCA9685 SCL
STM32 I2C SDA ---------- PCA9685 SDA
PCA9685 PWM0 ----------- left servo PWM
PCA9685 PWM1 ----------- right servo PWM
left servo feedback ---- STM32 ADC input
right servo feedback --- STM32 ADC input
```

Use 0-3.3 V feedback servos where possible. If a feedback line can exceed 3.3 V, scale or
buffer it before the STM32 ADC pin.

## LED Zone Wiring

The LED zones should use a separate LED PWM or LED driver path from the servo PCA9685. Servo
PWM wants about 50 Hz, while LED dimming should use a higher PWM rate or a constant-current
LED driver to avoid visible flicker.

```text
STM32 control bus or PWM outputs
        |
        v
LED PWM / constant-current driver board
        |
        +-- zone 0 LED/resistor or driver channel
        +-- zone 1 LED/resistor or driver channel
        +-- zone 2 LED/resistor or driver channel
        +-- zone 3 LED/resistor or driver channel
        +-- zone 4 LED/resistor or driver channel
        +-- zone 5 LED/resistor or driver channel
        `-- zone 6 LED/resistor or driver channel
```

For two headlights, use fourteen zones total:

```text
left:  L0 L1 L2 L3 L4 L5 L6
right: R0 R1 R2 R3 R4 R5 R6
```

A PCA9685-style board can provide PWM control, but it does not provide current regulation by
itself. Each LED zone still needs the right resistor, MOSFET stage, or constant-current driver
for the selected LED hardware.

## Power Wiring

Use separate supplies for logic, servos, and LEDs, with a common ground reference.

```text
STM32 logic power      -> STM32 board
5-6 V servo supply     -> servo V+ and PCA9685 servo power rail
LED supply             -> LED driver and LED zones
all grounds            -> common ground reference
```

Do not power servos or LED zones from the STM32 board. Add local bulk capacitance near the
servo and LED supplies during bring-up if resets, flicker, or brownouts appear.

## Intended Physical Behavior

| Mode | Servo behavior | LED behavior |
|---|---|---|
| `Off` | No active swivel command | Headlight output off or standby |
| `LowBeam_NoSwivel` | Both headlights centered | Conservative low-beam pattern |
| `LowBeam_Swivel` | Headlights swivel from steering/speed | Conservative low-beam pattern |
| `HighBeam_NoDimming` | Headlights centered for first build | High-beam zones bright |
| `HighBeam_Dimming` | Headlights centered for first build | Zones dim around detected vehicles |
| `Safe_Default` | Center where possible | Conservative low-beam pattern |

## Bring-Up Order

1. Test STM32F407VE power, debug, and basic firmware flashing.
2. Bring up CAN transceiver with SocketCAN and known test frames.
3. Bring up the PCA9685 and command one feedback servo.
4. Read one servo feedback signal on STM32 ADC and calibrate center/min/max.
5. Bring up one LED-zone driver and dim each of the seven zones.
6. Assemble one rotating headlight platform and test cable strain relief.
7. Duplicate the module for the second headlight.
8. Integrate CAN commands from the CAN Bridge.