# Dashboard Component

The Dashboard is the user-facing HMI for the prototype. It runs in Linux and acts like a simple control and observation screen for headlight mode selection, CAN-derived status, and ECU feedback.

The Dashboard is not the CAN owner. It provides command state to the CAN Bridge and receives decoded status from the CAN Bridge.

## Responsibilities

- Let the user turn the headlights on or off and request a headlight mode.
- Provide requested power, requested mode, and clear-fault action to the CAN Bridge.
- Show requested state, executed state, and CAN freshness.
- Show key simulator-derived inputs after the CAN Bridge exposes them.
- Show ECU feedback, faults, and applied lighting output.

The Dashboard does not execute lighting behavior. It asks for a mode; the AFS ECU decides what is actually safe and reports the executed state back through `0x100 AFS_Status`.

## Inputs

| Input | Source | Used for |
|---|---|---|
| Requested headlight power | User UI control | Choose whether headlights should be off or on |
| Requested headlight mode | User UI control | Choose low-beam static, low-beam swivel, high-beam, or high-beam dimming when power is on |
| Clear-fault action | User UI control | Request a momentary safe fault clear |
| Decoded `0x100 AFS_Status` | CAN Bridge | Display executed mode, freshness, faults, feedback, and applied dim mask |
| Optional decoded `0x200 Vehicle_Steering` | CAN Bridge or logs | Display current steering input for debugging |
| Optional decoded `0x300 Vehicle_Speed` | CAN Bridge or logs | Display current speed input for debugging |
| Optional decoded `0x310 Vehicle_Object` | CAN Bridge or logs | Display object input state for debugging |
| Scenario metadata, if provided | MetaDrive or CAN Bridge | Show active scenario name or test condition |

The Dashboard should not read raw SocketCAN traffic directly in the first design. CAN details belong in the CAN Bridge.

## Processing

Command state:

| Step | Meaning |
|---|---|
| Read UI controls | Read requested headlight power, requested mode, and clear-fault button state |
| Normalize command values | Convert UI labels into project enum values expected by the CAN Bridge |
| Handle momentary actions | Treat clear-fault as a pulse or edge, not a latched continuous command |
| Publish command state locally | Make the latest command state available for the CAN Bridge to read |

Display state:

| Step | Meaning |
|---|---|
| Receive decoded status | Accept decoded `0x100 AFS_Status` values from the CAN Bridge |
| Update local display model | Store latest executed mode, freshness, faults, servo feedback, and applied dim mask |
| Render user observation | Show the current ECU state and explain visible fallback or dimming behavior |

The Dashboard does not add alive counters, checksums, DLC, or CAN IDs. The CAN Bridge owns those CAN-frame details.

## Outputs

To CAN Bridge:

| Output | Destination | CAN result |
|---|---|---|
| Requested headlight power | CAN Bridge | Encoded into `RequestedHeadlightPower` in `0x400 Dashboard_Command` |
| Requested headlight mode | CAN Bridge | Encoded into `RequestedHeadlightMode` in `0x400 Dashboard_Command` |
| Clear-fault request | CAN Bridge | Encoded into `ClearFaultRequest` in `0x400 Dashboard_Command` |

The Dashboard output is local host-side state. The CAN Bridge reads it and sends the actual CAN frame.

To user:

| Display output | Meaning |
|---|---|
| Requested vs executed state | Shows whether the ECU accepted the request or changed behavior |
| CAN freshness and health | Shows stale inputs, decode faults, and heartbeat state |
| Steering and speed | Shows low-beam swivel inputs when available |
| Object input and applied mask | Shows decoded object input and beam columns dimmed or suppressed by the ECU |
| Servo feedback | Shows measured left/right headlight swivel position |
| Fault and fallback state | Shows why the ECU degraded, rejected a mode, or forced safe fallback |

Display updates should tolerate stale data. If the CAN Bridge reports stale or missing status, the Dashboard should show that as an observation issue instead of inventing an ECU state.

## Expected Modes

| Mode | Purpose |
|---|---|
| `Off` | User-requested headlights off or standby |
| `LowBeam_NoSwivel` | Centered static low-beam output |
| `LowBeam_Swivel` | Steering/speed-linked horizontal swivel |
| `HighBeam_NoDimming` | Full high-beam LED zones without adaptive dimming |
| `HighBeam_Dimming` | High beam with vehicle-aware beam-zone dimming |
| `Safe_Default` | ECU fallback/default display state, not a normal user request |

## Design

The Dashboard UI should be organized around two tabs so command entry and system observation stay separate.

| Tab | Purpose | Main content |
|---|---|---|
| User Commands | Receive operator intent and publish local command state for the CAN Bridge | Headlight power toggle, requested mode segmented control, clear-fault momentary action, command validity/freshness, and latest command preview |
| AFS Status | Observe decoded ECU and bridge state | Requested vs executed mode, CAN freshness, fault state, servo feedback, object input summary, applied dim mask, and bridge health |

The command tab should be compact and deliberate: controls should map directly to fields in `0x400 Dashboard_Command`, with clear disabled/stale states when the CAN Bridge is unavailable. The clear-fault control should be momentary and visually distinct from persistent mode controls.

The status tab should favor fast scanning over dense logs. Put current executed mode, health, and faults first; keep servo feedback, object input, applied mask, and timing/debug details in grouped status areas below that primary state.

## Tools

| Tool or interface | Role |
|---|---|
| Python | Main implementation language for the first Dashboard prototype |
| Python UI library | Render the two-tab HMI; candidate libraries include Streamlit, NiceGUI, PySide, or PyQt depending on whether the prototype is browser-based or desktop-based |
| CAN Bridge command API | Publish requested power, requested mode, and clear-fault command state to the bridge |
| CAN Bridge status API | Receive decoded `0x100 AFS_Status`, bridge health, and optional decoded input-frame values |
| Shared DBC/enums | Keep displayed modes, signal names, and fault labels aligned with CAN definitions |
| Plotting/table widgets | Show servo feedback, object input values, dim masks, timing, and debug traces |
| Scenario metadata API, if available | Show active simulation case, run state, and repeatability metadata |
| Logging/debug tools | Capture UI actions, bridge connection state, stale status, and decode/display issues |

## Runtime Boundary

The Dashboard should run in the Linux SSH/runtime environment, but it should not own SocketCAN, CAN adapter hardware, CAN frame packing, or message timing. Those dependencies stay in the CAN Bridge.

## Related Docs

- [can-bridge.md](can-bridge.md) - local command and decoded-status interface owner.
- [metadrive.md](metadrive.md) - scenario metadata source.
- [../data-flow.md](../data-flow.md) - command and status flow.