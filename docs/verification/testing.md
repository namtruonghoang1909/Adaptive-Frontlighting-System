# Verification Overview

## What Needs Confidence

| Area | What to verify |
|---|---|
| Ego extractor | MetaDrive-like state becomes a complete, correctly converted immutable snapshot |
| Surrounding extractor | Eligible registry objects become deterministic world and ego-relative immutable snapshots |
| Runner scene store | Each reset/step atomically replaces one matching ego/surrounding scene without mixed metadata or a backlog |
| Scene display | Normalized typed JSON, current-state replacement, display states, bundled assets, HTTP lifecycle, and clean shutdown |
| Architecture explorer | Source-index freshness, containment integrity, architecture mappings, repository links, JavaScript syntax, and browser interactions |
| Adapter IPC | Scene projection, packet limits and validity, Python-to-C++ delivery, source identity, reconnects, and full-scene replacement |
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
| Process IPC | Python runner publisher and C++ bridge executable with synthetic snapshots | Exercise the real Unix socket clients, startup retry, packet projection, and bridge restart without MetaDrive |
| Live runner IPC | Headless MetaDrive runner and C++ bridge processes | Confirm actual extracted scenes cross the IPC boundary without CAN hardware |
| Live CAN frame smoke | Headless MetaDrive runner and diagnostic C++ frame logger | Check encoded IDs, DLCs, payloads, and decoded signals with the generated C codec and independently with cantools against the DBC; no CAN interface is opened |
| SIL, later | Software ECU and `vcan0` | Exercise portable firmware C control logic without hardware |
| Board bring-up | STM32F407VE bench | Peripheral and electrical checks |
| HIL | Real CAN and headlight rig | End-to-end behavior |
| Demo acceptance | Full setup | Repeatable project demonstration |

The current IPC tests cover the C++ receiver protocol, Python publisher projection, publisher-first retry, and publisher reconnection after bridge restart. The optional live smoke test runs a finite headless MetaDrive session through both processes. Dashboard status mapping checks that requested mode and ECU-reported execution remain separate. Additional stress coverage can exercise stale-input policy while CAN TX continues, slow Dashboard readers, CAN I/O faults, and clean shutdown. `vcan0` alone tests CAN transport; full SIL needs an ECU implementation, while physical HIL needs `can0` and STM32.

The optional CAN frame smoke check runs the standalone validation and DBC
encoders at the bridge's 20 ms diagnostic cadence. Each batch is round-tripped
with the generated C unpackers; captured frames are also decoded with cantools
and compared with the signal values supplied to the frame encoder. Run it with
`bash bridge/scripts/run_can_frame_smoke.sh` after making cantools importable in
the configured MetaDrive Python environment. It does not exercise SocketCAN.

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
python3 tools/system_visualization/code-graph/build_index.py --check
node tools/system_visualization/code-graph/validate.mjs
node --check tools/system_visualization/code-graph/graph-data.js
node --check tools/system_visualization/code-graph/code-index.js
node --check tools/system_visualization/code-graph/viewer.js
```

Detailed viewer maintenance and opening instructions live in
[`tools/system_visualization/README.md`](../../tools/system_visualization/README.md).
