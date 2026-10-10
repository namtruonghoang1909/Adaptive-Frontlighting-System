# Development Code Graph Maintenance

The Code graph is a development aid for understanding the codebase without opening source files
individually, saving time during development and review. It is not an AFS project component,
runtime feature, or project milestone. Report its maintenance separately from AFS implementation
progress.

The repository's interactive architecture and code-navigation tool lives in
[`tools/system_visualization/`](../tools/system_visualization/README.md). Its authoritative graph
model is `tools/system_visualization/graph-data.js`. Keep tool implementation under `tools/`;
project documentation should contain only concise descriptions and links to the viewer.
The source inventory is generated separately in `tools/system_visualization/code-index.js`
by `build_index.py`; regenerate it as part of every code-change task. It
supports source-path and graph-mapping validation. Curated implemented classes,
important entry functions, their methods or fields, and their interactions in
`graph-data.js` are visible graph nodes and arrows. Files are source links in
the right-hand description panel. Keep every node's `source` and every edge's
`evidence` aligned with the inventory. Planned layers remain empty until their
runtime classes exist. Its `layout` gives each parent node a local position
within its layer panel. Place new parents near their callers and outputs, with
room for expanded members and interaction arrows.
Ordered paths for the Functionalities section live in
`tools/system_visualization/functionality-data.js`. Keep its steps and evidence
aligned with implemented calls and data handoffs. The overlay uses the same
graph nodes and does not replace the normal graph interaction model.

## Required For Every Code Change

Every agent that changes code must synchronize the code map in the same task. This includes
new features, bug fixes, refactors, removals, and changes to existing behavior, even when the
architecture and file layout stay the same. The map must describe the current working tree,
including uncommitted code, rather than only the last commit or intended future design.
Keep it synchronized as implementation evolves and complete a final check before handoff;
do not postpone maintenance until a separate documentation task or commit.

Review each code diff against the generated inventory, curated class graph,
and ordered functionality paths. Update descriptions and relationships
wherever the change affects what a reader needs to understand:

- Responsibilities and behavior of existing code
- Module relationships
- Parent-child class/member relationships and parent positions in the expandable graph
- Important function call relationships
- Data flow
- Ordered functionality paths shown by the optional graph overlay
- Service dependencies
- Interfaces between components
- Creation, removal, or renaming of functions, classes, modules, and source paths
- Implemented versus planned status
- Communication paths such as CAN, IPC, networking, or hardware interfaces

| Change made | Code-map review required |
|---|---|
| Add, remove, or rename a class, important function, method, or source path | Check inventory coverage, visible node IDs, descriptions, source links, parent positions, and interaction endpoints. |
| Fix behavior without changing the file layout | Check whether node descriptions, call/data arrows, step order, arguments, or returned values now differ. |
| Add or change an implemented feature path | Update affected ordered steps in `functionality-data.js`; add a new listed functionality when it is important to understanding the system. |
| Move a planned layer into runtime code | Add only implemented classes and relationships, and update the layer status. |

Update `tools/system_visualization/graph-data.js` for affected descriptions, nodes,
edges, statuses, links, and mappings. Regenerating the inventory
alone does not capture behavior or data-flow changes. If new source locations or
implementation milestones outgrow the generator's
coverage or status rules, update `build_index.py` as well.
Update `functionality-data.js` whenever an implemented path's steps, arguments,
or output changes. Each step must name real graph nodes in `from` and `to`,
state the actual call or data action, describe passed or returned values in
`detail`, and link to implemented source through `evidence`. Keep the array in
execution order. Do not show planned IPC, CAN, Dashboard, or firmware behavior
as an implemented functionality.

Maintenance is mandatory even when the resulting map files are unchanged: regenerate and
validate the inventory, review the curated model, and explain briefly in the handoff why the
existing representation still matches. Do not invent graph changes or add trivial nodes just
to produce a diff.

## Graph Rules

- Keep the graph focused on meaningful system relationships.
- Do not add trivial getters, setters, utility functions, or library internals.
- Prefer implemented classes and their interactions; include only the entry
  functions needed to show important call and data paths.
- Preserve existing node names when possible.
- Remove obsolete nodes and edges.
- Add new nodes and edges introduced by the implementation.
- Group classes by layer or source folder and keep empty planned layers explicit.
- Keep edge direction consistent with control or data flow.
- Keep implemented relationships visually distinct from planned relationships.
- Do not invent relationships that are not present in the implementation or documented
  target architecture.
- Keep node descriptions and repository links useful for code navigation.
- Explain responsibilities and important data/control paths clearly enough that a developer
  can understand the affected behavior from the map without reading each implementation file.
- Preserve node and layer IDs when possible because viewer interactions depend on them.

## Completion Checklist

Before finishing any task that changes code:

1. Review the code changes.
2. Review the inventory and curated graph against every code change, including behavior-only changes.
3. Update affected descriptions, relationships, statuses, source links, and mappings in `tools/system_visualization/graph-data.js`, and affected ordered paths in `functionality-data.js`. If neither curated model changes, record why the existing representation remains accurate.
4. Regenerate the source inventory, then run its freshness check, graph validator, and JavaScript syntax checks.
5. Open the viewer and check affected class/member expansion, direct-connection
   focus, functionality selection and clearing, search, layer filtering,
   pan/zoom, right-hand description, and source links.
6. Report synchronization and validation results in the handoff, including any checks that could not run.
7. Keep map changes with the code changes for review. If a commit is explicitly authorized,
   include them together; this workflow does not itself authorize staging or committing.

## Verification

Run this from the repository root:

```bash
python3 tools/system_visualization/build_index.py
python3 tools/system_visualization/build_index.py --check
node tools/system_visualization/validate.mjs
node --check tools/system_visualization/graph-data.js
node --check tools/system_visualization/code-index.js
node --check tools/system_visualization/viewer.js
node --check tools/system_visualization/functionality-data.js
node --check tools/system_visualization/functionality-overlay.js
node --check tools/system_visualization/validate.mjs
git diff --check
```
