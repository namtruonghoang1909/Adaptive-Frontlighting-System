# Simulation Runner

Python application for MetaDrive lifecycle, driving controls, object extraction, and the future IPC adapter to the C++ bridge.

## Source Layout

```text
assets/screenshots/            # captured MetaDrive validation evidence
scripts/                       # MetaDrive checks and launchers
src/
|-- metadrive_runner/          # lifecycle, pacing, controls, CLI, callback
|-- object_extraction/
|   |-- ego/                   # implemented immutable ego snapshots
|   |-- surrounding/           # implemented nearby-object extraction
|   `-- scene.py               # matching ego/surrounding datatype
`-- ipc_adapter/               # planned local IPC client and wire conversion
tests/                         # runner, controls, and extractor tests
```

MetaDrive, extraction, and IPC publishing belong to one Python process. The adapter will select simulator-independent values from complete snapshots and publish them to the separate C++ bridge. It will not open SocketCAN or pack CAN frames.

The runner, controls, ego extractor, surrounding extractor, and snapshot datatypes are implemented. Runner integration for surrounding extraction and IPC publishing remain future work.

## Extraction Datatypes

`EgoSnapshot` stores one ego sample. `SingleObjectSnapshot` stores one eligible nearby object's world and ego-relative measurements. `SurroundingSnapshot` stores a complete immutable scan, including its radius, objects, validity, and collection diagnostics. `SceneSnapshot` can combine matching ego and surrounding snapshots without publishing or storing them.

Use the surrounding extractor directly:

```python
from object_extraction import extract_ego, extract_surrounding

ego = extract_ego(env)
surrounding = extract_surrounding(env, ego, radius_m=100.0)
```

The extractor scans MetaDrive's public object registry in every direction. It does not simulate sensors or occlusion, spawn traffic, convert geometry into CAN sectors, or decide lighting behavior.

## Run MetaDrive

From the repository root on Linux:

```bash
bash simulation_runner/scripts/check_metadrive.sh
bash simulation_runner/scripts/start_metadrive_simulation.sh
```

For a finite headless run:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh \
  --headless --max-steps 100 --print-every 10
```

See [scripts/README.md](scripts/README.md) for launcher details and [src/metadrive_runner/README.md](src/metadrive_runner/README.md) for runner behavior.

## Tests

```bash
PYTHONPATH=simulation_runner/src \
simulation/metadrive/metadrive_venv/bin/python -m pytest simulation_runner/tests -v
```

The tests use fake MetaDrive-like environments and do not require Panda3D. Surrounding tests cover supported types, radius boundaries, ego exclusion, coordinate transforms, missing data, ordering, empty scans, and immutability.
