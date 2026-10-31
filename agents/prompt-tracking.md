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

### 2026-10-31 - Move Full Test Runner Into The Central Test Tree

**User prompt**

User asked to remove test runners from root `scripts/`, rename its `README.md`
to `dialogue.md` as the guide for scripts in that folder, remove the separate
start/check guides, and place `test_all.sh` under root `tests/`.

**Agent changes**

- Moved the full-suite entrypoint to `tests/test_all.sh` and updated its
  dispatcher path and usage text. Focused test commands remain under
  `tests/scripts/`.
- Renamed the root scripts guide to `scripts/dialogue.md`; removed
  `scripts/start.md` and `scripts/check.md`; updated launcher help and project
  documentation links.
- Updated the test tree and agent handoff notes to describe the new ownership.

**Files modified**

- `scripts/`, `tests/test_all.sh`, `tests/README.md`, `tests/launchers/`,
  `tests/scripts/`, `docs/`, `README.md`, `agents/`, and the Code graph source
  inventory.

**Verification**

- `bash tests/scripts/test_launchers.sh` passes all 34 launcher and test-entrypoint
  cases; `bash tests/scripts/test_test_runner.sh` passes all 7 central test-tree
  checks. Shell syntax, full-runner help, and public launcher help pass.
- Source inventory freshness and Code graph validation pass at 293 nodes. The
  curated AFS runtime graph remains unchanged because script organization does
  not change runtime behavior. Markdown links/fences and `git diff --check`
  pass. Hardware checks were not run.

### 2026-10-31 - Consolidate Root Start And Check Commands

**User prompt**

User asked for a single argument-driven `start.sh` and `check.sh`, with
`start.md` and `check.md` beside them. They chose two public dispatchers and
asked to group focused helper scripts under `boot_scripts/` and
`check_scripts/`.

**Agent changes**

- Added `scripts/start.sh COMPONENT [OPTIONS...]` for system, runner, bridge,
  Dashboard, SavvyCAN, and visualization startup. Moved its focused helpers to
  `scripts/boot_scripts/`.
- Added `scripts/check.sh CHECK [OPTIONS...]` for software/system readiness,
  read-only CAN adapter checks, CAN interface bring-up, and ST-Link-to-ECU
  reachability. Moved its focused helpers to `scripts/check_scripts/`.
- Kept `scripts/setup_system.sh` and `scripts/test_all.sh` as separate tasks.
  Added `scripts/start.md` and `scripts/check.md` with selectors, arguments,
  and hardware effects; updated project documentation and helper usage.
- Added mocked dispatcher tests for selector routing and argument forwarding.
  Updated the Code graph source paths for the moved startup helpers; its AFS
  runtime model and ordered AFS paths remain unchanged.

**Files modified**

- `scripts/start.sh`, `scripts/check.sh`, `scripts/boot_scripts/`,
  `scripts/check_scripts/`, `scripts/start.md`, `scripts/check.md`,
  `scripts/README.md`, `scripts/setup_system.sh`,
  `tests/launchers/test_launchers.py`, `tests/launchers/README.md`, `README.md`,
  `docs/development.md`, `docs/hardware/can_interface.md`, `docs/can/README.md`,
  `docs/errors/`, `docs/temporary/desired_file_system.md`, `dashboard/README.md`,
  `firmware/docs/hardware_check.md`, `agents/working-context.md`,
  `tools/system_visualization/code-graph/`, and `agents/prompt-tracking.md`.

**Verification**

- Shell syntax and Python compilation pass; the launcher suite passes 34 tests,
  including mocked argument forwarding. `bash scripts/check.sh system --headless`
  reports zero failures and three warnings here: no CAN adapter, no ST-Link, and
  missing `cantools` in this environment.
- Code inventory (294 nodes), Code graph validation and JavaScript syntax,
  changed Markdown links/fences, and `git diff --check` pass. The hardware
  reachability check was not run because OpenOCD resets and resumes the ECU.

### 2026-10-31 - Add Project Setup And Hardware Readiness Checks

**User prompt**

User requested setup and check scripts alongside the start scripts, and
clarified the hardware checks: CAN must confirm Linux recognized the USB
adapter and `can0` is online; ECU must confirm ST-Link presence and that it can
reach the STM32. Earlier in the same work, user renamed the interface
configuration helper to `can_interface_check.sh` and asked for component error
records under `docs/errors/`.

**Agent changes**

- Added `scripts/can_interface_check.sh`: it verifies the selected SocketCAN
  netdev, configures a down interface for 500 kbit/s normal mode, and leaves an
  already-up interface untouched. Its host-side tests use mocked `ip` and
  `sudo` commands.
- Added `scripts/check_can.sh` for read-only USB-backed SocketCAN recognition,
  UP state, bitrate, driver, and `ERROR-ACTIVE` checks. It fails if the USB
  parent cannot be confirmed. Added `scripts/check_system.sh` for host
  dependency checks, default read-only CAN/ST-Link visibility, and an explicit
  `--hardware` mode that runs OpenOCD reset/halt/resume to check ECU reachability.
- Added `scripts/setup_system.sh` to prepare selected runner, test, or firmware
  dependencies under ignored project-local directories. It does not call apt
  or sudo and provides `--dry-run`; firmware setup can download several GB.
- Added a `docs/errors/` index and troubleshooting pages for CAN, bridge, IPC,
  simulation runner, Dashboard, ECU firmware, ST-Link/OpenOCD, bench hardware, scripts,
  visualization, and tests. Recorded the observed CAN `ENOBUFS`, passive-bus,
  local-loopback/SavvyCAN, ECU `-11`/`-114`, USB permission, and target-halt
  symptoms while preserving uncertainty where the cause is not established.
- Linked the error index from the root and component documentation. Kept the
  detailed loopback, physical CAN, USB permission, and RTT procedures in their
  existing hardware guides and linked to them from the error records.

**Files modified**

- `scripts/can_interface_check.sh`, `scripts/README.md`, `scripts/guide.md`,
  `scripts/check_can.sh`, `scripts/check_system.sh`, `scripts/setup_system.sh`,
  `tests/launchers/test_launchers.py`, `docs/errors/`, component READMEs,
  `docs/README.md`, `docs/hardware/can_interface.md`, `firmware/docs/hardware_check.md`,
  `README.md`, `agents/working-context.md`, and `agents/prompt-tracking.md`.

**Verification**

- Launcher suite passes (31 tests), including eight mocked CAN configuration
  cases and eight mocked read-only CAN readiness cases, including rejection of
  a non-USB CAN interface. Runner (45), Dashboard
  (9), ECU host CAN (6), Zephyr build, CAN encoder (2), test-tree (7), and
  visualization (4 Node suites) checks pass. The full suite reaches bridge
  CTest but three Unix-socket cases fail because this execution environment
  denies socket binds (`Operation not permitted`); four other bridge CTests pass.
- Setup dry-runs pass for runner and firmware. The read-only system check passes
  software checks but reports absent CAN/ST-Link hardware and missing cantools
  in this execution environment. Code inventory (290 nodes), graph validation,
  shell syntax, documentation links/fences, and `git diff --check` pass. No
  OpenOCD hardware check was run because it resets and resumes the STM32.

### 2026-10-31 - Install And Bind Local SavvyCAN

**User prompt**

User asked to install SavvyCAN and bind its path to the project launcher.

**Agent changes**

- Downloaded the official SavvyCAN V220 x86-64 AppImage into the ignored local
  `.tools/savvycan/` directory and extracted it because this Ubuntu environment
  does not have `libfuse.so.2`.
- Updated `scripts/start_savvycan.sh` to find the extracted local `AppRun` after
  checking `PATH`; `SAVVYCAN_BIN` remains the explicit override.
- Added a launcher regression case and documented the local install and
  resolution order. No system-wide packages were changed.

**Files modified**

- `.gitignore`, `.tools/savvycan/`, `scripts/start_savvycan.sh`,
  `scripts/guide.md`, `scripts/README.md`, `tests/launchers/test_launchers.py`,
  `agents/working-context.md`, and `agents/prompt-tracking.md`.

**Verification**

- `bash -n scripts/start_savvycan.sh` and
  `bash tests/scripts/test_launchers.sh` pass; the launcher/test-script suite
  ran 13 tests. The AppImage runtime reports version `8bbf694`.
- The launcher resolves and invokes the local `AppRun`, but this command
  environment has no `DISPLAY`, so it cannot show the GUI. Interactive
  rendering and SocketCAN connection need checking from the Ubuntu desktop.
- The source inventory and graph validation pass. The curated AFS graph remains
  unchanged because the optional monitor does not participate in runtime AFS
  data flow. `git diff --check` passes.

### 2026-10-31 - Log Received ECU CAN Frames Over RTT

**User prompt**

User requested that the ECU print received CAN messages during the current
hardware testing phase.

**Agent changes**

- Added compile-time-controlled `CONFIG_AFS_CAN_RX_LOGGING`; the current bench
  configuration enables it and prints each dequeued frame's standard ID, DLC,
  and payload over RTT before the existing decoder runs.
- Kept formatting in a small pure function and added host regression coverage
  for data frames, remote frames, invalid input, and short buffers.
- Documented the expected RTT output and how to disable logging after bench
  testing; refreshed the Code graph inventory and ECU flow descriptions.

**Files modified**

- `firmware/afs_ecu/Kconfig`, `firmware/afs_ecu/CMakeLists.txt`,
  `firmware/afs_ecu/prj.conf`,
  `firmware/afs_ecu/include/afs/bsw/services/communication/can_rx_log.h`,
  `firmware/afs_ecu/src/bsw/services/communication/can_rx_log.c`,
  `firmware/afs_ecu/src/application/afs_ecu_application.c`,
  `firmware/README.md`, `firmware/scripts/guide.md`,
  `tests/can/ecu/can_service/CMakeLists.txt`,
  `tests/can/ecu/can_service/afs_ecu_logic_test.c`, `tests/can/README.md`,
  `tests/README.md`, `agents/working-context.md`,
  `agents/prompt-tracking.md`, and
  `tools/system_visualization/code-graph/`.

**Verification**

- `CCACHE_DISABLE=1 bash tests/scripts/test_firmware.sh` passes all six ECU
  host tests and builds the Zephyr `black_f407ve` target.
- Code graph inventory check and validation pass; changed JavaScript parses and
  `git diff --check` passes. Physical RTT/CAN output remains to be checked on
  the user's board.

### 2026-10-31 - Split ST-Link And CAN Hardware Guides

**User prompt**

User asked for two separate Markdown guides covering STM32 building/flashing
over ST-Link and CAN interface setup.

**Agent changes**

- Added `firmware/docs/stlink_build_flash.md` for firmware build options,
  non-flashing ST-Link checks, flashing, and expected results.
- Added `docs/hardware/can_interface.md` for adapter detection, bitrate and
  interface setup, loopback, bridge traffic, SavvyCAN, and physical bus checks.
- Kept the ST-Link hardware check focused on Linux USB access and SWD wiring;
  linked the focused guides from the project and component documentation.
- Removed duplicate CAN commands from the hardware overview and launcher
  guide, and updated references to the dedicated CAN guide.

**Files modified**

- `firmware/docs/stlink_build_flash.md`, `docs/hardware/can_interface.md`,
  `firmware/docs/hardware_check.md`, `firmware/README.md`,
  `docs/hardware/hardware.md`, `docs/README.md`, `docs/can/README.md`,
  `docs/development.md`, `docs/temporary/linux_commands.md`, `scripts/guide.md`,
  `firmware/scripts/guide.md`, `README.md`, `agents/working-context.md`, and
  `agents/prompt-tracking.md`.

**Verification**

- Changed Markdown links and fences pass; no references to the removed
  hardware-guide anchor remain. `git diff --check` passes.

### 2026-10-31 - Add Optional SavvyCAN Monitor Launcher

**User prompt**

User asked to integrate SavvyCAN into the CAN branch for CAN testing and chose
an optional standalone launcher with manual SocketCAN interface selection.
They also asked for the CAN interface bring-up command beside the hardware and
monitoring instructions.

**Agent changes**

- Added `scripts/start_savvycan.sh` to find SavvyCAN on `PATH` or through
  `SAVVYCAN_BIN`, print the project DBC path, and open the GUI without passing
  unsupported command-line arguments.
- Kept SavvyCAN separate from `scripts/start_system.sh`; users select SocketCAN
  and load the DBC inside the application.
- Documented the normal-mode bitrate setup and `sudo ip link set can0 up` step
  beside both the SavvyCAN instructions and hardware CAN bring-up section.
- Documented launch and connection steps and added launcher regression tests.
- Regenerated the Code graph source inventory. The curated AFS graph remains
  unchanged because SavvyCAN is an optional external monitor and does not alter
  the system runtime data or control path.

**Files modified**

- `scripts/start_savvycan.sh`, `scripts/README.md`, `scripts/guide.md`,
  `README.md`, `docs/can/README.md`, `docs/development.md`,
  `docs/hardware/hardware.md`, `tests/launchers/`,
  `agents/working-context.md`, `agents/prompt-tracking.md`, and
  `tools/system_visualization/code-graph/code-index.js`.

**Verification**

- `bash -n scripts/start_savvycan.sh` and
  `bash tests/scripts/test_launchers.sh` pass; the launcher suite ran 12 tests,
  including override, default command lookup, missing-executable, and help cases.
- `bash tests/scripts/test_test_runner.sh` passes 7 tests, and
  `bash tests/scripts/test_bridge.sh can socketcan` passes 1/1 conversion test.
- The source inventory is current at 282 nodes; graph validation and syntax
  checks pass. Documentation checks pass for 124 local links, fenced-code
  parity, and `git diff --check`.
- SavvyCAN is not installed in this execution environment, so its GUI and
  physical SocketCAN connection still need verification on the user's Linux
  machine.


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
