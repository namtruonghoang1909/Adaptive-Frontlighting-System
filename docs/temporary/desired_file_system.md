# Desired Finished Project File System

This is the current target layout for the AFS/ADB prototype. It is still a planning document,
but it now records the intended responsibility of each folder so future build work lands in
the right place.

```text
Adaptive-Frontlighting-System/
|-- .gitignore
|-- README.md
|-- pyproject.toml                 # host tools dependencies when Python build begins
|-- can/
|   |-- README.md                  # CAN contract notes and generation commands
|   |-- afs.dbc                    # shared CAN signal contract
|   `-- examples/                  # sample decoded/encoded frames if useful
|-- dashboard/
|   |-- README.md                  # Dashboard role, run commands, UI notes
|   |-- src/                       # Dashboard application source
|   `-- tests/                     # Dashboard decode/display tests
|-- docs/
|   |-- README.md
|   |-- agents/
|   |-- architecture/
|   |   |-- overview.md
|   |   |-- data-pipeline.md
|   |   |-- workflow.md
|   |   |-- control-law.md
|   |   `-- components/
|   |-- can/
|   |-- hardware/
|   |   |-- hardware.md
|   |   `-- visual.md
|   |-- simulation/
|   |-- temporary/
|   |-- tools/
|   `-- verification/
|-- firmware/
|   |-- README.md                  # firmware workspace notes and target board
|   |-- afs_ecu/                   # STM32F407VE AFS/ADB ECU firmware
|   |   |-- Core/                  # STM32Cube-generated application code, if Cube is used
|   |   |-- Drivers/               # STM32 HAL/CMSIS drivers, if Cube is used
|   |   |-- afs/                   # application modules owned by this project
|   |   |   |-- can/                # CAN RX/TX, DBC-facing signal mapping
|   |   |   |-- control/            # mode logic, AFS swivel, ADB zone selection
|   |   |   |-- diagnostics/        # stale input, feedback mismatch, fault flags
|   |   |   |-- hardware/           # PCA9685, LED driver, ADC feedback, board pins
|   |   |   `-- calibration/        # servo and LED-zone calibration values
|   |   `-- tests/                 # host-buildable firmware logic tests if added
|   `-- tools/                     # firmware flashing/debug helper scripts if needed
|-- hardware/
|   |-- README.md                  # physical bench build overview
|   |-- visual.md                  # physical layout and wiring diagrams
|   |-- bom.md                     # selected parts and alternatives
|   |-- wiring.md                  # CAN, power, I2C, servo feedback, LED wiring
|   |-- calibration.md             # servo angle, feedback ADC, LED zone mapping
|   |-- mechanical/                # mounts, brackets, CAD/STL/DXF files
|   `-- datasheets/                # local datasheet copies or links, if kept
|-- simulation/
|   |-- README.md                  # simulation setup and scenario notes
|   |-- metadrive/                 # ignored upstream/local MetaDrive tree
|   |-- scenarios/                 # repeatable AFS/ADB demo scenarios
|   |   |-- low_beam_afs_curve.yaml
|   |   |-- high_beam_adb_lead_vehicle.yaml
|   |   `-- high_beam_adb_oncoming.yaml
|   `-- extraction_notes.md        # MetaDrive fields used by the bridge
|-- tools/
|   |-- README.md                  # host tools overview
|   |-- metadrive_can_bridge/      # MetaDrive CAN Bridge: MetaDrive -> cantools -> python-can
|   |   |-- README.md
|   |   |-- bridge.py              # main MetaDrive CAN Bridge entry point when implemented
|   |   |-- extractors.py          # MetaDrive ego/object extraction
|   |   |-- can_tx.py              # cantools encoding and python-can transmit
|   |   |-- config.yaml            # CAN interface, rates, field-of-view, thresholds
|   |   `-- tests/                 # MetaDrive CAN Bridge unit tests with synthetic observations
|   |-- can_utils/                 # candump/cansend helpers, log decoders
|   `-- calibration/               # host-side calibration helpers
|-- tests/
|   |-- README.md                  # test strategy and commands
|   |-- dbc/                       # DBC encode/decode tests
|   |-- can_bridge/                # MetaDrive CAN Bridge tests
|   |-- firmware_logic/            # host-side control-law tests
|   `-- hil/                       # hardware-in-loop test notes/scripts
|-- logs/
|   |-- README.md                  # what logs are worth keeping
|   |-- can/                       # candump/SavvyCAN logs, usually ignored
|   |-- can_bridge/                # MetaDrive CAN Bridge runtime logs, usually ignored
|   `-- dashboard/                 # Dashboard logs/screenshots, usually ignored
`-- artifacts/
    |-- README.md                  # demo evidence index when needed
    |-- calibration/               # final calibration captures
    |-- demo/                      # final demo videos/screenshots/logs
    `-- reports/                   # generated reports if added
```

## Folder Responsibilities

| Folder | Responsibility |
|---|---|
| `can/` | Own the DBC. The MetaDrive CAN Bridge, Dashboard, firmware, tests, and logs must agree with it. |
| `dashboard/` | Host UI for requested mode, decoded input signals, ECU status, and demo visibility. |
| `docs/` | Orientation and architecture notes. Keep detailed implementation in source folders once build starts. |
| `firmware/afs_ecu/` | STM32F407VE firmware for CAN receive/transmit, control logic, drivers, feedback checks, and faults. |
| `hardware/` | Physical rig information: visual layout, BOM, wiring, power, mechanical files, calibration notes, and datasheets. |
| `simulation/` | MetaDrive setup and repeatable scenarios. The upstream `simulation/metadrive/` tree stays ignored. |
| `tools/metadrive_can_bridge/` | MetaDrive CAN Bridge that converts MetaDrive output into DBC-encoded CAN frames. |
| `tools/can_utils/` | Developer utilities for CAN logging, frame injection, and decode checks. |
| `tools/calibration/` | Host-side helpers for servo feedback and LED zone calibration. |
| `tests/` | Automated and semi-automated checks for DBC, bridge, firmware logic, and HIL behavior. |
| `logs/` | Runtime logs for debugging. Usually ignored unless a specific log is kept as evidence. |
| `artifacts/` | Curated demo evidence, calibration captures, and generated reports worth preserving. |

## Data Ownership

| Data | Owner |
|---|---|
| Raw MetaDrive state/observations | `simulation/` and MetaDrive CAN Bridge extraction code |
| CAN signal names, scaling, enums, and packing | `can/afs.dbc` |
| MetaDrive CAN Bridge filtering thresholds | `tools/metadrive_can_bridge/config.yaml` |
| Final lighting decision | `firmware/afs_ecu/afs/control/` |
| Servo feedback and LED-zone calibration | `firmware/afs_ecu/afs/calibration/` plus `hardware/calibration.md` |
| Dashboard display mapping | `dashboard/` |

## Notes

- `can/afs.dbc` is the shared CAN contract when created.
- `simulation/metadrive/` is a heavy local simulator tree and should remain ignored.
- Runtime-generated logs and artifacts should stay out of normal source control unless the
  project intentionally keeps a specific evidence file.
- The desired source tree can be created incrementally. Do not scaffold every folder until the
  related implementation work starts.