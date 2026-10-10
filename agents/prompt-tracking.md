# Prompt Tracking

This file keeps the latest 10 user prompts that changed project context, files, or decisions.
Future agents should read this file with the rest of `agents/` before making changes.

## Maintenance Rules

- Keep entries newest first.
- Keep only the latest 10 entries; remove the oldest entry when adding an 11th.
- Record the user's prompt, what the agent changed, and any verification or blockers.
- Include files modified using repo-relative paths.
- If a prompt only asks a question and nothing changes, add it only when the answer affects future work.

## Entries

### 2026-10-10 - Add File Counts And Change Markers To Commit Plans

**User prompt**

User asked commit plans to show the total number of files in each commit and
mark every listed path as added, modified, or deleted.

**Agent changes**

- Updated the committing rules to require per-commit file totals and `-add`,
  `-mod`, or `-del` on every planned file path.
- Defined each marker and specified how to represent renames.

**Files modified**

- `agents/rules/committing.md`, `agents/prompt-tracking.md`

**Verification**

- Checked Markdown whitespace, rule link targets, and the ten-entry limit.

### 2026-10-10 - Require File-Level Commit Plans And Smaller Scope

**User prompt**

User asked for commit plans to list each commit and its files, and for commits
to contain a suitable amount of implementation instead of combining too much
work in one commit.

**Agent changes**

- Updated the committing rules to require an ordered, file-level plan before
  staging and user approval of that plan before staging, committing, or pushing.
- Clarified that each commit should contain one cohesive, independently
  reviewable behavior or mechanical change and its direct tests.

**Files modified**

- `agents/rules/committing.md`, `agents/prompt-tracking.md`

**Verification**

- Checked the changed Markdown for whitespace and reviewed the updated rule
  links and headings.

### 2026-10-07 - Pause After IPC Boundary Discussion

**User prompt**

User asked whether the simulation runner and CAN bridge should communicate
through shared memory, then paused work and asked for needed updates.

**Agent changes**

- Confirmed the documented layout: separate Python runner and C++ bridge
  processes, with proposed IPC and CAN threads sharing latest state only inside
  the bridge. Unix `SOCK_SEQPACKET` remains a proposed cross-process transport;
  the message contract and delivery policy still need design.
- Recorded the pause and resume point. No runtime or Code graph code changed.

**Files modified**

- `agents/working-context.md`, `agents/prompt-tracking.md`

**Verification**

- Reviewed architecture and adapter guides; checked Markdown links, fences,
  and whitespace.

### 2026-10-07 - Remove LiDAR Extraction And Comparison

**User prompt**

User chose MetaDrive registry objects for surrounding extraction and asked to
remove LiDAR extraction, adjust `SceneSnapshot`, and remove the browser LiDAR
comparison and its dedicated launcher.

**Agent changes**

- Removed `LidarSnapshot`, cached LiDAR extraction, its scene field, and the
  runner call. `SceneSnapshot` now validates matching ego and surrounding data.
- Kept the scene display as a single registry-object canvas and advanced its
  JSON schema to version 2.
- Removed LiDAR-specific tests and launcher; updated runtime guides, architecture
  notes, Code graph nodes/interactions/functionality paths, and generated inventory.

**Files modified**

- `simulation_runner/src/object_extraction/`, `simulation_runner/src/metadrive_runner/`,
  `simulation_runner/src/scene_display/`, `simulation_runner/tests/`, `simulation_runner/scripts/`
- `tools/system_visualization/`, `README.md`, `docs/`, `agents/`

**Verification**

- 39 dependency-free tests passed. Real one-step headless MetaDrive runs passed
  with and without the local scene server. The regenerated Code graph inventory,
  graph validator, JavaScript syntax, DOM smoke checks, Markdown checks, and Git
  whitespace check passed. A graphical browser view was not inspected.

### 2026-10-07 - Restore Focus-Only Arrow Captions And Node Sizes

**User prompt**

User preferred the version before the last enlargement and asked to remove
arrow text from the graph until a node is clicked.

**Agent changes**

- Restored parent/child radii to 54/36 and their label sizes to 15/13.
- Restored arrow captions only for direct connections after node selection,
  along with the earlier arrow styling. The curated node arrangement remains.
- Aligned the viewer guide and working context with the restored behavior.

**Files modified**

- `tools/system_visualization/viewer.js`, `styles.css`, `README.md`
- `README.md`, `agents/working-context.md`, `agents/prompt-tracking.md`

**Verification**

- Inventory freshness, graph validation, JavaScript syntax, DOM interactions,
  geometry, Markdown, and whitespace checks passed.

### 2026-10-07 - Enlarge Nodes And Restore Arrow Captions

**User prompt**

User said the arranged Code graph looked fine but wanted slightly larger nodes
and node text, and reported that arrow captions were missing.

**Agent changes**

- Increased parent/child radii to 60/40 and node label sizes to 17/14 while
  preserving the 1.5:1 radius ratio.
- Rendered ordinary interaction captions without a selection, strengthened
  arrow contrast, and separated captions for parallel collapsed interactions.
- Updated the viewer guide and working context. Curated class interactions and
  ordered functionality steps remain accurate and unchanged.

**Files modified**

- `tools/system_visualization/viewer.js`, `styles.css`, `README.md`
- `README.md`, `agents/working-context.md`, `agents/prompt-tracking.md`

**Verification**

- Inventory freshness, graph validation, JavaScript syntax, DOM interactions,
  caption overlap and geometry checks, Markdown checks, and Git whitespace
  checks passed.

### 2026-10-07 - Arrange Code Graph Nodes By Implemented Paths

**User prompt**

User requested a more logical, loosely arranged order for the Code graph nodes.

**Agent changes**

- Placed each parent class/function deliberately within its layer: runner entry,
  controls and store; ego, surrounding and LiDAR extraction into the scene;
  then server and browser drawing.
- Kept child expansion and all existing interactions. Search and layer filters
  compact visible nodes while preserving their relative placement.
- Validated positions for every parent and updated the viewer and agent guides.

**Files modified**

- `tools/system_visualization/graph-data.js`, `viewer.js`, `validate.mjs`,
  `README.md`
- `README.md`, `agents/code_visualize.md`, `agents/working-context.md`,
  `agents/prompt-tracking.md`

**Verification**

- Inventory freshness, graph validation, JavaScript syntax, DOM interactions,
  graph geometry, Markdown checks, and Git whitespace checks passed.

### 2026-10-07 - Improve Code Graph Text Readability

**User prompt**

User reported that text in the Code graph had become too small.

**Agent changes**

- Enlarged node, layer, interaction, and functionality labels.
- Made the graph open and reset at a readable zoom. Search, filters, and long
  functionality paths retain that scale; **Fit** still shows the full map.
- Updated the viewer guide and working context. The curated class and
  functionality models still describe the same application code.

**Files modified**

- `tools/system_visualization/viewer.js`, `styles.css`,
  `functionality-overlay.js`, `README.md`
- `README.md`
- `agents/working-context.md`, `agents/prompt-tracking.md`

**Verification**

- Graph DOM checks passed for readable zoom, label sizes, fit/reset, and
  existing interactions. Functionality overlay checks passed for path and
  action zoom; source inventory and graph validation passed.

### 2026-10-07 - Clarify Code Graph Documentation And Agent Rules

**User prompt**

User requested documentation updates, especially the root README and agent
rules for updating the Code graph after implementing or fixing code.

**Agent changes**

- Expanded the root README with the Code graph command, default address,
  class and functionality path behavior, and a link to its maintenance rules.
- Made the agent guide and coding/documentation rules explicit: every
  implementation, fix, refactor, or removal must review the source inventory,
  class interactions, and ordered paths in the same task.
- Added a change-to-code-map review table, ordered-step requirements, and
  verification commands to the canonical maintenance guide. Updated the
  tool guide, documentation index, and working context.

**Files modified**

- README.md, docs/README.md, tools/system_visualization/README.md
- agents/README.md, agents/rules/coding.md,
  agents/rules/documentation.md, agents/rules/instructions.md,
  agents/rules/committing.md, agents/rules/README.md
- agents/code_visualize.md, agents/working-context.md,
  agents/prompt-tracking.md

**Verification**

- Documentation links, code fences, and whitespace passed; code inventory
  freshness and graph validation passed. No application code changed.

### 2026-10-07 - Add Functionality Paths To The Class Graph

**User prompts**

User requested a right-side list of important implemented functionalities,
including ego and surrounding extraction. Selecting one should light up the
ordered class/function calls and passed values on the existing Code graph.
The user explicitly asked to preserve existing graph logic, then asked for
more node spacing so expanded members and arrows remain readable.

**Agent changes**

- Added seven separate implemented paths and an optional ordered-arrow overlay.
  Selecting a path expands its needed members and frames that route; clearing
  removes the highlights. The base class graph model and existing handlers
  remain in place.
- Increased parent spacing and child offset without changing node sizes or
  graph interactions.
- Validated flow IDs, endpoints, evidence, and step details against the source
  inventory; updated the viewer guide and agent maintenance context.

**Files modified**

- tools/system_visualization/functionality-data.js,
  functionality-overlay.js, viewer.js, index.html, styles.css,
  validate.mjs, code-index.js, README.md
- tools/README.md, docs/tools/tools.md, docs/architecture/overview.md
- agents/code_visualize.md, agents/working-context.md,
  agents/prompt-tracking.md

**Verification**

- Inventory freshness, graph validation, JavaScript syntax, old graph DOM
  behavior, new overlay DOM behavior, links/fences/whitespace, and Git
  whitespace checks passed. A graphical screenshot was unavailable here.
