# Scene Display

`scene_display` is a development-only browser observer for the immutable extraction data produced by the running simulation. It sits beside `metadrive_runner` and reads the public `get_scene_snapshot()` interface. It does not read MetaDrive objects, perform extraction, mutate snapshots, or communicate with the gateway.

## Runtime Shape

```text
MetaDrive main thread
  -> object_extraction builds EgoSnapshot + SurroundingSnapshot
  -> metadrive_runner stores one SceneSnapshot under a lock

scene_display Uvicorn thread
  -> get_scene_snapshot()
  -> normalize typed snapshot fields to JSON
  -> browser polls /api/scene at 10 Hz
```

The server binds to `127.0.0.1:8765` by default. Each request reads the complete latest scene; no sample queue is created. MetaDrive remains on the main thread.

## Browser View

- one ego-centered Canvas view of simulator object ground truth, forward up and left left;
- zoom and meter scale based on the surrounding extraction radius;
- distance rings and configurable browser zoom;
- object footprints or fallback markers, IDs, headings, and relative-velocity arrows;
- ego speed, steering, pose, sample metadata, and extraction diagnostics;
- selectable objects linked between the scene, detail panel, and complete object table;
- live, valid-empty, invalid, degraded, stale, waiting, error, and disconnected states.

The ground-truth panel shows supported traffic objects from the registry, not the road or every static object. The default collection radius is 100 m.

Only typed snapshot fields are serialized. The `/api/scene` response uses schema version 2 and contains ego and surrounding objects without a sensor-scan field. Arbitrary `raw_state` and `step_info` mappings are excluded; the display selects only control mode and target values from step information.

## Optional Dependencies

FastAPI and Uvicorn are imported only when the display is enabled. Install them with:

```bash
simulation/metadrive/metadrive_venv/bin/python -m pip install -e \
  "./simulation_runner[visual]"
```

See [../../runner.md](../../runner.md) for launch commands and options.
