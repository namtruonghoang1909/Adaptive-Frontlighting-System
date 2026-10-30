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

### 2026-10-30 - Add Test-Area Readmes

**User prompt**

User asked for a `README.md` inside each test component folder that explains what
its folders or files cover, with the CAN guide distinguishing bridge and ECU
tests.

**Agent changes**

- Added a README to every top-level test area, describing its module coverage
  and focused test command. The CAN README explicitly documents `bridge/` and
  `ecu/` ownership.
- Added a component-guide index to `tests/README.md` and a dedicated regression
  test requiring each top-level test area to keep its README.

**Files modified**

- `tests/*/README.md`, `tests/README.md`,
  `tests/test_runner/test_area_readmes.py`, `agents/working-context.md`, and
  `agents/prompt-tracking.md`.

**Verification**

- `bash tests/scripts/test_test_runner.sh` passes 7 tests, including the new
  check that every top-level test area has a README and the CAN guide covers
  both bridge and ECU tests.
- Local Markdown links and fenced blocks pass in 32 changed Markdown files. The Code graph
  inventory remains current at 281 nodes and its validator passes. `git diff --check`
  also passes. The curated AFS graph is unchanged because these additions
  document test ownership and do not change runtime code paths.

### 2026-10-30 - Scope Component Test Scripts And Root Test Runner

**User prompt**

User asked for a test script and guide for each component so they can test only
what changed instead of running the whole system each time. They clarified that
root `scripts/` should keep only one all-components test command, while focused
test scripts belong under `tests/scripts/`.

**Agent changes**

- Added component entrypoints for runner, bridge, Dashboard, firmware/ECU,
  visualization, CAN, Unix sockets, launchers, and test-runner checks under
  `tests/scripts/`; the root `scripts/test_all.sh` is the only all-suites command.
- Moved the shared component dispatcher from `tools/` to `tests/scripts/` and
  made it reject the `all` selector, so it runs one suite at a time.
- Added regression checks for root-script layout, focused help, invalid module
  routing, and safe dispatcher argument handling; documented the directory roles.

**Files modified**

- `tests/scripts/`, `scripts/test_all.sh`, `scripts/README.md`, `tests/launchers/`,
  `tests/test_runner/`,
  `README.md`, `docs/can/README.md`, `docs/development.md`,
  `docs/tools/tools.md`, `docs/verification/testing.md`, `tests/README.md`,
  `agents/README.md`, `agents/working-context.md`, `agents/prompt-tracking.md`,
  `bridge/README.md`, `dashboard/README.md`, `firmware/README.md`,
  `simulation_runner/README.md`, `tools/README.md`,
  `tools/system_visualization/README.md`, and the generated Code graph source
  inventory.

**Verification**

- `bash tests/scripts/test_launchers.sh` passes 9 tests and
  `bash tests/scripts/test_test_runner.sh` passes 5 tests. They confirm root
  `scripts/` has only `test_all.sh` among test commands, focused scripts live
  under `tests/scripts/`, and the dispatcher cannot invoke the full suite. No
  full-system suite was run for this scripts-only change.
- Shell syntax, source inventory freshness, Code graph validation, and
  `git diff --check` pass. The generated inventory has 278 nodes; the curated
  AFS behavior graph remains unchanged because these are test launchers, not
  runtime AFS paths.

### 2026-10-30 - Centralize Tests And Require Regression Coverage

**User prompt**

User asked to gather tests for every project component under the repository-root
`tests/` tree, organized by module, with a unified runner. They emphasized that
tests are as important as implementation because test results are their primary
way to validate changes.

**Agent changes**

- Moved project-owned tests, test CMake projects, and test-only smoke helpers
  from component folders into `tests/`, preserving component/module ownership.
- Rewired bridge and ECU CMake projects, fixed visualization tests to resolve
  component assets from their new location, and added module selectors and a
  regression test for the central tree and selector interface.
- Included the live headless CAN frame smoke in the bridge and full-system
  software gates. Pinned cantools 45.0.0 in `tests/requirements.txt`.
- Updated the test index, development and verification docs, component guides,
  system visualization notes, Code graph evidence, and agent coding rules.

**Files modified**

- `tests/`, `tests/scripts/test_components.sh`, `bridge/CMakeLists.txt`,
  `tests/can/ecu/can_service/CMakeLists.txt`, `tools/system_visualization/`,
  `agents/`, `docs/`, `README.md`, `bridge/README.md`, `dashboard/README.md`,
  `firmware/README.md`, `scripts/README.md`, `simulation_runner/README.md`,
  and `tools/README.md`.

**Verification**

- `bash tests/scripts/test_components.sh all` passes: runner 45, bridge CTest 7, CAN
  frame smoke with 144 DBC-checked frames, Dashboard 9, ECU host 5 plus Zephyr
  build, visualization 37 plus Code graph validation, launchers 4, and test
  runner 4. Unix socket tests ran with the required local socket permission.
- Shell syntax, `git diff --check`, source inventory freshness, and Code graph
  validation pass. Physical CAN and MCU checks remain outside host tests.

### 2026-10-30 - Document Launch Scripts And Result Observation

**User prompt**

User asked for guides describing what the current scripts start and how to
observe their results, and reported that the hardware is now available.

**Agent changes**

- Added a host launcher guide explaining the combined and standalone processes,
  terminal/window output, SocketCAN monitoring, controller-loopback limits,
  and the no-bus CAN frame smoke command.
- Added a firmware script guide for build, ST-Link check, flash, RTT, and ECU
  CAN-status observations; linked both guides from the script indexes.
- Recorded hardware availability and the next physical verification steps in
  the working context.

**Files modified**

- `scripts/README.md`, `scripts/guide.md`, `firmware/scripts/guide.md`,
  `firmware/README.md`, `docs/development.md`, `agents/working-context.md`,
  and `agents/prompt-tracking.md`.

**Verification**

- Relative Markdown links, fenced blocks, the ten-entry history limit, and
  `git diff --check` pass. No hardware commands are run from this environment.

### 2026-10-26 - Consolidate Firmware Workspace And Add Host Launchers

**User prompt**

User asked to keep Zephyr and ECU-related files under `firmware/`, then asked for
separate component start scripts and one script to start the host system.

**Agent changes**

- Moved the local west metadata and ignored Zephyr/module/tool checkouts into
  `firmware/`; moved the tracked manifest beside the ECU app and updated west
  configuration, ignore rules, and firmware wrappers.
- Added root launchers for the runner, bridge, Dashboard, and visualization, plus
  `scripts/start_system.sh` for bridge + Dashboard + MetaDrive with sibling
  shutdown. Added launcher checks and updated project/agent documentation.

**Files modified**

- `.gitignore`, `firmware/`, `scripts/`, `tests/scripts/test_components.sh`,
  `tools/system_visualization/code-graph/`, `README.md`, `docs/development.md`,
  `docs/verification/testing.md`, `docs/temporary/desired_file_system.md`, and
  `agents/`.

**Verification**

- West reports `firmware/` as the workspace root; manifest validation and `west list` resolve Zephyr, modules, and tools under that directory.
- Four launcher tests pass; the ECU suite passes five host cases and a clean STM32 build; visualization model tests and Code graph validation pass. Shell syntax and `git diff --check` pass.
- The old ignored build cache had an absolute Zephyr path from before relocation; after removing that generated cache, a pristine build succeeded with `--no-ccache`. No hardware was flashed or accessed.

### 2026-10-26 - Add Component Regression Suites

**User prompt**

User requested test cases for each project component and a repeatable test
command to run after changing a component.

**Agent changes**

- Added ECU host tests for CAN counters, frame validation, Dashboard command
  policy, freshness and fallback, and `0x500` status encoding. The ECU suite
  also builds the Zephyr image.
- Added headless Dashboard command and power/mode tests. Retained existing
  runner, bridge, Dashboard status, and visualization suites.
- Added `tests/scripts/test_components.sh` to run one component or all software suites,
  documented commands and coverage, and made component testing a code-change
  rule. Physical interface checks remain a separate hardware gate.

**Files modified**

- `firmware/tests/`, `dashboard/tests/`, `tests/scripts/test_components.sh`,
  `tools/system_visualization/code-graph/code-index.js`, component READMEs,
  `README.md`, `docs/development.md`, `docs/verification/testing.md`,
  `docs/tools/tools.md`, `tools/README.md`, `agents/README.md`,
  `agents/rules/coding.md`, `agents/working-context.md`, and
  `agents/prompt-tracking.md`.

**Verification**

- The unified `all` command passes: 45 runner tests, eight bridge CTest cases,
  nine Dashboard tests, five ECU host cases and an STM32 build, and 37
  visualization tests plus graph validation. Bridge IPC cases needed permitted
  Unix socket binding outside the execution sandbox.
- Interactive Code graph inspection could not run because the Snap Firefox
  launcher requires the unavailable `snapd.apparmor` service; the graph
  inventory and validator pass.
- Physical CAN/SWD/RTT and actuator behavior are not covered by host tests.

### 2026-10-26 - Document ECU RTT Setup And Startup

**User prompt**

User requested documentation explaining how to set up and start the RTT tool.

**Agent changes**

- Added a dedicated ECU RTT guide covering Zephyr SDK/OpenOCD and `nc`
  prerequisites, ST-Link checks, build/flash/start commands, expected output,
  local port override, and common failures.
- Linked the guide from the firmware, hardware-check, development, root, and
  docs-index pages, and corrected the docs-index firmware status.

**Files modified**

- `firmware/docs/rtt_debugging.md`, `firmware/README.md`,
  `firmware/docs/hardware_check.md`, `docs/development.md`, `docs/README.md`,
  `README.md`, `agents/working-context.md`, and `agents/prompt-tracking.md`.

**Verification**

- Documentation links, fenced command blocks, and whitespace checked. Hardware
  RTT output remains unverified in this environment.

### 2026-10-26 - Route ECU Diagnostics Through RTT

**User prompt**

User chose RTT for ECU diagnostics over the existing ST-Link SWD connection.

**Agent changes**

- Enabled Zephyr's SEGGER RTT console for the ECU's existing `printk` messages
  and disabled the UART console.
- Added `firmware/scripts/read_rtt.sh` to start the SDK OpenOCD RTT server and
  read channel 0 on a local terminal.
- Documented the build, flash, reader, and board-reset sequence; updated the
  Code graph's firmware descriptions.

**Files modified**

- `firmware/afs_ecu/prj.conf`, `firmware/scripts/read_rtt.sh`,
  `firmware/README.md`, `firmware/docs/hardware_check.md`, `README.md`,
  `docs/development.md`, `agents/working-context.md`,
  `agents/prompt-tracking.md`, and `tools/system_visualization/code-graph/`.

**Verification**

- A pristine Zephyr 3.7 `black_f407ve` build passes with RTT console enabled,
  UART console disabled, and the RTT control block in normal SRAM.
- Shell syntax passes. The reader cannot connect to the physical ST-Link in
  this environment; it reports OpenOCD's `open failed` error. Physical RTT
  output must be checked after flashing in the user's Ubuntu VM.
- Code inventory freshness, graph validation, JavaScript syntax, and whitespace
  checks pass. Firefox could not open the interactive viewer because the Snap
  launcher requires the unavailable `snapd.apparmor` service.

### 2026-10-26 - Implement STM32 ECU CAN Communication Slice

**User prompt**

User approved the AUTOSAR-inspired firmware structure and requested the first
STM32 CAN milestone: communication and status only, with outputs held at safe
fallback until actuator drivers exist. User selected a 200 ms Dashboard
command timeout and a modulo-16 alive-counter policy.

**Agent changes**

- Implemented Zephyr CAN2 receive and transmit abstraction, standard-frame RX
  queue, shared DBC decoding/packing, validation for `0x100`–`0x400`, RTE-style
  input/status storage, freshness supervision, and periodic `0x500` status.
  Rejected frames invalidate that input immediately; RX overflow drops queued
  backlog and invalidates every input until new frames arrive.
- Configured CAN2 for 500 kbit/s and kept outputs explicitly in
  `Safe_Default`, reporting beam/servo control unavailable.
- Documented timeouts: speed/steering 100 ms, object grid 250 ms, and valid
  Dashboard command 200 ms. Alive-counter deltas 1–8 are accepted; duplicates
  and deltas 9–15 are rejected; restart baseline is allowed after 500 ms with
  no accepted frame.
- Removed the obsolete standalone LED demo; the application loop keeps the
  board LED as a 500 ms heartbeat.
- Updated the project guides and synchronized the Code graph and ordered
  firmware communication path.

**Files modified**

- `firmware/afs_ecu/`, `firmware/README.md`,
  `firmware/docs/hardware_check.md`, `README.md`, `docs/architecture/`,
  `docs/can/`, `docs/development.md`, `docs/hardware/hardware.md`,
  `docs/temporary/desired_file_system.md`, `agents/roadmap.md`,
  `agents/working-context.md`, `agents/prompt-tracking.md`, and
  `tools/system_visualization/code-graph/`.

**Verification**

- Zephyr 3.7 `black_f407ve` firmware build passes; no project tests were run.
- Physical CAN transceiver wiring, flashing of this CAN image, and CAN bus
  receive/status exchange remain pending.
- Code inventory and graph validation pass. Interactive viewer inspection
  could not run because the Firefox Snap launcher refuses to start without the
  unavailable `snapd.apparmor` service.

### 2026-10-25 - Verify CAN Adapter And Bridge Loopback

**User prompt**

User confirmed that flashing succeeded and the board LED blinks, then provided
the USB-CAN adapter and bridge controller-loopback results.

**Agent changes**

- Updated project status to mark ST-Link flashing and the board LED as verified.
- Recorded that the Ubuntu VM detects the USB-CAN adapter as `can0` with
  `gs_usb`, accepts 500 kbit/s, and passes controller loopback; `candump` showed
  a TX echo and matching RX frame for `123#DEADBEEF`.
- Confirmed bridge frames `0x100`–`0x400` appear as matching TX/RX loopback
  entries with counters advancing at the configured periods. Signal values are
  fail-closed because no runner or Dashboard source was connected.
- Documented that the reported `ENOBUFS` warning still needs interface-counter
  diagnosis; physical-bus validation with an active peer remains pending.

**Files modified**

- `README.md`, `agents/roadmap.md`, `agents/working-context.md`,
- `agents/plan/feat-bridge-socketcan.md`,
  `docs/architecture/components/afs-ecu.md`,
  `docs/architecture/data-flow.md`, `docs/architecture/overview.md`,
  `docs/development.md`, `docs/hardware/hardware.md`,
  `docs/temporary/desired_file_system.md`, `docs/temporary/linux_commands.md`,
  `docs/verification/testing.md`, `firmware/README.md`,
  `firmware/docs/hardware_check.md`, and `agents/prompt-tracking.md`.

**Verification**

- The user confirmed adapter controller loopback and bridge `0x100`–`0x400`
  transmission through it. Physical bus exchange and diagnosis of the reported
  `ENOBUFS` warning remain pending. This execution environment cannot access
  the user's USB device or CAN netlink socket; no project test suites were run.
