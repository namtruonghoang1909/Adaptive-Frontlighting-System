# CAN Bridge Component

The CAN Bridge is the host-side software adapter between MetaDrive, Dashboard, and the CAN bus. It runs in the Linux runtime environment and owns the host-side CAN interface.

The bridge reads MetaDrive data and Dashboard command state, publishes compact CAN inputs for the AFS ECU, receives ECU status, and forwards decoded status to the Dashboard.

## Position In The System

```text
MetaDrive -> CAN Bridge reads -> CAN bus -> AFS ECU
Dashboard -> CAN Bridge reads -> CAN bus -> AFS ECU
AFS ECU   -> CAN bus -> CAN Bridge reads -> Dashboard
```

## Responsibilities

- Read the current Dashboard command state.
- Extract the MetaDrive values needed by this project: ego steering, ego speed, and relevant surrounding-vehicle data.
- Convert host-side values into project CAN signals.
- Encode and transmit `0x200`, `0x300`, `0x310`, and `0x400`.
- Keep CAN listeners ready for expected receive IDs such as `0x100`.
- Validate, decode, timestamp, and store received ECU status.
- Forward decoded ECU status to the Dashboard and logs.

The CAN Bridge does not decide the final lighting behavior and does not command hardware directly. It prepares bus inputs; the AFS ECU executes the lighting behavior.

## Inputs

| Input | Source | Used for |
|---|---|---|
| Requested headlight power, requested mode, and clear-fault request | Dashboard | Build `0x400 Dashboard_Command` |
| Ego steering state/input | MetaDrive | Build `0x200 Vehicle_Steering` |
| Ego speed | MetaDrive | Build `0x300 Vehicle_Speed` |
| Relevant surrounding-vehicle position/presence | MetaDrive object state or detection output | Source data for `0x310 Vehicle_Object` |
| Shared CAN definition | `can/afs.dbc` when created | Encode and decode frames consistently |
| ECU status frame | `0x100 AFS_Status` from CAN | Feed Dashboard and logs |

The bridge reads Dashboard values as local HMI state. The Dashboard does not send the CAN frame itself.

## Processing

| Process step | Meaning |
|---|---|
| Read local source state | Snapshot current MetaDrive data and Dashboard command state |
| Validate source data | Check that values are present, fresh enough, and inside expected ranges |
| Convert units and signs | Map simulator units and coordinate conventions into project signal conventions |
| Build freshness and validity fields | Set valid flags, alive counters, saturation flags, and checksums where defined |
| Prepare object signal payload | Snapshot selected object state for `0x310 Vehicle_Object`; detailed ADB logic is deferred to later implementation docs |
| Encode CAN payloads | Use `cantools` with the shared DBC when the DBC exists |
| Schedule transmit frames | Send `0x200`, `0x300`, `0x310`, and `0x400` at their configured periods |
| Decode received status | Validate and decode `0x100 AFS_Status`, then update local bridge state for the Dashboard |

CAN receive handlers should update local state only. They should not directly execute UI or lighting behavior.

## Local State Caches

| Cache | Filled by | Used for |
|---|---|---|
| `latest_vehicle_steering` | MetaDrive reader | `0x200` transmit |
| `latest_vehicle_speed` | MetaDrive reader | `0x300` transmit |
| `latest_vehicle_objects` | MetaDrive reader or object extractor | `0x310` transmit |
| `latest_dashboard_command` | Dashboard interface | `0x400` transmit |
| `latest_afs_status` | CAN receive/decode path | Dashboard display |

## CAN Message Flow

Transmit path:

```text
source local data
  -> CAN Bridge snapshots source data
  -> CAN Bridge validates and converts values
  -> CAN Bridge encodes CAN frame with ID, DLC, data bytes, alive counter, checksum where defined
  -> CAN Bridge transmits frame on SocketCAN
  -> ECU CAN listener/filter accepts the desired ID
  -> ECU receive_message validates, decodes, timestamps, and stores local state
  -> ECU control loop reads local state and checks freshness before acting
```

Receive path for ECU status:

```text
ECU local status data
  -> ECU encodes 0x100 AFS_Status
  -> ECU transmits frame on CAN
  -> CAN Bridge listener/filter accepts ID 0x100
  -> CAN Bridge receive_message validates, decodes, timestamps, and stores latest_afs_status
  -> Dashboard reads latest_afs_status from the CAN Bridge
```

Rejected frames do not refresh usable local state. Wrong DLC, checksum failure, invalid alive counter, reserved values, or out-of-range signals should leave the previous cache stale or invalid.

## Outputs

To CAN bus:

| CAN ID | Message | Destination | Meaning |
|---:|---|---|---|
| `0x200` | `Vehicle_Steering` | AFS ECU | Steering input for low-beam swivel |
| `0x300` | `Vehicle_Speed` | AFS ECU | Speed input for gating and swivel scaling |
| `0x310` | `Vehicle_Object` | AFS ECU | Surrounding-vehicle input for high-beam ADB behavior |
| `0x400` | `Dashboard_Command` | AFS ECU | User-requested headlight power, mode, command validity, and clear-fault request |

To Dashboard:

| Output | Source | Meaning |
|---|---|---|
| Decoded `0x100 AFS_Status` | AFS ECU over CAN | Executed mode, health, faults, servo feedback, and applied dim mask |
| Optional decoded input frames | CAN Bridge transmit state or CAN logs | Steering, speed, object, and command values for debugging |
| Bridge health | CAN Bridge runtime | Source freshness, CAN interface state, encode/decode errors, and timing diagnostics |

## Tools

| Tool or interface | Role |
|---|---|
| MetaDrive APIs | Read ego steering, ego speed, and surrounding-vehicle data |
| Dashboard command interface | Read user-requested headlight power/mode and clear-fault request |
| DBC/cantools | Keep signal packing, scaling, enums, and validation consistent |
| python-can/SocketCAN | Send and receive CAN frames on `vcan0` or `can0` |
| Object extraction config | Select simulator object inputs, freshness limits, and `0x310` source data; detailed ADB logic belongs in later implementation docs |
| Monotonic clock | Timestamp local caches and detect stale source data |
| Logging | Record transmit/receive frames, rejected frames, and source freshness for debugging |

## Runtime Notes

CAN Bridge code should stay outside `simulation/metadrive/`, because that folder is a local ignored MetaDrive tree. Exact APIs, conversion math, logging, and scenarios are future build details.

## Related Docs

- [metadrive.md](metadrive.md) - simulator data source.
- [dashboard.md](dashboard.md) - command source and decoded-status display.
- [../data-flow.md](../data-flow.md) - end-to-end data ownership.
- [../../can/README.md](../../can/README.md) - CAN bus summary and message specs.