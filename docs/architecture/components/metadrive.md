# MetaDrive Component

MetaDrive is the host-side driving simulator used by the prototype. It creates virtual road scenes, ego vehicle motion, and surrounding vehicles for AFS/ADB demonstrations.

The project treats MetaDrive as a simulation dependency and data source, not as a lighting controller. `simulation_runner/` implements ego and surrounding-object extraction, matching scene snapshots, a process-local latest-scene interface, and an optional development browser observer. Bridge IPC comes later.

## Flow

```text
scenario configuration
  -> MetaDrive reset/step
  -> ego + surrounding extraction
  -> matching immutable SceneSnapshot
  -> lock-protected latest-scene replacement
  -> optional scene_display read and local browser rendering
  -> future IPC adapter
```

The implemented runner takes one timestamp after every reset and step, extracts the ego and complete surrounding registry scan, builds a matching `SceneSnapshot`, and replaces the latest scene under a short lock. Public getters expose the full scene or either component inside the same Python process. `scene_display` uses the complete-scene getter to serve a live development view. The proposed adapter will later project selected simulator-independent data and publish it through a Unix Domain Socket to the separate C++ gateway.

## Responsibilities

- Run repeatable driving scenarios for low-beam AFS and high-beam ADB demonstrations.
- Provide ego steering and speed data to the Python IPC adapter.
- Provide surrounding-vehicle position/presence data to the Python IPC adapter.
- Keep simulator internals replaceable by exposing only the selected project data.
- Support scenario playback and tuning for bench verification.

MetaDrive does not publish CAN, command headlights, or decide whether a beam segment should dim.

## Inputs

| Input | Source | Used for |
|---|---|---|
| Scenario configuration | Project scenario files or scripts | Define road geometry, ego route, traffic objects, and repeatability |
| Runtime control | Developer tool or later Dashboard workflow | Start, stop, reset, pause, or select a scenario |
| Random seed, if used | Scenario config | Make object placement and traffic behavior repeatable |
| Extraction configuration | Simulation-runner configuration | Define which ego and object fields the adapter publishes |
| Simulation timestep | Runtime config | Keep bridge sampling and scenario playback predictable |

The simulation input should be repeatable enough that the same AFS/ADB behavior can be shown again during debugging and demos.

## Processing

MetaDrive processes the driving scene. It should not process headlight control logic.

| Process | Meaning |
|---|---|
| Run road scene | Simulate road geometry, lanes, traffic, and ego vehicle movement |
| Update ego state | Produce steering, speed, heading, and position-like state as available |
| Update surrounding vehicles | Produce relative or world positions for lead and oncoming vehicles |
| Publish current scene | Replace one immutable matching ego and ground-truth surrounding sample without accumulating a history queue |
| Observe extracted data | Optionally serve a local FastAPI/Canvas object view without modifying simulator or snapshot state |
| Support repeatable manual driving | Use a persistent target speed with time-based steering input and automatic steering centering |
| Maintain timing | Advance three `0.02 s` physics ticks per environment step and let the project runner pace each complete `0.06 s` step against wall time |
| Support scenario replay | Let the same curve, lead-vehicle, or oncoming-vehicle case be repeated |

The Python adapter filters simulator observations and normalizes coordinates. The C++ gateway handles CAN-specific conversion and object-grid packing. STM32 owns lighting decisions. MetaDrive, extraction, and the IPC publisher are responsibilities in one Python application process, not three separate processes or assigned CPU cores.

## Outputs

| Output | Consumer | Used for |
|---|---|---|
| Ego steering state/input | Python IPC adapter, then C++ bridge | `0x200 Vehicle_Steering` source |
| Ego speed | Python IPC adapter, then C++ bridge | `0x300 Vehicle_Speed` source |
| Ego pose or heading, if needed | Python adapter | Coordinate conversion and diagnostics |
| Surrounding-vehicle relative position | Python IPC adapter, then C++ bridge | `0x310 Vehicle_Object` source data |
| Surrounding-vehicle presence/type, if available | Python adapter | Filtering, diagnostics, and scenario validation |
| Scenario name/state | Bridge or Dashboard | Logs and user observation |

Raw simulator objects, camera frames, lane navigation, and route internals should stay inside the host simulation layer unless a later feature explicitly needs them. For the first build, the proposed gateway contract remains compact steering, speed, and surrounding-vehicle geometry.

The in-process scene interface is not IPC. It remains readable after runner shutdown, clears at the start of the next valid invocation, and retains only the newest complete scene. Consumers needing a consistent sample use `get_scene_snapshot()` rather than separate component reads.

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

Scenario files can be added later under a dedicated `simulation_runner/scenarios/` folder. This documentation only defines what those scenarios should demonstrate.

## Runtime Consumers

| Used by | How it uses MetaDrive |
|---|---|
| Python adapter | Reads selected ego and surrounding-vehicle state and publishes observations to the gateway |
| C++ gateway | Consumes adapter observations over IPC and converts them into CAN signals |
| Dashboard | Displays exposed simulator state and ECU status through the gateway |
| Verification work | Replays known cases for low-beam swivel, high-beam ADB, no-object, and stale-input behavior |
| Calibration work | Provides repeatable object geometry for glare threshold and swivel response tuning |

## Boundary

MetaDrive should stay replaceable. If a later simulator or synthetic generator provides the same adapter messages, the C++ bridge should still publish the same project CAN frames.

## Related Docs

- [bridge.md](bridge.md) - bridge consumer of selected MetaDrive state.
- [dashboard.md](dashboard.md) - possible display consumer for scenario metadata.
- [../data-flow.md](../data-flow.md) - end-to-end source data ownership.
