# Documentation Agent Instructions

These instructions apply to `docs/` and its descendants. Read [agents/AGENTS.md](agents/AGENTS.md), [agents/working-context.md](agents/working-context.md), and [agents/prompt-tracking.md](agents/prompt-tracking.md) before changing architecture or handoff documentation.

- Treat the latest user request as the scope of work. The component reorganization is complete; it does not imply that IPC, CAN, Dashboard, or firmware behavior exists.
- Keep implemented behavior distinct from organized scaffolding and future design.
- Keep the system flowchart, gateway-thread diagram, component responsibilities, active paths, and agent handoff consistent.
- Use repository-relative paths and links. Keep workstation paths and local mount details out of project documentation.
- Preserve historical verification evidence and report which checks were actually run for the current task.
