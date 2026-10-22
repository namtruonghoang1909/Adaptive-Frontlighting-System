# Dashboard Component

The Dashboard is a separate Python application process for operator commands and system observation. `dashboard/` contains a native Tkinter window, a reconnecting bridge client, and a simulated ECU/fallback model. It opens directly in a graphical Linux session without a browser or localhost port. The client uses Unix socket IPC to the C++ bridge; it never accesses SocketCAN or bridge process memory directly.

## Responsibilities

- Provide controls for requesting headlight power and operating mode.
- Send a momentary clear-fault request.
- Show requested state, executed ECU state, input freshness, faults, servo feedback, and applied output.
- Remain usable when bridge or ECU data is stale or unavailable.

The Dashboard requests behavior and the AFS ECU will decide what can actually execute. The bridge currently stores accepted requests; the window reflects them in a simulated ECU state only.

## Gateway Connection

The implemented transport is a gateway-owned Unix Domain Socket using `SOCK_SEQPACKET` and versioned JSON. The Dashboard is a client on a separate socket from the simulation client. See the [Dashboard–bridge contract](../dashboard-bridge-communication.md).

```text
Dashboard request -> Unix socket IPC -> C++ gateway -> CAN -> STM32
Dashboard display <- Unix socket IPC <- C++ gateway <- CAN <- STM32 status
```

Gateway acceptance confirms receipt/validation of a request, not physical execution. The UI distinguishes requested state, gateway acceptance, and simulated ECU execution. Clear-fault actions have request identities and receive an explicit `ecu_unavailable` rejection until ECU control exists.

The native window calls a Python gateway client on a worker thread. It polls bridge status and sends identified controls over local Unix socket IPC.

Fresh runner speed, steering, position, heading, and nearby vehicle positions replace those demo fields when valid. The proximity grid and ECU execution remain simulated and labeled. On disconnect, pending actions are not replayed; a returned stored request ID can confirm that an in-flight command reached the bridge. The client falls back to demo values until a fresh runner sample returns.

## Inputs And Outputs

| Direction | Data |
|---|---|
| User to Dashboard | Requested power, requested mode, clear-fault action |
| Dashboard to C++ gateway | Structured command request through Unix socket IPC |
| C++ gateway to Dashboard | Command results, runner ego fields and nearby vehicles with freshness, retained request ID/state, and ECU availability |
| Dashboard to user | Requested state, bridge acceptance, simulated execution and ECU values, and data source |

The Dashboard does not create CAN IDs, DLC, alive counters, checksums, or packed payloads.

## Design

The native window has three sections: a top-down view of nearby surrounding
objects; middle speed and steering meters with captions below them and a center
lighting selection preview; and bottom driver controls and status cards. The
preview draws distinct fixed low beam, swivel low beam, full high beam, an ADB
pattern with an unlit high-beam preview sector around a sample vehicle, and
off patterns. The low-beam base stays lit in the ADB preview. It changes with
the local selection even if the bridge is offline. Turning power off greys out
and disables the four mode buttons; turning it on restores the last selection.
Mode and power actions request bridge changes when connected, with acceptance
shown separately. A second native window contains position, proximity grid,
faults, servo feedback,
dim sectors, and clear-fault controls. Labels identify fresh runner fields,
simulated fallback/ECU fields, and bridge connectivity. Mouse-wheel and
trackpad events scroll the main window when its content exceeds the viewport.

The UI preserves the distinction between operator request, gateway acceptance,
and simulated ECU execution. Stale runner values fall back to labeled demo
values. Persistent values use direct controls; clear-fault is a rejected
momentary action until CAN/ECU integration.

## Tools

| Tool or interface | Role |
|---|---|
| Python | Dashboard implementation language |
| Tkinter | Draw the native instrument cluster and handle operator input |
| Gateway IPC client | Reconnect, send controls, and receive results/status snapshots |
| Unix Domain Sockets | Dashboard backend to C++ gateway process boundary |
| Shared DBC-derived enums | Keep displayed modes and faults aligned with the CAN contract |
| Plotting and table widgets | Display feedback and timing histories |
| Logging | Record user actions and connection or stale-data issues |

## Related Docs

- [bridge.md](bridge.md) - C++ gateway ownership and Dashboard boundary.
- [metadrive.md](metadrive.md) - simulation source.
- [../data-flow.md](../data-flow.md) - command and status flow.
