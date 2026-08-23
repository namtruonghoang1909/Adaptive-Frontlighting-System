# CAN Messages

This is the current high-level message list for the AFS/ADB prototype. Exact signal layout,
packing, scaling, and enums belong in the DBC once it exists.

| ID | Name | Producer | Purpose |
|---:|---|---|---|
| `0x100` | `AFS_Status` | AFS ECU | Executed mode, health, commanded servo, and LED output summary |
| `0x200` | `Vehicle_Steering` | MetaDrive CAN Bridge | Simulated steering input |
| `0x300` | `Vehicle_Speed` | MetaDrive CAN Bridge | Simulated speed input |
| `0x310` | `Vehicle_Object` | MetaDrive CAN Bridge | Processed relevant vehicle angle/distance for ADB |
| `0x400` | `Dashboard_Command` | Dashboard | User-requested headlight mode |

## Signal Intent

### `Vehicle_Steering` at `0x200`

| Signal | Intent |
|---|---|
| `SteeringAngleDeg` | Steering input converted to degrees |
| `SteeringValid` | Bridge-side validity flag |
| `AliveCounter` | Rolling freshness counter |

### `Vehicle_Speed` at `0x300`

| Signal | Intent |
|---|---|
| `VehicleSpeedKph` | Ego vehicle speed in km/h |
| `SpeedValid` | Bridge-side validity flag |
| `AliveCounter` | Rolling freshness counter |

### `Vehicle_Object` at `0x310`

| Signal | Intent |
|---|---|
| `ObjectValid` | Relevant ADB object present |
| `ObjectAngleDeg` | Horizontal angle relative to ego heading |
| `ObjectDistanceM` | Distance from ego vehicle to relevant object |
| `ObjectType` | Optional leading/oncoming/unknown enum |
| `AliveCounter` | Rolling freshness counter |

### `Dashboard_Command` at `0x400`

| Signal | Intent |
|---|---|
| `RequestedMode` | Low Beam Static, Low Beam AFS, High Beam, High Beam ADB, or safe/default request |
| `AliveCounter` | Rolling freshness counter |

### `AFS_Status` at `0x100`

| Signal | Intent |
|---|---|
| `ExecutedMode` | Mode actually executed by the STM32F407VE |
| `FaultFlags` | Stale input, servo feedback mismatch, driver fault, or safe fallback |
| `LeftServoCmdDeg` | Left commanded swivel angle summary |
| `RightServoCmdDeg` | Right commanded swivel angle summary |
| `LeftServoFeedbackDeg` | Left measured swivel angle summary |
| `RightServoFeedbackDeg` | Right measured swivel angle summary |
| `DimmedZoneMask` | Bitmask summary of LED zones dimmed for ADB |

## Message Intent

- `Vehicle_Steering` and `Vehicle_Speed` support low-beam AFS swivel.
- `Vehicle_Object` supports high-beam ADB shadow-zone selection.
- Raw lidar arrays should not be placed on this CAN bus; use processed object signals.
- `AFS_Status` should report freshness/fault state, executed mode, servo command/feedback
  summary, and LED-zone output summary once the DBC is created.