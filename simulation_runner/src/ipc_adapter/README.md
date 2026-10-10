# IPC Adapter

Planned Python client for the local C++ bridge.

This module will project simulator-owned snapshots into versioned, simulator-independent messages and publish them through Unix Domain Socket IPC. It belongs to the MetaDrive process and can consume matching data through the runner's latest-scene interface. No IPC behavior is implemented yet.

It will not own CAN IDs, DBC packing, SocketCAN, dashboard state, or AFS control. No IPC behavior is implemented yet.
