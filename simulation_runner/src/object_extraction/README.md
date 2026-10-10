# Object Extraction

`object_extraction` converts simulator-owned state into immutable `EgoSnapshot`, `SurroundingSnapshot`, and `SceneSnapshot` datatypes.

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

`extract_surrounding(env, ego_snapshot, radius_m=100.0)` scans MetaDrive's public object registry after each reset or step. It includes vehicles, pedestrians, cyclists, traffic cones, barriers, and generic traffic objects whose centers fall within the radius. It excludes ego, roads, buildings, lights, and rendering objects.

Each `SingleObjectSnapshot` contains identity and semantic type; world position, velocity, heading, and available dimensions; and ego-relative position, velocity, heading, distance, and bearing. Units are meters, seconds, and radians. Ego coordinates use x forward and y left. Results sort by distance and then object ID.

A valid empty tuple means the scan succeeded and found no eligible objects. Registry or ego-pose failure makes the scan invalid. Eligible objects with unusable identity or position are skipped and make the scan degraded; optional missing or non-finite values remain `None`.

`SceneSnapshot` contains matching ego and surrounding snapshots. It rejects mismatched timestamp, source, seed, episode-step, or simulation-time metadata so consumers cannot mistake data from different simulator states for one scene. The runner constructs and stores one after every reset and step; public read access belongs to `metadrive_runner`.

The development-only `scene_display` is a read-only consumer of that public scene interface. Extraction remains independent from FastAPI, browser rendering, IPC, CAN conversion, and lighting behavior.

See [surrounding/README.md](surrounding/README.md) for the field contract. CAN sector conversion and lighting decisions are downstream responsibilities.
