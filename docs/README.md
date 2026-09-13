# Adaptive Front-lighting System Docs

These documents orient developers and agents around the bench-scale AFS/ADB prototype. Detailed implementation contracts should live near their source once each module is built.

All documented paths are relative to the repository root unless explicitly stated otherwise. Runtime-facing MetaDrive, SocketCAN, the C++ bridge, Dashboard, and hardware commands require Linux; clone and editor-mount locations are not part of the project contract.

## Read First

1. [architecture/overview.md](architecture/overview.md) - whole-system overview.
2. [architecture/components/bridge.md](architecture/components/bridge.md) - C++ bridge modules and ownership.
3. [architecture/components/metadrive.md](architecture/components/metadrive.md) - simulator role.
4. [architecture/data-flow.md](architecture/data-flow.md) - source, snapshot, CAN, and status flow.
5. [architecture/components/dashboard.md](architecture/components/dashboard.md) - separate command/status HMI.
6. [architecture/components/afs-ecu.md](architecture/components/afs-ecu.md) - physical ECU role.
7. [architecture/components/headlights.md](architecture/components/headlights.md) - headlight structure and behavior.
8. [can/README.md](can/README.md) - CAN bus and message-spec index.
9. [hardware/hardware.md](hardware/hardware.md) - bench hardware.
10. [tools/tools.md](tools/tools.md) - tools and runtime environment.
11. [verification/testing.md](verification/testing.md) - verification approach.
12. [agents/working-context.md](agents/working-context.md) - agent operating context.

## System Snapshot

```text
Python: MetaDrive + adapter -> Unix socket -> C++ gateway -> CAN -> STM32 -> headlights
Python: Dashboard          <-> Unix socket <-> gateway <--- ECU status
```

The [system flowchart](architecture/overview.md#system-at-a-glance) shows the proposed refactor: three application processes on the same Linux host. MetaDrive and its adapter share one Python process; the C++ gateway and Python Dashboard are separate processes connected through Unix socket IPC. The [gateway thread diagram](architecture/data-flow.md#inside-the-gateway) shows its internal mutex-protected state.

The gateway owns host CAN transport; STM32 owns final lighting decisions. This is a design, not implemented end-to-end behavior. Agents should read [AGENTS.md](AGENTS.md) and [agents/AGENTS.md](agents/AGENTS.md).

## Documentation Map

| Document | Purpose |
|---|---|
| [architecture/overview.md](architecture/overview.md) | System architecture |
| [architecture/components/bridge.md](architecture/components/bridge.md) | C++ vehicle/CAN bridge |
| [architecture/components/metadrive.md](architecture/components/metadrive.md) | MetaDrive dependency |
| [architecture/data-flow.md](architecture/data-flow.md) | End-to-end ownership |
| [architecture/components/dashboard.md](architecture/components/dashboard.md) | Dashboard component |
| [architecture/components/afs-ecu.md](architecture/components/afs-ecu.md) | AFS ECU component |
| [architecture/components/headlights.md](architecture/components/headlights.md) | Headlight rig |
| [can/README.md](can/README.md) | CAN contract |
| [hardware/hardware.md](hardware/hardware.md) | Hardware |
| [tools/tools.md](tools/tools.md) | Tools |
| [verification/testing.md](verification/testing.md) | Testing |
| [temporary/desired_file_system.md](temporary/desired_file_system.md) | Target repository layout |
| [agents/working-context.md](agents/working-context.md) | Agent context |

## Current Status

| Area | Status |
|---|---|
| Documentation | Proposed C++ gateway architecture, process flowchart, and thread diagram |
| Python simulation | Runner, controls, ego/surrounding extraction, and snapshot datatypes implemented under `simulation_runner/` |
| Runner surrounding integration and adapter IPC | Not implemented |
| C++ bridge | C++17/CMake module scaffold; runtime not implemented |
| DBC | Planned as `can/afs.dbc` |
| Dashboard | Python package scaffold; UI and IPC behavior not implemented |
| AFS/ADB firmware | Not implemented |
| Vendored MetaDrive | Local ignored tree under `simulation/metadrive/` |
| Hardware rig | Planned |

## Documentation Rules

- Keep architecture files concise and explanatory.
- Keep CAN details under [can/](can/README.md); the DBC becomes the source of truth.
- Keep agent planning under [agents/](agents/).
- Add source skeletons incrementally with their implementation milestones.
