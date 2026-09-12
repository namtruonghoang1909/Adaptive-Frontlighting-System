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

### 2026-09-12 - Component Repository Reorganization

**User prompt**

User requested reorganizing the codebase into a Python `simulation_runner/`, native C++ `bridge/`, Python `dashboard/`, and unchanged `firmware/`, with functionality split into clear subdirectories and the implemented ego extractor preserved.

**Agent changes**

- Moved the MetaDrive runner, controls, ego/surrounding extraction areas, scripts, tests, and Python package metadata from the former all-Python `bridge/` into `simulation_runner/`.
- Added a behavior-free `simulation_runner/src/ipc_adapter/` boundary for later simulator-independent IPC publishing.
- Re-established `bridge/` as a C++17/CMake component scaffold split into app, IPC, state, CAN, diagnostics, public include, and test areas. No executable C++ source was added.
- Added a behavior-free Python `dashboard/` package scaffold split into UI app, gateway client, models, and tests.
- Moved existing MetaDrive screenshots out of the launcher directory into `simulation_runner/assets/screenshots/`.
- Reorganized agent plans by component and aligned root, architecture, CAN, hardware, tooling, verification, layout, and handoff documentation with the actual paths and implementation status.
- Left `firmware/` unchanged and did not implement IPC, SocketCAN, Dashboard UI, DBC, or firmware behavior.

**Files modified or moved**

- `.gitignore`
- `README.md`
- `simulation_runner/`
- `bridge/`
- `dashboard/`
- `docs/AGENTS.md`
- `docs/README.md`
- `docs/agents/AGENTS.md`
- `docs/agents/plans/bridge/`
- `docs/agents/plans/simulation_runner/`
- `docs/agents/prompt-tracking.md`
- `docs/agents/roadmap.md`
- `docs/agents/working-context.md`
- `docs/architecture/`
- `docs/can/`
- `docs/hardware/visual.md`
- `docs/temporary/desired_file_system.md`
- `docs/tools/tools.md`
- `docs/verification/testing.md`

**Verification**

- All 21 dependency-free ego-extractor, runner, CLI, and controller test functions passed directly after relocation. The current Python does not have `pytest`, so its test runner was not used.
- All 18 Python files passed AST parsing, and both Python project files passed TOML parsing.
- Both relocated shell scripts passed `bash -n` with Git Bash.
- All 50 active Markdown files passed relative-link and balanced-fence checks; active text files passed trailing-whitespace checks.
- Stale active source-path and former Host Bridge naming searches passed. CMake configuration was not run because CMake is unavailable in the current environment.
- Prompt history retains the latest 10 entries.

### 2026-09-12 - C++ Gateway Architecture And Agent Guidance

**User prompt**

User requested an independently designed C++ CAN gateway refactor, confirmed that simulation and gateway share a Linux system and that the Dashboard connects through the gateway, then requested agent guidance and an at-a-glance architecture flowchart. The user asked whether the three applications are threads and how they communicate. Runtime implementation remains out of scope.

**Agent changes**

- Documented three application processes: Python MetaDrive plus adapter, C++17 gateway, and Python Dashboard.
- Added the system Mermaid flowchart with local IPC, physical CAN, STM32 control, headlight outputs, and servo feedback.
- Added a separate diagram showing the gateway main/IPC thread and CAN TX/RX worker sharing complete snapshots under a mutex.
- Recorded the proposed Unix socket/JSON boundary, CMake baseline, DBC role, source freshness, and gateway acceptance versus ECU execution.
- Added documentation-scope instructions and populated the existing empty agent guidance file.
- Aligned related component, tooling, verification, handoff, and target-layout docs; marked the former Python CAN/shared-memory plans superseded.
- Preserved current source locations and historical runtime-validation evidence. No runtime code, dependencies, DBC, firmware, or source directories were created or moved.

**Files modified**

- `docs/AGENTS.md`
- `docs/README.md`
- `docs/agents/AGENTS.md`
- `docs/agents/plans/bridge/can-interface.md`
- `docs/agents/plans/bridge/dashboard-interface.md`
- `docs/agents/plans/bridge/metadrive-runner.md`
- `docs/agents/plans/bridge/shared-memory.md`
- `docs/agents/prompt-tracking.md`
- `docs/agents/roadmap.md`
- `docs/agents/working-context.md`
- `docs/architecture/components/bridge.md`
- `docs/architecture/components/dashboard.md`
- `docs/architecture/components/metadrive.md`
- `docs/architecture/data-flow.md`
- `docs/architecture/overview.md`
- `docs/can/README.md`
- `docs/temporary/desired_file_system.md`
- `docs/tools/tools.md`
- `docs/verification/testing.md`

**Verification**

- Read-back comparison confirmed the documentation patches match their intended contents.
- Relative links and heading anchors resolve; Markdown fences and basic Mermaid subgraph/label structure checked.
- Documentation whitespace checks passed. Diagram rendering was not exercised in a Mermaid renderer.
- Runtime tests were not rerun for this documentation-only change.
- Prompt history retains the latest 10 entries.

### 2026-09-06 - Restore Automatic Steering Centering

**User prompt**

User requested bringing back automatic steering centering in the rendered MetaDrive runner.

**Agent changes**

- Kept steering input at `0.5/s` and added a time-based `1.0/s` return-to-center rate when neither steering key is held.
- Preserved immediate centering with `C` and the latched target-speed behavior.
- Added coverage showing centering is independent of environment-step duration.
- Updated controller, architecture, testing, and handoff documentation.

**Files modified**

- `bridge/src/metadrive_runner/controls/controller.py`
- `bridge/tests/test_vehicle_control.py`
- `bridge/src/metadrive_runner/README.md`
- `docs/architecture/components/metadrive.md`
- `docs/agents/plans/bridge/metadrive-runner.md`
- `docs/verification/testing.md`
- `docs/agents/working-context.md`
- `docs/agents/prompt-tracking.md`

**Verification**

- All 21 dependency-free ego-extractor, runner, CLI, and controller tests passed in Windows Python.
- Runtime feel still requires rendered validation.

### 2026-09-06 - More Responsive Steering And Braking

**User prompt**

User requested more sensitive steering and brake behavior in the project MetaDrive runner.

**Agent changes**

- Increased normalized steering adjustment from `0.2/s` to `0.5/s`.
- Kept target-speed acceleration at `10 km/h/s` and added a separate `30 km/h/s` target-deceleration rate for the brake key.
- Kept ordinary throttle slew at `1.5/s` and added a faster `4.0/s` slew when moving toward braking.
- Preserved immediate full braking for the emergency-stop key.
- Added focused braking coverage and made runner timing tests derive expectations from the configured default, preserving the current `decision_repeat=3` setting.
- Updated timing and control documentation.

**Files modified**

- `bridge/src/metadrive_runner/controls/controller.py`
- `bridge/tests/test_vehicle_control.py`
- `bridge/tests/test_metadrive_runner.py`
- `bridge/src/metadrive_runner/README.md`
- `bridge/scripts/README.md`
- `docs/architecture/components/metadrive.md`
- `docs/agents/plans/bridge/metadrive-runner.md`
- `docs/agents/working-context.md`
- `docs/agents/prompt-tracking.md`

**Verification**

- All 20 dependency-free ego-extractor, runner, CLI, and controller tests passed in Windows Python.
- Runtime feel still requires rendered validation.

### 2026-09-06 - Keep Driving Mistakes Non-Terminal

**User prompt**

User reported that crashes and other driving mistakes respawned the vehicle at the start and requested that they no longer do so.

**Agent changes**

- Disabled termination for vehicle, object, human, road, route, and lane-line mistakes in the runner's MetaDrive configuration.
- Added a project environment subclass to suppress MetaDrive's otherwise-unconfigurable building-collision termination.
- Preserved next-seed resets for route completion and horizon truncation.
- Added unit coverage and documented the episode behavior.

**Files modified**

- `bridge/src/metadrive_runner/config.py`
- `bridge/src/metadrive_runner/runner.py`
- `bridge/tests/test_metadrive_runner.py`
- `bridge/src/metadrive_runner/README.md`
- `docs/architecture/components/bridge.md`
- `docs/agents/plans/bridge/metadrive-runner.md`
- `docs/agents/working-context.md`
- `docs/agents/prompt-tracking.md`

**Verification**

- All 19 dependency-free ego-extractor, runner, CLI, and controller tests passed in Windows Python.
- Confirmed the default environment configuration disables every configurable mistake termination.
- Confirmed building collisions remain non-terminal unless destination completion or horizon truncation occurs at the same step.
- Git whitespace checks pass, and prompt tracking retains exactly 10 entries.

### 2026-09-06 - Runtime Decision-Repeat Option

**User prompt**

User requested the ability to pass the needed configuration when launching the simulation, following discussion of using decision repeat to improve visual smoothness without changing the physics tick.

**Agent changes**

- Added the positive-integer `--decision-repeat` runner option with the existing value `5` as its default.
- Passed the selected value into MetaDrive environment configuration while leaving `physics_world_step_size` at `0.02 s`.
- Added CLI/configuration coverage and documented launcher examples, expected update rates, and timing behavior.
- Left the launcher implementation unchanged because it already forwards runner arguments verbatim.

**Files modified**

- `bridge/src/metadrive_runner/__main__.py`
- `bridge/tests/test_metadrive_runner.py`
- `bridge/scripts/README.md`
- `bridge/src/metadrive_runner/README.md`
- `docs/agents/plans/bridge/metadrive-runner.md`
- `docs/agents/working-context.md`
- `docs/verification/testing.md`
- `docs/agents/prompt-tracking.md`

**Verification**

- All 18 direct ego-extractor, runner, CLI, and controller test functions passed in Windows Python.
- Confirmed `--decision-repeat 2` builds a `0.04 s` environment step.
- The relocated launcher passed shell syntax and forwarded `--decision-repeat 2` unchanged.

### 2026-09-06 - Move Bridge Scripts Out Of Source Tree

**User prompt**

User requested moving the bridge helper scripts out of `bridge/src/` to make them more convenient to run.

**Agent changes**

- Moved the two Linux helper scripts and their README from `bridge/src/scripts/` to `bridge/scripts/`.
- Updated both scripts to resolve the repository root from their new directory depth.
- Updated active run commands, documentation links, the working-context resume command, and the desired project layout.

**Files modified**

- `bridge/scripts/`
- `bridge/README.md`
- `bridge/src/metadrive_runner/README.md`
- `docs/agents/working-context.md`
- `docs/temporary/desired_file_system.md`
- `docs/agents/prompt-tracking.md`

**Verification**

- Both relocated shell scripts passed `bash -n` in Git Bash.
- Launcher repository-root discovery and argument forwarding passed with `/usr/bin/echo` as a harmless interpreter stand-in.
- All 17 direct ego-extractor, runner, and controller test functions passed in Windows Python.
- Active documentation contains no stale `bridge/src/scripts` references, and Git whitespace checks pass.

### 2026-09-05 - Session Handoff After Timing Review

**User prompt**

User confirmed understanding of the MetaDrive timing model and requested context updates before ending the session.

**Agent changes**

- Recorded the accepted `0.02 s` physics tick, five-tick environment step, `0.1 s` step duration, and 10-step/50-tick real-time pacing model.
- Recorded the distinction between old MetaDrive `F` behavior and current runner-owned complete-step pacing.
- Preserved target-speed controller validation as the next runtime task.
- Confirmed no additional source implementation followed the timing discussion.

**Files modified**

- `docs/agents/working-context.md`
- `docs/agents/prompt-tracking.md`

**Verification**

- Confirmed the working-context resume point matches implemented runner behavior and current validation status.
- Confirmed prompt tracking retains exactly 10 entries.

### 2026-09-05 - Objective Paths And FPS Explanation

**User prompt**

User requested objective, portable directory wording throughout the documentation and an explanation of FPS behavior before and after runner-owned pacing.

**Agent changes**

- Established repository-relative paths from the repository root as the documentation convention.
- Removed active references to a specific username, drive letter, SSHFS editing path, and personal clone location.
- Rephrased current agent context and implementation status as objective validation gates.
- Added an implementation-based comparison of MetaDrive's per-physics-tick forced-FPS mode and the project's complete-environment-step pacing.
- Documented why identical displayed FPS values can represent different simulation-time rates.

**Files modified**

- `README.md`
- `docs/README.md`
- `docs/tools/tools.md`
- `docs/architecture/components/dashboard.md`
- `bridge/src/metadrive_runner/README.md`
- `docs/agents/working-context.md`
- `docs/agents/plans/bridge/metadrive-runner.md`
- `docs/agents/roadmap.md`
- `docs/agents/prompt-tracking.md`

**Verification**

- Checked active documentation for workstation-specific absolute paths and subjective current-status wording.
- Cross-checked the FPS explanation against MetaDrive `ForceFPS` and `BaseEngine.step()`.
- Confirmed prompt tracking retains exactly 10 entries.
- Checked Markdown for literal newline artifacts and Git whitespace errors.

### 2026-09-05 - Clarify Default Runner Timing

**User prompt**

After confirming how the runner behaves without an FPS argument, user asked to update the READMEs where needed.

**Agent changes**

- Added a runtime-mode table covering default rendered, unpaced rendered, default headless, and real-time headless execution.
- Clarified that the runner does not configure a fixed render FPS and no longer accepts `--force-render-fps`.
- Distinguished runner-owned environment-step pacing from Panda3D's unconstrained displayed/render throughput.
- Documented that the default timing produces `50` physics ticks and `10` extracted states per simulated second without requiring the displayed FPS counter to match either value.
- Synchronized the scripts guide with the same behavior.

**Files modified**

- `bridge/src/metadrive_runner/README.md`
- `bridge/src/scripts/README.md`
- `docs/agents/prompt-tracking.md`

**Verification**

- Cross-checked documented modes against `metadrive_runner.__main__`, runner pacing defaults, and `force_render_fps=None`.
- Confirmed the prompt tracker still contains exactly 10 entries.
- Checked Markdown for literal newline artifacts and Git whitespace errors.
