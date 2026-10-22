# Dashboard Branch Plan

## Goal

Build a native Dashboard window for operator commands and AFS observation while
the CAN adapter is unavailable. Mark locally supplied values as demo data and
connect the UI to the C++ bridge for requests and runner status.

## Current State

- `feat/dashboard` is the active branch.
- The native Tkinter Dashboard has a surrounding-object view, speed
  and steering meters with a mode-dependent lighting selection preview, and
  driver controls. Mode buttons disable while power is off. It opens without
  a browser or localhost port.
- `dashboard/scripts/start_dashboard.sh` starts the native window using the
  configured MetaDrive Python environment, with an optional `DASHBOARD_PYTHON`
  override.
- Dashboard-to-bridge `SOCK_SEQPACKET` request/status IPC is implemented.
  Fresh runner speed, steering, position, heading, and nearby vehicles are
  shown when available. Requests and their IDs are stored by the bridge;
  ECU delivery and status reception are not implemented.
  The Dashboard does not open SocketCAN or send CAN frames.

## Remaining Work

- Add bridge CAN transmission for accepted requests and decode ECU status
  when the adapter and firmware are available.
- Replace simulated ECU faults, feedback, executed mode, and applied dim
  sectors with fresh decoded ECU status.
- Keep gateway disconnection, stale source data, accepted commands, and ECU
  execution visible as distinct states as CAN integration proceeds.
- Add a combined launcher for the MetaDrive and Dashboard windows in a later
  system-integration task.
- Synchronize the Code graph and documentation for any future behavior changes.

## Local Run

```bash
bash dashboard/scripts/start_dashboard.sh
```

Run in a graphical Linux session; the native window opens directly.
