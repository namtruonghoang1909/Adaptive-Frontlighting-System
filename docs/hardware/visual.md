# Hardware Visual Plan

This page describes the intended physical hardware layout for the Adaptive Front-lighting System prototype. It demonstrates low-beam AFS swivel and high-beam ADB beam dodging. It is a visual and mechanical guide, not a reviewed schematic. The separate [wiring draft](wiring-draft.md) proposes signal pins and calls out electrical details that still need confirmation.

## Full Bench Layout

```text
                 Linux runtime machine
       +------------------------------------+
       | Dashboard                          |
       | MetaDrive Simulation               |
       | C++ Bridge                          |
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
                 | STM32F407VET6  |
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
| Dashboard | Linux runtime | Sends HMI requests to the C++ bridge and displays decoded ECU status received through bridge IPC |
| MetaDrive Simulation | Linux runtime | Produces raw simulated ego and surrounding-vehicle data |
| C++ Bridge | Linux runtime | Receives Dashboard/simulation IPC, sends DBC-encoded CAN frames, receives ECU status, and forwards decoded status |
| STM32F407VET6 ECU Firmware | Physical STM32 board | Receives CAN, decides final lighting behavior, drives servos/LEDs, and reports status |
| Headlight rig | Physical bench | Shows low-beam swivel and matrix-pixel high-beam masking |

The C++ bridge is a host-side communication gateway, not the ECU. The STM32F407VET6 firmware owns the final
actuator decisions.

## One Headlight Design

Each headlight is a lightweight rotating platform on a feedback servo.

```text
side view

         8x8 MAX7219 LED matrix
       +-------------------------+
       | H H H H H H H H | rows 1–4: high beam
       | H H H H H H H H |
       | H H H H H H H H |
       | H H H H H H H H |
       |-------------------------|
       | L L L L L L L L | rows 5–8: low beam
       | L L L L L L L L |
       | L L L L L L L L |
       | L L L L L L L L |
       +-------------------------+
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
      C0  C1  C2  C3  C4  C5  C6  C7
      Each column contains four high + four low pixels

               platform yaw from servo
          <----------- center ----------->
```

Low-beam AFS uses the servo to swivel both platforms horizontally with rows
5–8 on and rows 1–4 off. High-beam modes center both platforms, keep rows
5–8 on, and add rows 1–4 after centered feedback is accepted. ADB switches
off upper pixels in affected horizontal columns. The High beam visual preview uses vehicle distance as a
coarse vertical heuristic: its example distances 30/50/70/100 m mask 4/3/2/1
top high-beam rows per affected column. It does not use target height or
produce a vehicle-shaped vertical shadow. The [Low beam visual](../../tools/system_visualization/beam-visual/beam-segments.html?mode=low)
shows the proposed shorter, wider shine and a preview of speed-scaled steering response. Its 40 m /
±18° low beam and the high view's centered 100 m / ±10° beam are illustrative
optical targets.

## Two-Headlight Front Layout

```text
front view facing projection wall

      left headlight matrix                 right headlight matrix
   +-------------------------+           +-------------------------+
   | 8 columns × 8 LED pixels |           | 8 columns × 8 LED pixels |
   | low base + high ADB     |           | low base + high ADB     |
   +-----------+-------------+           +-------------+-----------+
               |                                       |
        left feedback servo                    right feedback servo
               |                                       |
   +-----------+-------------+           +-------------+-----------+
   | fixed left base        |           | fixed right base        |
   +------------------------+           +-------------------------+

                         projection wall / white board
```

Map the eight matrix columns to separate horizontal beam directions with
appropriate optics. Calibrate the low-beam cutoff and high-beam rows on a
projection surface; the matrix pixels alone do not define the beam pattern.

## CAN Bus Wiring

Use a normal two-wire CAN bus. A reference-ground wire is optional and depends
on the adapter's isolation design.

```text
CAN-to-USB adapter                      STM32 ECU node
+--------------+                        +-------------------+
| CANH --------+------------------------+ CANH              |
| CANL --------+------------------------+ CANL              |
| GND* --------+------------------------+ GND reference     |
+--------------+                        +-------------------+
```

Use one 120 ohm termination at each physical end of the bus. Connect the
adapter's ground to the bench reference only if its isolation design supports
it; see the [wiring draft](wiring-draft.md).

The STM32F407VET6 does not connect directly to CANH/CANL. It connects through a CAN
transceiver:

```text
STM32F407VET6 CAN_TX ----> TXD  CAN transceiver  CANH ---- bus CANH
STM32F407VET6 CAN_RX <---- RXD  CAN transceiver  CANL ---- bus CANL
STM32 GND ------------------- transceiver GND ----- bus/reference GND
```

The current planned transceiver is MCP2551. Because many MCP2551 modules are 5 V parts,
verify RX/TX logic compatibility before connecting them to the STM32. Use a 3.3 V-compatible
transceiver or level shifting if the selected module cannot interface safely with STM32 pins.
The candidate CAN2 mapping and pin-by-pin checks are in the [wiring draft](wiring-draft.md).

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

## Matrix Wiring

Each headlight uses one MAX7219 8x8 matrix module. The MAX7219 scans the display
and stores each pixel as on or off. Its 16-step intensity setting applies to
the whole matrix; ADB therefore switches selected high-beam pixels off rather
than setting independent pixel brightness.

```text
STM32 SPI SCK -----------------------+-------------------------+
STM32 SPI MOSI ---------------------+-------------------------+
STM32 GPIO LOAD_LEFT -------------->| MAX7219 left matrix     |
STM32 GPIO LOAD_RIGHT ------------->| MAX7219 right matrix    |
common ground ----------------------+-------------------------+
                                     |                         |
                                     v                         v
                                  left 8x8                right 8x8
                                  LED matrix              LED matrix
```

Use one shared SPI bus with separate LOAD signals. A LOAD rising edge applies
the last 16 bits to that matrix; some modules label LOAD as CS. The selected
prototype wiring connects the STM32's 3.3 V SCK, MOSI, and LOAD outputs directly
to the modules for bench validation. At a 5 V supply the MAX7219 specifies a
3.5 V minimum logic-high input, so 3.3 V is below the guaranteed threshold.
Direct operation may work in practice, but it must be verified and is not
guaranteed by the datasheet. If unreliable, add a compatible one-way buffer
for the four signals; the buffer does not supply the matrices. See the
[MAX7219 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX7219-MAX7221.pdf).

The MAX7219 module is a display driver, not an automotive headlight driver.
Evaluate its output and optics for the bench demonstration.

The proposed row allocation is:

```text
matrix rows 1–4: high-beam extension; ADB can switch pixels off
matrix rows 5–8: low-beam pattern; stays active in high-beam mode
```

Each beam pattern has four rows by eight columns. This is an initial preview
layout, not a measured optical pattern.

## Power Wiring

The current wiring plan uses the same USB-C 5 V source for the STM32F4VE board
and both matrix modules. The board's 5 V header rail feeds matrix VCC; the
STM32 GPIO signals connect directly at 3.3 V for the selected bench test.
Verify that the USB-C source and board/header path can supply the combined
load before connecting the matrices. Keep the servo motors on a separate supply.

```text
USB-C 5 V source       -> STM32F4VE board input and 5 V rail
board 5 V header       -> left/right MAX7219 VCC
STM32 3.3 V GPIO       -> SCK, MOSI, left/right LOAD (bench validation)
5-6 V servo supply     -> servo V+ and PCA9685 servo power rail
all grounds            -> common ground reference
```

Do not power the servos from the STM32 board. If the USB-C source or board
header path cannot carry the matrix load, move matrix VCC to a suitable
separate 5 V source and keep grounds common. Add local
bypass capacitance near each MAX7219 and bulk capacitance near the servo and
matrix supplies during bring-up if resets, flicker, or brownouts appear.

## Intended Physical Behavior

| Mode | Servo behavior | Matrix behavior |
|---|---|---|
| `Off` | No active swivel command | Headlight output off or standby |
| `LowBeam_NoSwivel` | Both headlights centered | Rows 1–4 off; rows 5–8 on |
| `LowBeam_Swivel` | Both headlights swivel from steering/speed | Rows 1–4 off; rows 5–8 on |
| `HighBeam_NoDimming` | Both headlights centered | Rows 5–8 stay on; all rows 1–4 on after centered feedback |
| `HighBeam_Dimming` | Both headlights centered | Rows 5–8 stay on; affected pixels in rows 1–4 switch off after centered feedback |
| `Safe_Default` | Center where possible | Conservative low-beam pattern |

## Bring-Up Order

1. Use ST-Link to flash a Zephyr LED-blink sample on the STM32F407VET6 board before connecting external peripherals.
2. Bring up CAN transceiver with SocketCAN and known test frames.
3. Bring up the PCA9685 and command one feedback servo.
4. Read one servo feedback signal on STM32 ADC and calibrate center/min/max.
5. Bring up one MAX7219 module, verify row/column orientation, and display the low/high row patterns.
6. Assemble one rotating headlight platform and test cable strain relief.
7. Duplicate the module for the second headlight.
8. Integrate CAN commands from the C++ bridge.
