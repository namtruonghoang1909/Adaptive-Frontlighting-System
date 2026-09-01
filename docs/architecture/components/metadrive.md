# MetaDrive Component

MetaDrive is the host-side driving simulator used by the prototype. It creates virtual road scenes, ego vehicle motion, and surrounding vehicles for AFS/ADB demonstrations.

The project treats MetaDrive as a data source, not as a lighting controller. The next implementation step is to read the specific values the CAN Bridge needs: ego steering, ego speed, and relevant surrounding-object data.

## Flow

```text
scenario configuration -> MetaDrive runtime -> ego/object state -> CAN Bridge reads
```

The CAN Bridge reads selected MetaDrive values and converts them into `0x200`, `0x300`, and `0x310` CAN frames.

## Responsibilities

- Run repeatable driving scenarios for low-beam AFS and high-beam ADB demonstrations.
- Provide ego steering and speed data to the CAN Bridge.
- Provide surrounding-vehicle position/presence data to the CAN Bridge.
- Keep simulator internals replaceable by exposing only the selected project data.
- Support scenario playback and tuning for bench verification.

MetaDrive does not publish CAN, command headlights, or decide whether a beam segment should dim.

## Inputs

| Input | Source | Used for |
|---|---|---|
| Scenario configuration | Project scenario files or scripts | Define road geometry, ego route, traffic objects, and repeatability |
| Runtime control | Developer tool or later Dashboard workflow | Start, stop, reset, pause, or select a scenario |
| Random seed, if used | Scenario config | Make object placement and traffic behavior repeatable |
| Extraction configuration | CAN Bridge configuration | Define which ego and object fields the bridge reads |
| Simulation timestep | Runtime config | Keep bridge sampling and scenario playback predictable |

The simulation input should be repeatable enough that the same AFS/ADB behavior can be shown again during debugging and demos.

## Processing

MetaDrive processes the driving scene. It should not process headlight control logic.

| Process | Meaning |
|---|---|
| Run road scene | Simulate road geometry, lanes, traffic, and ego vehicle movement |
| Update ego state | Produce steering, speed, heading, and position-like state as available |
| Update surrounding vehicles | Produce relative or world positions for lead and oncoming vehicles |
| Maintain timing | Advance the simulation at a known timestep for repeatable bridge sampling |
| Support scenario replay | Let the same curve, lead-vehicle, or oncoming-vehicle case be repeated |

The CAN Bridge is responsible for filtering and converting MetaDrive state into project CAN signals. MetaDrive itself remains simulator-side.

## Outputs

| Output | Consumer | Used for |
|---|---|---|
| Ego steering state/input | CAN Bridge | `0x200 Vehicle_Steering` |
| Ego speed | CAN Bridge | `0x300 Vehicle_Speed` |
| Ego pose or heading, if needed | CAN Bridge | Coordinate conversion and diagnostics |
| Surrounding-vehicle relative position | CAN Bridge | `0x310 Vehicle_Object` source data |
| Surrounding-vehicle presence/type, if available | CAN Bridge | Filtering, diagnostics, and scenario validation |
| Scenario name/state | CAN Bridge or Dashboard | Logs and user observation |

Raw simulator objects, raw lidar arrays, camera frames, lane navigation, and route internals should stay inside the host simulation layer unless a later feature explicitly needs them. For the first build, the useful contract is compact steering, speed, and surrounding-vehicle geometry.

## First Scenarios

The first useful scenarios should prove the two lighting behaviors and the fallback paths.

| Scenario | What it proves |
|---|---|
| Low-beam curve | Steering changes make the low-beam rig swivel visibly |
| Low-beam straight road | Centered behavior stays stable when steering is near zero |
| High-beam lead vehicle | A vehicle ahead is available to the bridge as object input |
| High-beam oncoming vehicle | An opposite-direction vehicle is available to the bridge as changing object input |
| No-object high beam | Valid empty object input keeps high-beam output bright |
| Stale or invalid object input | ECU rejects ADB input and degrades or falls back safely |
| Dashboard off request | User-requested headlight off state reaches the ECU through `0x400 Dashboard_Command` |

Scenario files can be added later under the runtime `simulation/scenarios/` folder. This documentation only defines what those scenarios should demonstrate.

## Runtime Consumers

| Used by | How it uses MetaDrive |
|---|---|
| CAN Bridge | Reads selected ego and surrounding-vehicle state, then converts it into CAN signals |
| Dashboard | May display scenario name or simulator state after the CAN Bridge exposes it |
| Verification work | Replays known cases for low-beam swivel, high-beam ADB, no-object, and stale-input behavior |
| Calibration work | Provides repeatable object geometry for glare threshold and swivel response tuning |

## Boundary

MetaDrive should stay replaceable. If a later simulator or synthetic generator provides the same selected values, the CAN Bridge should still be able to publish the same project CAN frames.

## Related Docs

- [can-bridge.md](can-bridge.md) - bridge consumer of selected MetaDrive state.
- [dashboard.md](dashboard.md) - possible display consumer for scenario metadata.
- [../data-flow.md](../data-flow.md) - end-to-end source data ownership.