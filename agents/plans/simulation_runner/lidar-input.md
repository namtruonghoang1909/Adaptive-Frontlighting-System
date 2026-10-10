# MetaDrive LiDAR Input Investigation

## Status

The local ignored MetaDrive checkout is version `0.4.3`. Its LiDAR outputs were inspected
through the source and live headless probes. This investigation is historical:
the project subsequently removed cached LiDAR extraction and the browser comparison.
The current `SceneSnapshot` contains ego and simulator-ground-truth surrounding objects.

## Access And Datatypes

After `env.reset()` and each `env.step()`, the default single-agent observation has
already run the LiDAR sensor. For the current runner configuration, read the cached
result through `env.observations["default_agent"]` on the simulation thread:

```python
observation = env.observations["default_agent"]
fractions = observation.cloud_points
candidates = observation.detected_objects
```

| Value | Observed type | Meaning |
|---|---|---|
| Observation object | `LidarStateObservation` | Holds the latest sample after reset or step. |
| `cloud_points` | `list[float]`, one per laser, or `None` when disabled | Raw normalized ray ranges. Multiply a hit fraction by configured `distance` to obtain meters. `1.0` means no hit before the range limit; a hit exactly at that limit is indistinguishable. These are radial measurements, not XYZ points. |
| `detected_objects` | `set` of MetaDrive objects, or `None` when disabled | Broad-phase nearby candidates used to limit ray tests. Membership does not prove a ray hit. |
| Observation component returned by `env.reset()` or `env.step()` | `numpy.ndarray` with `float32` elements | Combined ego/navigation, optional high-level other-vehicle fields, and LiDAR ray values. Under current defaults it has shape `(259,)`; the last 240 values are the rays when noise and dropout are zero. |
| `env.engine.get_sensor("lidar")` | `Lidar` | Sensor instance. Its `perceive(...)` method returns a `tuple[list[float], set]` and performs another scan. |

The sensor uses a full circle with `num_lasers` equally spaced rays; ray zero starts at
the ego heading. A controlled left/right scene should verify the angle sign before a
project coordinate conversion is implemented. The cached `cloud_points` are assigned
before MetaDrive applies configured noise or dropout to the returned observation vector.

The local upstream implementation is in
`simulation/metadrive/metadrive/obs/state_obs.py`,
`simulation/metadrive/metadrive/component/sensors/lidar.py`, and
`simulation/metadrive/metadrive/component/sensors/distance_detector.py`.

## Configuration

The merged vehicle configuration has these defaults in MetaDrive `0.4.3`. Among
LiDAR-related fields, the project currently overrides only `show_lidar` to `True`; it does not set the
LiDAR range or ray count.

| `vehicle_config` field | Default | Effect |
|---|---:|---|
| `lidar.num_lasers` | `240` | Number of rays; zero disables the scan. At 240, angular spacing is 1.5 degrees. |
| `lidar.distance` | `50` | Maximum ray range in meters; zero disables the scan. |
| `lidar.num_others` | `0` | Number of nearby vehicles represented by extra simulator-state features in the combined observation vector. |
| `lidar.gaussian_noise` | `0.0` | Noise applied to normalized ray values in the combined observation vector. |
| `lidar.dropout_prob` | `0.0` | Probability of replacing a vector ray value with zero. |
| `lidar.add_others_navi` | `False` | Adds four navigation features per included nearby vehicle, in addition to its four position/velocity features. |
| `show_lidar` | `False` upstream; `True` in project config | Draws scan lines when rendering is available. It does not enable or disable sensing. |

The direct `perceive(...)` call also accepts `physics_world`, `height`,
`detector_mask`, and `show`. The default LiDAR ray height is `1.2 m`.
`set_start_phase_offset(angle)` can rotate the ray pattern; its default is zero.

## Headless Probe Results

The probes used seed `10`, map `3`, traffic density `0.6`, and `show_lidar=False` so
nearby traffic would be present without drawing. These are observations from one
scene, not detection-performance measurements.

| Configuration | Combined vector | Cached rays | Hit rays | Nearby candidates |
|---|---:|---:|---:|---:|
| Defaults: 240 rays, 50 m, zero other-vehicle slots | `float32 (259,)` | 240 | 4, at about 42.7–43.1 m | 4 |
| 36 rays, 80 m, two other-vehicle slots and navigation | `float32 (71,)` | 36 | 1 | 11 |
| Disabled: zero rays and zero range | `float32 (19,)` | `None` | — | `None` |

A separate custom run with `gaussian_noise=0.1` and `dropout_prob=0.2` confirmed that
the returned vector's ray tail differs from the cached raw `cloud_points`. The direct
`perceive(...)` result matched the cached raw rays when called at the same state.
The sparse scan's 11 candidates and one hit ray demonstrate why `detected_objects`
must not be treated as a list of sensed objects.

## Former Comparison

An earlier browser scene display compared registry objects with cached planar
LiDAR rays. That comparison and its dedicated launcher were removed. The display
now shows only registry-derived ego and surrounding objects.

## Next Implementation Step

The ground-truth extractor uses a 100 m default radius. The project currently
uses registry objects for surrounding extraction; no sensor-derived object list,
IPC message, CAN conversion, or lighting decision exists. A future sensor-based
path would need controlled bearing and occlusion tests plus an explicit detection
and range policy.
