# Verification Overview

## Run Tests After A Change

From the repository root, use the component entrypoint listed in the
[test script guide](../../tests/scripts/test_guide.md). Root `scripts/` has one
test runner, `bash scripts/test_all.sh`, which runs all standard software suites.
A failing command exits nonzero. The shared runner
uses the configured MetaDrive Python
environment, with a direct runner-test fallback when pytest is unavailable.
The optional `bash tests/scripts/test_components.sh bridge-vcan` checks SocketCAN on an
already configured `vcan0` interface.

Every project test case is stored under the root [`tests/`](../../tests/)
directory. For example, run `bash tests/scripts/test_runner.sh ego_extraction`,
`bash tests/scripts/test_bridge.sh can socketcan`, or
`bash tests/scripts/test_firmware.sh can_service` for focused module checks.

The combined command expects Python 3, CMake, a host C/C++ compiler, Node.js,
`rg`, the local MetaDrive environment, cantools 45.0.0, and the Zephyr
workspace/SDK described in the [firmware guide](../../firmware/README.md).
Install cantools with the command in [`tests/README.md`](../../tests/README.md).
Set `METADRIVE_PYTHON` if the runner interpreter is elsewhere and
`CANTOOLS_PYTHON` if cantools uses a different Python. Bridge IPC tests must be
allowed to bind local Unix sockets.

| Component | Regression gate |
|---|---|
| Runner | Extraction, controls, scene snapshots, display payload, lifecycle, and IPC projection tests |
| Bridge | CMake build and CTest for IPC, CAN signals/frames, status decoding, and Python-to-C++ delivery, plus the headless runner-to-DBC frame smoke |
| Dashboard | Headless unittest cases for commands, power/mode gating, bridge results, and ECU status presentation |
| ECU | Host tests of the real CAN service, RTE, controller, and DBC codec; Zephyr `black_f407ve` build |
| Visualization | Node model tests plus Code graph inventory and mapping checks |
| Launchers | Help, argument validation, and per-component startup entrypoints without opening windows or using hardware |
| Test runner | Central test-tree layout and component/module selector regression checks |

These are repeatable software regression gates. Changes to physical CAN,
ST-Link/RTT, servo, matrix, or board wiring also need on-target checks when the
rig is connected. A host test can verify a frame's bytes and fallback policy;
the board test confirms that those bytes travel through the actual pins and
transceiver.

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
| ECU host logic | Host C compiler | Exercise the real CAN decoder, RTE, fallback controller, and status encoder without hardware |
| SIL, later | Software ECU and `vcan0` | Exercise a complete simulated ECU process over virtual CAN |
| Board bring-up | STM32F407VET6 / STM32F4VE board | LED blink flashed and confirmed; verify candidate peripherals against the [wiring draft](../hardware/wiring-draft.md) |
| HIL | Real CAN and headlight rig | End-to-end behavior |
| Demo acceptance | Full setup | Repeatable project demonstration |

The current IPC tests cover the C++ receiver protocol, Python publisher projection, publisher-first retry, and publisher reconnection after bridge restart. The optional live smoke test runs a finite headless MetaDrive session through both processes. Dashboard tests cover command gating and status mapping, including keeping requested mode and ECU-reported execution separate. ECU host tests cover counter, command, validation, freshness, fallback, and status behavior. Additional stress coverage can exercise stale-input policy while CAN TX continues, slow Dashboard readers, CAN I/O faults, and clean shutdown. `vcan0` tests CAN transport; full SIL needs a simulated ECU process, while physical HIL needs `can0` and STM32.

The optional CAN frame smoke check runs the standalone validation and DBC
encoders at the bridge's 20 ms diagnostic cadence. Each batch is round-tripped
with the generated C unpackers; captured frames are also decoded with cantools
and compared with the signal values supplied to the frame encoder. Run it with
`bash tests/can/bridge/frame_smoke/run_can_frame_smoke.sh` after making cantools importable in
the configured MetaDrive Python environment. It does not exercise SocketCAN.

The current tests use fake MetaDrive-like objects and a pure controller model. They cover ego extraction, runner lifecycle behavior, controls, supported surrounding types, radius boundaries, ego exclusion, coordinate and velocity rotation, deterministic ordering, missing and non-finite fields, disappearing objects, valid empty scans, invalid registry/ego pose handling, scene sample matching, snapshot immutability, latest-value replacement, concurrent store access, retention, callback compatibility, invalid-scene counting, scene-display normalization, state classification, provider replacement, error reporting, assets, and port validation. Later evidence should include DBC revisions, CAN logs, Dashboard captures, firmware versions, calibration notes, and observed physical behavior.

The configured MetaDrive environment may not include pytest. The component
runner then executes each dependency-free test function recursively from
`tests/runner`; use the same command:

```bash
bash tests/scripts/test_runner.sh
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
