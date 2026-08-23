# Data Pipeline

This page defines what MetaDrive provides, what the MetaDrive CAN Bridge processes, what crosses CAN,
and what the STM32F407VE ECU needs to control the physical headlights.

## End-to-End Shape

```text
MetaDrive
  raw simulator outputs
        |
        v
MetaDrive CAN Bridge
  signal extraction + object filtering + unit conversion
        |
        v
cantools + python-can
  DBC encode + SocketCAN transmit
        |
        v
STM32F407VE AFS ECU
  mode logic + actuator commands + feedback checks
        |
        v
servo-swiveled LED-zone headlights
```

## MetaDrive Outputs

MetaDrive should be treated as the simulator data source. It does not output headlight
commands. The MetaDrive CAN Bridge reads or derives these values from MetaDrive state/observations:

| MetaDrive-side data | Meaning | Used for |
|---|---|---|
| Ego steering state/input | Current simulated steering | Low-beam AFS swivel command |
| Ego speed | Current simulated vehicle speed | Speed gating, gain scaling, status display |
| Ego heading or yaw rate | Vehicle orientation/turning behavior | Optional smoothing or diagnostics |
| Nearby vehicle forward offset | Object distance in front of ego vehicle | ADB relevance filtering |
| Nearby vehicle lateral offset | Object left/right position from ego centerline | ADB object angle calculation |
| Nearby vehicle relative speed | Whether object is leading/oncoming/unknown | Optional object classification |
| Lidar-like cloud/object detection | Surrounding obstacle evidence | Optional source for object validity |
| Navigation/lane info | Lane heading and route context | Optional scenario/debug signal |

Camera images are not required for the first build. Raw images and raw lidar arrays should
stay on the host side unless a later perception-focused phase explicitly needs them.

## Bridge Processing

The MetaDrive CAN Bridge owns simulator extraction and simplification. Its job is to convert raw
MetaDrive data into automotive-style CAN signals that the MCU can consume easily.

Core MetaDrive CAN Bridge steps:

1. Step or observe the MetaDrive environment.
2. Extract ego steering and ego speed.
3. Read nearby vehicle info or lidar-derived detected objects.
4. Transform candidate objects into ego-relative forward/lateral coordinates.
5. Reject objects behind the ego vehicle, outside ADB field of view, or beyond the detection limit.
6. Pick the most relevant glare-critical object, usually nearest valid vehicle ahead.
7. Convert that object to angle and distance.
8. Encode DBC messages with `cantools`.
9. Send frames to `vcan0` or `can0` with `python-can`.

ADB object conversion should follow this shape:

```text
dx = object forward distance from ego
dy = object lateral distance from ego

object_valid = dx > 0 and distance < detection_limit and abs(angle) < adb_fov_limit
object_angle_deg = atan2(dy, dx)
object_distance_m = sqrt(dx * dx + dy * dy)
```

## CAN Transfer

Only compact signals cross CAN. The DBC will define exact packing, scaling, enums, and alive
counters.

| CAN ID | Message | Producer | Consumer | Purpose |
|---:|---|---|---|---|
| `0x200` | `Vehicle_Steering` | MetaDrive CAN Bridge | AFS ECU, Dashboard | Steering angle and freshness for AFS |
| `0x300` | `Vehicle_Speed` | MetaDrive CAN Bridge | AFS ECU, Dashboard | Vehicle speed and freshness |
| `0x310` | `Vehicle_Object` | MetaDrive CAN Bridge | AFS ECU, Dashboard | Relevant object angle/distance for ADB |
| `0x400` | `Dashboard_Command` | Dashboard | AFS ECU | Requested lighting mode |
| `0x100` | `AFS_Status` | AFS ECU | Dashboard, logs | Executed mode, faults, servo/LED summary |

`cantools` encodes signal dictionaries into CAN frame bytes. `python-can` sends those bytes
onto SocketCAN. `cantools` does not transmit frames by itself.

## MCU Inputs

The STM32F407VE should receive only the signals needed for final lighting behavior:

| MCU input | Source | Why the MCU needs it |
|---|---|---|
| Steering angle | `Vehicle_Steering` | Compute low-beam swivel angle |
| Steering valid/alive | `Vehicle_Steering` | Detect stale steering data |
| Vehicle speed | `Vehicle_Speed` | Enable/gate behavior and scale swivel gain |
| Speed valid/alive | `Vehicle_Speed` | Detect stale speed data |
| Object valid | `Vehicle_Object` | Decide whether ADB shadow is active |
| Object angle | `Vehicle_Object` | Choose LED zones to dim |
| Object distance | `Vehicle_Object` | Tune shadow width/intensity |
| Object type | `Vehicle_Object` | Optional leading/oncoming/unknown distinction |
| Requested mode | `Dashboard_Command` | Select low-beam AFS, high-beam ADB, or safe output |
| Servo feedback ADC | Hardware | Confirm physical servo position |

## MCU Logic

The ECU owns final behavior. It should not trust the MetaDrive CAN Bridge to command actuators directly.

```text
if required CAN input is stale:
    execute Fault Safe
    center servos
    apply conservative low-beam LED pattern

else if requested mode is Low Beam Static:
    center servos
    apply low-beam LED pattern

else if requested mode is Low Beam AFS:
    servo_angle = clamp(steering_angle * speed_gain)
    apply low-beam LED pattern

else if requested mode is High Beam:
    center servos for first build
    apply high-beam LED pattern

else if requested mode is High Beam ADB:
    center servos for first build
    apply high-beam LED pattern
    if object_valid:
        dim LED zones around object_angle

read servo feedback
if commanded angle and feedback angle disagree beyond the calibrated limit:
    report servo fault
    fall back to conservative low-beam output where possible
```

For the first build, keep ADB with centered servos. A later phase can combine swivel and ADB
by converting object angle into the current headlight frame:

```text
object_angle_relative_to_headlight = object_angle_from_vehicle - servo_angle
```

## Physical Outputs

| Output | Driver path | Used for |
|---|---|---|
| Left swivel servo | STM32 I2C -> PCA9685 -> servo PWM | Low-beam AFS left headlight yaw |
| Right swivel servo | STM32 I2C -> PCA9685 -> servo PWM | Low-beam AFS right headlight yaw |
| Left LED zones | STM32 -> LED driver/PWM board | High-beam and ADB shadow pattern |
| Right LED zones | STM32 -> LED driver/PWM board | High-beam and ADB shadow pattern |
| Status CAN frame | STM32 CAN -> transceiver -> bus | Dashboard/log feedback |

## Next Integration Milestones

1. Build one headlight module and command servo/LED zones locally.
2. Build `can/afs.dbc` with the five top-level messages.
3. Build the MetaDrive CAN Bridge so it can send fixed synthetic CAN values without MetaDrive.
4. Connect MetaDrive steering/speed to CAN.
5. Add MetaDrive object extraction and `Vehicle_Object` output.
6. Implement STM32 mode logic and feedback fault checks.
7. Add Dashboard status display and repeatable demo scenarios.