# Simulation Runner

Python application for MetaDrive lifecycle, driving controls, vehicle extraction, and the future IPC adapter to the C++ bridge.

## Source Layout

```text
assets/screenshots/            # captured MetaDrive validation evidence
scripts/                       # MetaDrive checks and launchers
src/
|-- metadrive_runner/          # lifecycle, pacing, controls, CLI, callback
|-- vehicle_extract/
|   |-- ego/                   # implemented immutable ego snapshots
|   `-- surrounding/           # planned surrounding-object extraction
`-- ipc_adapter/               # planned local IPC client and wire conversion
tests/                         # runner, controls, and extractor tests
```

MetaDrive, extraction, and IPC publishing belong to one Python process. The adapter will select simulator-independent values from complete snapshots and publish them to the separate C++ bridge. It will not open SocketCAN or pack CAN frames.

The runner, controls, and ego extractor are implemented. Surrounding extraction and IPC publishing remain placeholders.

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

The tests use fake MetaDrive-like environments and do not require Panda3D.
