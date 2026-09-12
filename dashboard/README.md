# AFS Dashboard

Planned Python HMI for operator commands and system observation.

## Source Layout

```text
src/afs_dashboard/
|-- app/                 # UI composition and presentation
|-- gateway_client/      # Unix-socket connection and request/status exchange
`-- models/              # UI-facing commands, status, freshness, and health
tests/                   # model, client, and presentation tests
```

The Dashboard will send requested headlight power/mode and identified clear-fault actions to the C++ bridge. It will display the request, bridge acceptance, ECU-reported executed state, faults, feedback, and freshness as distinct information.

For a browser UI, the Python backend owns the Unix-socket connection and exposes the browser transport. The Dashboard does not open SocketCAN, pack CAN frames, or access bridge memory. No Dashboard behavior is implemented yet.
