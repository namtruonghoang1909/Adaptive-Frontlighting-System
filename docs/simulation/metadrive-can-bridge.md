# MetaDrive CAN Bridge

The MetaDrive CAN Bridge is the host-side link between MetaDrive and CAN. It runs in the Linux
runtime environment as Python code.

## Role

- Read ego steering and speed from MetaDrive.
- Read or derive relevant surrounding-vehicle information for ADB.
- Convert simulator coordinates into simple vehicle-relative signals.
- Filter raw object/lidar information into one compact relevant-object record.
- Use `cantools` to encode signal dictionaries with `can/afs.dbc`.
- Use `python-can` to send encoded frames through SocketCAN.
- Publish `0x200 Vehicle_Steering` and `0x300 Vehicle_Speed`.
- Publish `0x310 Vehicle_Object` or equivalent processed object input.
- Leave mode selection, actuator decisions, and lighting safety behavior to the AFS ECU.

## MetaDrive Inputs

The MetaDrive CAN Bridge should consume these MetaDrive-side values where available:

| MetaDrive value | Bridge use |
|---|---|
| Ego steering | Convert to `steering_angle_deg` |
| Ego speed | Convert to `vehicle_speed_kph` |
| Ego heading/yaw rate | Optional diagnostics or smoothing |
| Nearby vehicle forward/lateral offset | Find relevant ADB object |
| Nearby vehicle relative speed | Optional leading/oncoming classification |
| Lidar-like detections | Optional object validity source |
| Navigation/lane info | Optional scenario/debug data |

## Bridge Outputs

The MetaDrive CAN Bridge output should be CAN-ready signals, not actuator commands:

| Signal | Consumer | Meaning |
|---|---|---|
| `steering_angle_deg` | STM32F407VE, Dashboard | Ego steering for low-beam AFS |
| `vehicle_speed_kph` | STM32F407VE, Dashboard | Ego speed for gating and gain scaling |
| `object_valid` | STM32F407VE, Dashboard | Whether ADB has a relevant object |
| `object_angle_deg` | STM32F407VE, Dashboard | Horizontal object angle relative to ego heading |
| `object_distance_m` | STM32F407VE, Dashboard | Object distance for ADB shadow tuning |
| `object_type` | STM32F407VE, Dashboard | Optional leading/oncoming/unknown classification |
| `alive_counter` | STM32F407VE, Dashboard | Freshness/stale-message detection |

## Object Signal Boundary

The MetaDrive CAN Bridge should not forward raw lidar arrays to the STM32. It should publish compact
object-level signals. The typical object conversion is:

```text
dx = object forward distance from ego
dy = object lateral distance from ego

object_angle_deg = atan2(dy, dx)
object_distance_m = sqrt(dx * dx + dy * dy)
object_valid = dx > 0 and object_distance_m < detection_limit
```

If multiple vehicles are valid, choose the one most relevant to glare avoidance. The first
implementation should use nearest valid vehicle ahead.

## CAN Boundary

`cantools` should load `can/afs.dbc` and encode messages. `python-can` should send the
encoded bytes to `vcan0` for virtual testing or `can0` for hardware.

```text
MetaDrive -> MetaDrive CAN Bridge extraction -> cantools encode -> python-can send -> SocketCAN
```

The MetaDrive CAN Bridge is not a physical ECU. It is a software CAN publisher that makes simulated
vehicle and perception-like input look like bus traffic for the AFS ECU.

## Notes

MetaDrive CAN Bridge code should stay outside `simulation/metadrive/`, because that folder is a
local ignored MetaDrive tree. Exact APIs, conversion math, logging, and scenarios are future
build details.