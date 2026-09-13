# Surrounding Extraction

This package reads MetaDrive ground truth from `env.engine.get_objects()` and returns a complete immutable scan. It does not simulate sensor visibility, occlusion, or traffic, and it contains no CAN or lighting logic.

## Collection

- Default center-to-center radius: `100 m`, configurable per runner invocation.
- Included semantic types: `VEHICLE`, `PEDESTRIAN`, `CYCLIST`, `TRAFFIC_OBJECT`, `TRAFFIC_CONE`, and `TRAFFIC_BARRIER`.
- Excluded: ego, road geometry, buildings, traffic lights, and renderer-only objects.
- Ordering: distance ascending, then object ID.
- Coordinates: ego x forward and y left; relative velocity is `(object world velocity - ego world velocity)` rotated into those axes.

## Models

`SingleObjectSnapshot` stores object ID/type, world position and velocity, heading, available length/width/height, ego-relative position and velocity, relative heading, distance, and bearing. Measurements use meters, seconds, and radians.

`SurroundingSnapshot` stores the complete replacement object tuple, radius, validity/degradation state, scanned and skipped counts, errors, and metadata matching the ego sample. A successful scan with no objects is valid. Missing registry access or unusable ego pose is invalid. Bad required fields skip only the affected eligible object and mark the scan degraded; unavailable optional fields are `None`.

The public API is:

```python
from object_extraction.surrounding import extract_surrounding

snapshot = extract_surrounding(env, ego_snapshot, radius_m=100.0)
```
