# Verification Overview

## What Needs Confidence

| Area | What to verify |
|---|---|
| Ego extractor | MetaDrive-like state becomes a complete, correctly converted immutable snapshot |
| Surrounding extractor | Eligible registry objects become deterministic world and ego-relative immutable snapshots |
| Runner scene store | Each reset/step atomically replaces one matching ego/surrounding scene without mixed metadata or a backlog |
| Scene display | Normalized typed JSON, current-state replacement, display states, bundled assets, HTTP lifecycle, and clean shutdown |
| Architecture explorer | Source-index freshness, containment integrity, architecture mappings, repository links, JavaScript syntax, and browser interactions |
| Adapter IPC | Selected observations cross the Python/C++ boundary with defined units, validity, and sample identity |
| Gateway state | C++ threads exchange whole snapshots without mixed-step fields or unbounded backlogs |
| CAN interface | Native conversion, scheduling, validation, and DBC-derived encoding/decoding are correct |
| Dashboard IPC | Requests, acceptance results, and ECU status cross the process boundary with explicit freshness |
| Dashboard | Commands reach the bridge and displayed ECU status remains accurate |
| AFS ECU | Missing or invalid inputs lead to conservative behavior |
| Full HIL | Physical output follows simulation state and requested mode |

## Test Levels

| Level | Environment | Purpose |
|---|---|---|
| Unit | Host or firmware test environment | Isolated extractor, snapshot, conversion, and control checks |
| Virtual CAN | Linux `vcan0` | CAN integration without hardware |
| Synthetic adapter input | C++ gateway with a small IPC test client | Known source values without MetaDrive |
| SIL, later | Software ECU and `vcan0` | Exercise portable firmware C control logic without hardware |
| Board bring-up | STM32F407VE bench | Peripheral and electrical checks |
| HIL | Real CAN and headlight rig | End-to-end behavior |
| Demo acceptance | Full setup | Repeatable project demonstration |

Planned gateway integration checks include both startup orders, client disconnects/restarts, malformed messages, source timeout despite continuing CAN TX, slow Dashboard readers, CAN errors, command acceptance versus ECU execution, and clean shutdown. `vcan0` alone tests transport; full SIL needs an ECU implementation, while physical HIL needs `can0` and STM32.

The current tests use fake MetaDrive-like objects and a pure controller model. They cover ego extraction, runner lifecycle behavior, controls, supported surrounding types, radius boundaries, ego exclusion, coordinate and velocity rotation, deterministic ordering, missing and non-finite fields, disappearing objects, valid empty scans, invalid registry/ego pose handling, scene sample matching, snapshot immutability, latest-value replacement, concurrent store access, retention, callback compatibility, invalid-scene counting, scene-display normalization, state classification, provider replacement, error reporting, assets, and port validation. Later evidence should include DBC revisions, CAN logs, Dashboard captures, firmware versions, calibration notes, and observed physical behavior.

The configured MetaDrive environment may not include pytest. In that case, run every dependency-free test function directly:

```bash
PYTHONPATH=simulation_runner/src:simulation_runner \
simulation/metadrive/metadrive_venv/bin/python - <<'PY'
import importlib
import inspect
from pathlib import Path

for path in sorted(Path("simulation_runner/tests").glob("test_*.py")):
    module = importlib.import_module(f"tests.{path.stem}")
    for name, function in inspect.getmembers(module, inspect.isfunction):
        if name.startswith("test_"):
            function()
PY
```

Validate the interactive architecture explorer independently of the simulation runtime:

```bash
python3 tools/system_visualization/build_index.py --check
node tools/system_visualization/validate.mjs
node --check tools/system_visualization/graph-data.js
node --check tools/system_visualization/code-index.js
node --check tools/system_visualization/viewer.js
```

Detailed viewer maintenance and opening instructions live in
[`tools/system_visualization/README.md`](../../tools/system_visualization/README.md).
