# Verification Overview

## What Needs Confidence

| Area | What to verify |
|---|---|
| Ego extractor | MetaDrive-like state becomes a complete, correctly converted immutable snapshot |
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

The current tests use fake MetaDrive-like objects and a pure controller model. They cover ego extraction, runner lifecycle behavior, runtime decision-repeat configuration, monotonic real-time deadlines, disabling MetaDrive's competing per-tick FPS limiter, latched speed targets, automatic steering centering, time-based sensitivity, PI response, and emergency stop. Later evidence should include DBC revisions, CAN logs, Dashboard captures, firmware versions, calibration notes, and observed physical behavior.
