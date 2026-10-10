# Simulation Runner

This Python application owns MetaDrive lifecycle, driving controls, ego and surrounding-object extraction, and the latest in-process scene snapshot. Future IPC publishing will connect this process to the separate C++ gateway.

## Current Implementation

```text
src/
|-- metadrive_runner/          # lifecycle, controls, CLI, pacing, scene storage
|-- object_extraction/
|   |-- ego/                   # EgoSnapshot extraction
|   |-- surrounding/           # SingleObjectSnapshot and complete scans
|   `-- scene.py               # matching ego + surrounding samples
|-- scene_display/             # optional live browser observer
`-- ipc_adapter/               # future cross-process publishing boundary
tests/                         # dependency-free unit tests with MetaDrive-like fakes
scripts/                       # runtime checker and launcher
```

After every reset and step, the runner:

1. takes one monotonic timestamp;
2. extracts `EgoSnapshot` and `SurroundingSnapshot` for that simulator state;
3. constructs `SceneSnapshot`;
4. atomically replaces the latest scene under a short lock;
5. invokes the existing ego-only `on_snapshot` callback.

The final scene remains readable after the runner closes. A later valid runner invocation clears the old scene before it creates the environment. Consumers that need a consistent ego and surrounding sample should call `get_scene_snapshot()` rather than making separate component reads.

```python
from metadrive_runner import (
    get_ego_snapshot,
    get_scene_snapshot,
    get_surrounding_snapshot,
)

scene = get_scene_snapshot()
```

The public getters return immutable snapshot objects or `None` before the first publication. The store is process-local and keeps only the newest complete scene, so a slow reader cannot create a sample backlog.

The optional development `scene_display` calls `get_scene_snapshot()`, converts only typed fields to normalized JSON, and serves a bundled Canvas UI from a background thread. It remains a read-only consumer of extraction data.

## Run The Simulation

Check headless readiness and run a finite smoke test:

```bash
bash simulation_runner/scripts/check_simulation_requirements.sh --headless
bash simulation_runner/scripts/start_metadrive_simulation.sh \
  --headless --max-steps 100 --print-every 10
```

Start a rendered interactive run with the browser scene display:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh --scene-display
```

See [runner.md](runner.md) for requirements, scripts, runner arguments, and run examples. See [src/metadrive_runner/README.md](src/metadrive_runner/README.md) for implementation details, [src/object_extraction/README.md](src/object_extraction/README.md) for datatype contracts, and [src/scene_display/README.md](src/scene_display/README.md) for the observer boundary.

## Ownership Boundary

Python extracts simulator ground truth and normalizes coordinates. It does not pack CAN frames or decide lighting behavior. Those responsibilities belong to the C++ gateway and STM32 ECU respectively. `simulation/metadrive/` is an ignored local upstream dependency and must not be modified by project changes.

## Tests

When pytest is installed:

```bash
PYTHONPATH=simulation_runner/src \
simulation/metadrive/metadrive_venv/bin/python -m pytest simulation_runner/tests -v
```

The configured environment may not contain pytest. The dependency-free fallback is documented in [docs/verification/testing.md](../docs/verification/testing.md).
