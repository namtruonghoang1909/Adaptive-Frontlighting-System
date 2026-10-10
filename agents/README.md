# Repository Agent Guide

This is the main guide for repository work. The root [AGENTS.md](../AGENTS.md) points here so agents discover this guide automatically. Read it before changing source, tests, scripts, or documentation.

## Reading Order

1. Read [rules/README.md](rules/README.md) and every rule category relevant to the task.
2. Read [working-context.md](working-context.md) for changing implementation status and the current resume point.
3. Read [prompt-tracking.md](prompt-tracking.md) for the latest ten context-changing requests.
4. Read the README beside the component or module being changed.
5. For architecture work, read [docs/architecture/overview.md](../docs/architecture/overview.md) and [docs/architecture/data-flow.md](../docs/architecture/data-flow.md).
6. For every code change, read and follow [code_visualize.md](code_visualize.md).

## Agent Workspace

| Location | Purpose |
|---|---|
| [rules/](rules/README.md) | Category-specific instructions |
| [working-context.md](working-context.md) | Current implementation and resume point |
| [prompt-tracking.md](prompt-tracking.md) | Recent context-changing requests |
| [roadmap.md](roadmap.md) | Proposed order and open design decisions |
| `plans/` | Component plans and historical implementation notes |
| [code_visualize.md](code_visualize.md) | Required maintenance for code changes |

## Component Ownership

| Component | Ownership |
|---|---|
| `simulation_runner/` | Python owns MetaDrive lifecycle, driving controls, object extraction, coordinate normalization, the development scene display, and future IPC publishing. |
| `bridge/` | C++ owns host IPC, CAN conversion and scheduling, SocketCAN, decoded ECU status, and communication diagnostics. |
| `dashboard/` | Python owns operator commands and presentation of bridge/ECU status. |
| `firmware/` | STM32 owns AFS/ADB decisions, actuator commands, feedback checks, and safe fallback. |

CAN geometry compression and final lighting decisions stay outside Python extraction. The Dashboard never opens SocketCAN or reads bridge process memory.

## Development Code Graph

The Code graph under `tools/system_visualization/` is a development aid for
understanding the codebase without reading source files individually. It is
not an AFS project component, runtime feature, or project milestone. Report
its maintenance separately from AFS implementation progress.

Every code change, including fixes, refactors, and new implementations, must
include Code graph maintenance in the same task. Keep it aligned with the
current working tree, including uncommitted code. Follow
[code_visualize.md](code_visualize.md) before considering the task complete;
do not defer synchronization to a later task or commit.

For each implementation or fix:

1. Review the changed code against the visible class graph and ordered
   Functionalities paths.
2. Update affected nodes, arrows, descriptions, source evidence, and step
   arguments. If the curated model still matches, leave it unchanged and say why.
3. Regenerate the source inventory, run the graph checks, and report the result
   in the handoff. The exact commands are in [code_visualize.md](code_visualize.md).

## Local MetaDrive Dependency

`simulation/metadrive/` is an ignored local upstream checkout. Inspect it when MetaDrive API behavior must be confirmed, but do not patch, format, vendor, or commit upstream files. Keep project adapters and compatibility logic under `simulation_runner/`.

## Verification

Run commands from the repository root on Linux. Use the configured MetaDrive interpreter when available:

```bash
PYTHONPATH=simulation_runner/src \
simulation/metadrive/metadrive_venv/bin/python -m pytest simulation_runner/tests -v
```

If pytest is unavailable, use the dependency-free test procedure documented in [docs/verification/testing.md](../docs/verification/testing.md). Report checks run for the current change separately from historical results.

Check runtime readiness without starting MetaDrive with `bash simulation_runner/scripts/check_simulation_requirements.sh --headless` or `--rendered`. User-facing requirements, runner arguments, and examples live in [simulation_runner/runner.md](../simulation_runner/runner.md).

## Documentation Workflow

- Keep implemented behavior distinct from planned behavior.
- Keep ownership, process boundaries, source paths, diagrams, and handoff notes consistent.
- Keep tool and helper implementations under `tools/`; use `docs/tools/` only for concise descriptions and links.
- Use repository-relative paths and links; keep workstation paths out of project documentation.
- Update the working context when implementation status, commands, or the resume point changes.
- Keep prompt tracking newest-first and limited to ten entries.
- Validate active links, code fences, stale paths, and whitespace after documentation changes.

## Rule Maintenance

The user’s current request has highest priority. This guide applies repository-wide. Files under `agents/rules/` contain category-specific rules and may be expanded without creating more `AGENTS.md` files.
