# Dashboard Component

The Dashboard is a separate Python application process for operator commands and system observation. Its organized package scaffold is under `dashboard/`; UI and gateway-client behavior are not implemented. It connects to the C++ bridge over Unix socket IPC on the same Linux system. The bridge owns CAN and exposes decoded data; the Dashboard never accesses SocketCAN or bridge state directly.

## Responsibilities

- Provide controls for requesting headlight power and operating mode.
- Send a momentary clear-fault request.
- Show requested state, executed ECU state, input freshness, faults, servo feedback, and applied output.
- Remain usable when bridge or ECU data is stale or unavailable.

The Dashboard requests behavior; the AFS ECU decides what can actually execute.

## Gateway Connection

The proposed transport is a gateway-owned Unix Domain Socket using `SOCK_SEQPACKET` and versioned JSON. The Dashboard is a client, separate from the simulation client.

```text
Dashboard request -> Unix socket IPC -> C++ gateway -> CAN -> STM32
Dashboard display <- Unix socket IPC <- C++ gateway <- CAN <- STM32 status
```

Gateway acceptance confirms receipt/validation of a request, not physical execution. The UI distinguishes requested state, gateway acceptance, and ECU-reported executed state. Clear-fault actions need request identities and explicit handling; they must not disappear when a newer state snapshot replaces an older one.

A browser-based UI uses a Python backend to communicate with the gateway. HTTP/WebSocket may connect browser and backend, while the backend-to-gateway connection remains local Unix socket IPC.

The command-lifetime policy on disconnect remains detailed-design work. Display data must carry explicit freshness. A slow or disconnected Dashboard must not stall the gateway CAN worker.

## Inputs And Outputs

| Direction | Data |
|---|---|
| User to Dashboard | Requested power, requested mode, clear-fault action |
| Dashboard to C++ gateway | Structured command request through Unix socket IPC |
| C++ gateway to Dashboard | Command results, ego display data, decoded AFS status, source freshness, and gateway health |
| Dashboard to user | Requested versus executed mode, faults, feedback, and output state |

The Dashboard does not create CAN IDs, DLC, alive counters, checksums, or packed payloads.

## Design

The UI has two primary tabs.

| Tab | Purpose | Main content |
|---|---|---|
| User Commands | Collect operator intent | Power toggle, requested-mode segmented control, clear-fault button, connection state, and latest accepted command |
| AFS Status | Observe the running system | Requested versus executed mode, CAN freshness, faults, speed, steering, servo feedback, applied dim state, and bridge health |

The User Commands tab should be compact. Persistent values use toggles or segmented controls; clear-fault is a momentary action. Controls should clearly show disabled or disconnected states.

The AFS Status tab should put executed mode, health, and faults first. Simulation input, servo feedback, output state, and timing details follow in scan-friendly groups. Stale values must be marked stale rather than presented as current.

## Tools

| Tool or interface | Role |
|---|---|
| Python | Dashboard implementation language |
| Python UI library | Streamlit, NiceGUI, PySide, or PyQt; final choice remains open |
| Gateway IPC client | Send commands and receive results/display snapshots |
| Unix Domain Sockets | Dashboard backend to C++ gateway process boundary |
| HTTP/WebSocket, if a browser UI is chosen | Browser to Python Dashboard backend only |
| Shared DBC-derived enums | Keep displayed modes and faults aligned with the CAN contract |
| Plotting and table widgets | Display feedback and timing histories |
| Logging | Record user actions and connection or stale-data issues |

## Related Docs

- [bridge.md](bridge.md) - C++ gateway ownership and Dashboard boundary.
- [metadrive.md](metadrive.md) - simulation source.
- [../data-flow.md](../data-flow.md) - command and status flow.
