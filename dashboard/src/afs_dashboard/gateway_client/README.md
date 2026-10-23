# Gateway Client

`client.py` implements the reconnecting versioned Dashboard socket client. It
sends mode/power requests and clear-fault actions, polls bridge status, and
merges fresh runner speed, steering, position, heading, nearby vehicle
positions, and decoded `0x500` status. ECU health/faults, executed mode, servo
feedback, applied dim-sector mask, and the 250 ms stale age are displayed when
status is available; labeled simulated values remain the fallback. Retained
request IDs reconcile accepted commands after reconnect. See the [IPC
contract](../../../../docs/architecture/dashboard-bridge-communication.md).
