# Documentation Rules

Rules in this file apply to user guides, architecture documents, plans, and agent handoff notes.

## Sources Of Truth

- The authoritative Code graph model and ordered functionality paths are in
  [tools/system_visualization/](../../tools/system_visualization/README.md).
  The maintenance procedure is [code_visualize.md](../code_visualize.md).

## Required Updates

- Update the root [README.md](../../README.md) and relevant component guides
  when a user-facing command, implemented capability, or project status changes.
- Update the Code graph guide when its viewer behavior or run command changes.
  For code changes, follow the graph and path synchronization rule in
  [code_visualize.md](../code_visualize.md).

## Terminology And Structure

- Keep agent rules, handoff notes, prompt history, roadmap, and plans under the root
  `agents/` directory. Use `agents/README.md` as their main entry point; do not
  recreate a separate `docs/agents/` tree.
- Keep development tool and helper implementations under the repository-root `tools/`
  directory. Keep `docs/tools/` limited to brief descriptions and links to those tools.
- Describe the code map as a development aid for understanding the codebase. Do not count
  its implementation or maintenance as an AFS project component, feature, or milestone;
  report tooling work separately from project implementation progress.

## Validation

- Check links, code fences, stale paths, and whitespace in changed documentation.
