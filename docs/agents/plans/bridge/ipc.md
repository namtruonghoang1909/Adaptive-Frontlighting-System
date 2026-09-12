# Gateway Dashboard IPC Plan

## Status

The former Python Dashboard-interface plan is superseded by the C++ gateway's IPC interface. `bridge/src/ipc/` and `dashboard/src/afs_dashboard/gateway_client/` now define the module boundaries, but no IPC behavior is implemented. See [dashboard.md](../../../architecture/components/dashboard.md).

## Proposed Work After Implementation Is Authorized

- Run the Python Dashboard as a separate application process on the same Linux system.
- Connect to the C++ gateway using Unix Domain Sockets, `SOCK_SEQPACKET`, and versioned JSON.
- Accept requested headlight power/mode and identified clear-fault actions through the gateway.
- Return gateway acceptance/rejection separately from ECU-reported execution.
- Expose current source data, decoded AFS status, gateway health, and explicit freshness.
- Bound outgoing status buffering so a slow Dashboard cannot stall CAN.
- Define reconnect, duplicate-action, and command-lifetime behavior during detailed design.
- Keep the UI toolkit open. A web UI may use HTTP/WebSocket between browser and Python backend; the backend-to-gateway boundary remains Unix socket IPC.

The Dashboard never accesses SocketCAN or the gateway's internal state store.
