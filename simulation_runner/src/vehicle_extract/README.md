# Vehicle Extraction

`vehicle_extract` converts simulator-owned vehicle objects into immutable, project-owned snapshots. The current milestone implements only the single-agent ego vehicle.

## Ego Snapshot

`extract_ego(env, step_info=None)` reads `env.agent` after `env.reset(...)` or `env.step(...)` and returns an `EgoSnapshot`.

### Sample Metadata

| Attribute | Type | Meaning |
|---|---|---|
| `valid` | `bool` | `False` when no single-agent ego vehicle can be found. |
| `timestamp_monotonic_s` | `float` | Host monotonic timestamp taken during extraction. |
| `kinematics` | `EgoKinematicsSnapshot` | Speed, position, velocity, and heading values listed below. |
| `action` | `EgoActionSnapshot` | Steering and throttle/brake values listed below. |
| `diagnostics` | `EgoDiagnosticsSnapshot` | Lane, route, and collision values listed below. |
| `source` | `str` | Snapshot source; currently `metadrive`. |
| `seed` | optional `int` | Current MetaDrive scenario seed. |
| `episode_step` | optional `int` | Current step number within the episode. |
| `sim_time_s` | optional `float` | Simulated episode time computed from step size and decision repeat. |
| `errors` | `tuple[str, ...]` | Non-fatal extraction problems. |
| `step_info` | mapping | Frozen copy of the latest `env.step(...)` info. |
| `raw_state` | mapping | Frozen copy of `ego.get_state()` for debugging and later field selection. |

### Kinematics

| Attribute | Type | Meaning |
|---|---|---|
| `speed_mps` | optional `float` | Ego speed in meters per second. |
| `speed_kph` | optional `float` | Ego speed in kilometers per hour. |
| `position_m` | optional float tuple | Ego world position in meters. |
| `velocity_mps` | optional float tuple | Ego world velocity vector in meters per second. |
| `heading_rad` | optional `float` | Ego heading in radians. |

### Applied Controls

| Attribute | Type | Meaning |
|---|---|---|
| `steering_normalized` | optional `float` | MetaDrive normalized steering value. |
| `steering_deg` | optional `float` | Steering angle computed from normalized steering and maximum steering angle. |
| `max_steering_deg` | optional `float` | Vehicle maximum steering angle in degrees. |
| `throttle_brake` | optional `float` | Combined MetaDrive throttle/brake value. |
| `latest_applied_action` | optional float tuple | Latest complete action vector applied by MetaDrive. |

### Diagnostics

| Attribute | Type | Meaning |
|---|---|---|
| `on_lane` | optional `bool` | Whether the ego vehicle is on a lane. |
| `lane_index` | JSON-like value | Current MetaDrive lane identifier. |
| `crash_vehicle` | optional `bool` | Collision with another vehicle. |
| `crash_object` | optional `bool` | Collision with an object. |
| `crash_building` | optional `bool` | Collision with a building. |
| `crash_sidewalk` | optional `bool` | Collision with a sidewalk. |
| `out_of_route` | optional `bool` | Whether the ego vehicle left its route. |

Unavailable simulator values are represented by `None`. Snapshots are frozen dataclasses and can be converted to plain dictionaries with `snapshot.to_dict()`.

## Surrounding Objects

Surrounding-object attributes and extraction will be added in a later milestone. The current `vehicle_extract/surrounding/` directory is only a placeholder; no surrounding-object datatype or extraction API is defined yet.
