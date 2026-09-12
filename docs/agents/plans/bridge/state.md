# Gateway State And IPC Plan

## Status

The former Python shared-memory design is superseded and was never implemented. `bridge/src/state/` now documents the C++ in-process state boundary. See [data-flow.md](../../../architecture/data-flow.md) for the proposed process and thread boundaries.

## Proposed State Ownership

- MetaDrive and the adapter run in one Python process; the gateway and Dashboard each run in their own process.
- Python clients exchange messages with the C++ gateway through Unix Domain Sockets. They do not share its memory.
- The gateway's main/IPC thread and CAN TX/RX worker share complete C++ snapshots protected by a short mutex.
- Keep latest vehicle/object/requested-state and decoded-status/health snapshots, with sample identity and explicit source freshness.
- Continuous observations replace old snapshots. Discrete actions need identifiers and bounded pending work.
- Never hold the state mutex during parsing, CAN/IPC I/O, logging, or UI work.
- Prevent client/socket backlogs from turning old data into fresh input.

No operating-system shared-memory segment or Python shared-state package is required for this design. Runtime implementation remains a later milestone.
