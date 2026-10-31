# Troubleshooting Index

Use this folder to keep diagnosed project errors with their symptoms, checks,
and working resolutions. Add an entry when a failure occurs, preserve the exact
error text, and distinguish a verified fix from a likely cause. Do not record a
guess as a confirmed solution.

## Component Guides

| Area | Guide | Covers |
|---|---|---|
| CAN adapter and bus | [can_errors.md](can_errors.md) | SocketCAN setup, bridge transmission, physical bus, and SavvyCAN observations |
| C++ bridge | [bridge_errors.md](bridge_errors.md) | Bridge startup and runtime failures |
| Unix socket IPC | [ipc_errors.md](ipc_errors.md) | Runner/bridge and Dashboard/bridge local socket communication |
| Simulation runner | [simulation_runner_errors.md](simulation_runner_errors.md) | MetaDrive and runner startup/runtime failures |
| Dashboard | [dashboard_errors.md](dashboard_errors.md) | Native window and bridge status/command display |
| ECU firmware | [firmware_errors.md](firmware_errors.md) | Zephyr CAN service, ECU startup, and RTT output |
| ST-Link/OpenOCD | [stlink_errors.md](stlink_errors.md) | Probe permissions, SWD access, build, and flashing |
| Bench hardware and wiring | [hardware_errors.md](hardware_errors.md) | Power, wiring, transceiver, and actuator hardware issues |
| Project scripts | [scripts_errors.md](scripts_errors.md) | Dependency setup, project readiness checks, and component launchers |
| System Visualization | [visualization_errors.md](visualization_errors.md) | Browser pages, Code graph, and generated inventory |
| Tests | [test_errors.md](test_errors.md) | Focused suites, dependencies, and test runner failures |

## Add An Error Record

For each new issue, record:

1. The exact command and complete relevant output.
2. The component, branch, operating environment, and hardware state when useful.
3. Checks that separated the cause from similar failures.
4. The resolution and a focused retest that confirmed it.
5. Any remaining uncertainty or hardware-only verification.

Prefer linking to the detailed component guide for setup instructions rather
than copying long procedures. These pages are an incident log, not a claim that
every listed symptom has one universal cause.
