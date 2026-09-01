# Prompt Tracking

This file keeps the latest 10 user prompts that changed project context, files, or decisions.
Future agents should read this file with the rest of `docs/agents/` before making changes.

## Maintenance Rules

- Keep entries newest first.
- Keep only the latest 10 entries; remove the oldest entry when adding an 11th.
- Record the user's prompt, what the agent changed, and any verification or blockers.
- Include files modified using repo-relative paths.
- If a prompt only asks a question and nothing changes, add it only when the answer affects future work.

## Entries

### 2026-09-01 - Merge Simulation Docs Into Components

**User prompt**

User said the docs looked fine, then noted the next implementation goal is reading MetaDrive speed, steering, and surrounding-object data. Before doing that, user asked to merge duplicated `docs/simulation/` content into `docs/architecture/components/` because CAN Bridge and Dashboard docs existed in both places, eliminating `docs/simulation/`.

**Agent changes**

- Merged simulation-facing MetaDrive details into `docs/architecture/components/metadrive.md`, including the explicit data extraction target: ego steering, ego speed, and surrounding-object data.
- Merged CAN Bridge simulation flow, local caches, outputs, and tools into `docs/architecture/components/can-bridge.md`.
- Merged Dashboard command/status processing, two-tab UI design, and tools into `docs/architecture/components/dashboard.md`.
- Removed remaining ADB grid implementation wording from component-level docs, keeping detailed ADB mapping deferred to later implementation docs.
- Removed active links to `docs/simulation/` from root docs, top-level docs index, agent working context, and desired file-system map.
- Deleted the `docs/simulation/` documentation folder.

**Files modified**

- `README.md`
- `docs/README.md`
- `docs/agents/working-context.md`
- `docs/architecture/components/can-bridge.md`
- `docs/architecture/components/dashboard.md`
- `docs/architecture/components/metadrive.md`
- `docs/architecture/components/headlights.md`
- `docs/architecture/overview.md`
- `docs/architecture/data-flow.md`
- `docs/temporary/desired_file_system.md`
- `docs/agents/prompt-tracking.md`

**Files removed**

- `docs/simulation/`

**Verification**

- Confirmed `docs/simulation/` no longer exists.
- Confirmed no active `docs/simulation` links remain outside prompt history.
- Confirmed no scanned ADB-grid implementation wording remains in the active architecture component layer.
- Checked Git status for the touched docs.
### 2026-09-01 - Remove ADB Grid From Simulation Docs

**User prompt**

User clarified that the ADB grid is part of logic, should not be documented under `docs/simulation/`, and will be documented later during deeper implementation work.

**Agent changes**

- Deleted `docs/simulation/adb-grid.md`.
- Removed `adb-grid.md` links from the simulation index, top-level docs index, agent working context, and desired file-system map.
- Rephrased simulation docs to avoid documenting ADB grid mapping details; `0x310 Vehicle_Object` remains only as a CAN output/input contract.
- Cleaned Dashboard and MetaDrive wording that referred to ADB grid details in simulation docs.

**Files modified**

- `docs/simulation/README.md`
- `docs/simulation/can-bridge.md`
- `docs/simulation/dashboard.md`
- `docs/simulation/metadrive.md`
- `docs/README.md`
- `docs/agents/working-context.md`
- `docs/temporary/desired_file_system.md`
- `docs/agents/prompt-tracking.md`

**Files removed**

- `docs/simulation/adb-grid.md`

**Verification**

- Confirmed `docs/simulation/adb-grid.md` no longer exists.
- Confirmed no active references to `adb-grid`, ADB grid, object-grid mapping, or grid mapping remain in `docs/simulation/`, `docs/README.md`, `docs/agents/working-context.md`, or `docs/temporary/desired_file_system.md` outside prompt history.
- Checked Git status for touched docs.
### 2026-09-01 - Dashboard Tools And Two-Tab UI Design

**User prompt**

User asked to replace the Dashboard `Uses` section with `Tools`, list Python, Python UI libraries, APIs, and tools, and add a design section describing a two-tab UI: one tab for receiving user commands and one tab for observing AFS status.

**Agent changes**

- Replaced `## Uses` with `## Tools` in `docs/simulation/dashboard.md`.
- Expanded the Dashboard tools list with Python, candidate Python UI libraries, CAN Bridge command/status APIs, shared DBC/enums, plotting/table widgets, scenario metadata, and logging/debug tools.
- Added a `## Design` section describing `User Commands` and `AFS Status` tabs.
- Repaired the Dashboard command-state processing table formatting while editing the same file.

**Files modified**

- `docs/simulation/dashboard.md`
- `docs/agents/prompt-tracking.md`

**Verification**

- Confirmed `docs/simulation/dashboard.md` has `## Design`, `## Tools`, `User Commands`, `AFS Status`, Python/tool/API entries, and no `## Uses` section.
### 2026-09-01 - Move ADB Grid Out Of CAN Bridge Doc

**User prompt**

User asked to remove the ADB CAN grid details from `docs/simulation/can-bridge.md` because another document should cover that topic, and to replace the CAN Bridge `Uses` section with `Tools`.

**Agent changes**

- Moved the detailed ADB object-grid mapping content into `docs/simulation/adb-grid.md`.
- Removed the embedded `## ADB Grid` section from `docs/simulation/can-bridge.md`.
- Changed `docs/simulation/can-bridge.md` section `## Uses` to `## Tools` and adjusted the table heading/content.
- Updated simulation indexes and agent context links to include `docs/simulation/adb-grid.md` as a supporting doc.

**Files modified**

- `docs/simulation/can-bridge.md`
- `docs/simulation/adb-grid.md`
- `docs/simulation/README.md`
- `docs/README.md`
- `docs/agents/working-context.md`
- `docs/temporary/desired_file_system.md`
- `docs/agents/prompt-tracking.md`

**Verification**

- Confirmed `docs/simulation/can-bridge.md` no longer contains `## ADB Grid`, `## Uses`, or old `ADB grid conversion` wording.
- Confirmed `docs/simulation/adb-grid.md` exists and is linked from the simulation index, top-level docs index, agent context, and CAN Bridge related docs.
- Checked Git status for the touched docs.
### 2026-09-01 - Simplify Simulation Docs

**User prompt**

User asked to simplify `docs/simulation/` because there were too many files, and said one Markdown file per component is enough, such as `can-bridge.md` and `dashboard.md`.

**Agent changes**

- Replaced the nested simulation docs layout with a flat component-doc layout.
- Consolidated CAN Bridge simulation inputs, processing, outputs, CAN message flow, and ADB grid notes into `docs/simulation/can-bridge.md`.
- Consolidated Dashboard simulation inputs, processing, outputs, and uses into `docs/simulation/dashboard.md`.
- Consolidated MetaDrive simulation inputs, processing, outputs, scenarios, and uses into `docs/simulation/metadrive.md`.
- Updated the simulation index, top-level docs index, agent working context, and temporary desired file-system map to point to the flat files.
- Removed obsolete nested simulation doc folders after consolidation.

**Files modified**

- `docs/simulation/README.md`
- `docs/simulation/can-bridge.md`
- `docs/simulation/dashboard.md`
- `docs/simulation/metadrive.md`
- `docs/README.md`
- `docs/agents/working-context.md`
- `docs/temporary/desired_file_system.md`
- `docs/agents/prompt-tracking.md`

**Files removed**

- `docs/simulation/can-bridge/`
- `docs/simulation/dashboard/`
- `docs/simulation/metadrive/`

**Verification**

- Confirmed `docs/simulation/` now contains only `README.md`, `can-bridge.md`, `dashboard.md`, and `metadrive.md`.
- Ran a stale-link scan for removed nested simulation docs; matches only remained in this prompt-tracking entry as removed-folder history.
- Checked Git status for the touched docs.
### 2026-09-01 - Prompt Tracking Setup

**User prompt**

User clarified that `docs/agents/prompt-tracking.md` should store the latest 10 prompts and what the agent modified, so future agents can read `docs/agents/` and resume previous work quickly.

**Agent changes**

- Added this tracking format and retention policy to `docs/agents/prompt-tracking.md`.
- Linked this file from `docs/agents/working-context.md` so future agents read it during startup.

**Files modified**

- `docs/agents/prompt-tracking.md`
- `docs/agents/working-context.md`

**Verification**

- Confirmed `docs/agents/prompt-tracking.md` existed and was empty before adding the format.
