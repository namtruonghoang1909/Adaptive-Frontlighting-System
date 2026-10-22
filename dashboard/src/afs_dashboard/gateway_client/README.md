# Gateway Client

`client.py` implements the reconnecting versioned Dashboard socket client. It
sends mode/power requests and clear-fault actions, polls bridge status, and
merges fresh runner speed, steering, position, heading, and nearby vehicle positions with labeled
simulated ECU and fallback values. Retained request IDs reconcile accepted
commands after reconnect. See the [IPC contract](../../../../docs/architecture/dashboard-bridge-communication.md).
