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

- `.gitignore`, `firmware/`, `scripts/`, `tools/test_components.sh`,
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
- Added `tools/test_components.sh` to run one component or all software suites,
  documented commands and coverage, and made component testing a code-change
  rule. Physical interface checks remain a separate hardware gate.

**Files modified**

- `firmware/tests/`, `dashboard/tests/`, `tools/test_components.sh`,
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

### 2026-10-25 - Configure OpenOCD For Four-Wire SWD

**User prompt**

User asked to fix the OpenOCD setup after confirming that the same STM32F4VE
board programs in STM32CubeIDE with SWDIO, SWCLK, GND, and 3.3 V VTref, without
an NRST wire, and requested the needed commands.

**Agent changes**

- Added a project-owned OpenOCD config that declares no external reset wire and
  uses Cortex-M software reset handling, while preserving the STM32F4 target setup and
  debug attach/detach handlers.
- Changed the ST-LINK check to reset, halt, and resume without programming flash.
- Made the flash wrapper select the same config and documented the behavior and
  commands.

**Files modified**

- `firmware/scripts/openocd_stm32f4_swd.cfg`, `firmware/scripts/check_stlink.sh`,
  `firmware/scripts/flash_firmware.sh`, `firmware/README.md`,
  `firmware/docs/hardware_check.md`, `docs/development.md`,
  `docs/hardware/wiring-draft.md`, `agents/working-context.md`, and
  `tools/system_visualization/code-graph/code-index.js`.

**Verification**

- Shell syntax, OpenOCD runner option parsing, source inventory freshness, graph
  validation, Markdown links/fences, and whitespace checks are recorded in the
  handoff. The current environment cannot access the USB probe, so the hardware
  reset/halt and flash sequence still needs to be run on the user's Ubuntu VM.
  No project test suites were run.

### 2026-10-25 - Build Firmware And Add Development Wrappers

**User prompt**

User asked to build the current firmware, then requested build and flash scripts
and a short set of common Zephyr development commands.

**Agent changes**

- Completed a pristine `black_f407ve` build from `firmware/afs_ecu/`; it
  produced `zephyr.elf`, `zephyr.hex`, and `zephyr.bin`.
- Added build and flash wrappers. Flash first runs the non-flashing ST-Link
  probe, then invokes `west flash` only if the target is reachable.
- Documented incremental/pristine builds, ccache override, menuconfig, debug,
  update, and flash commands.

**Files modified**

- `agents/prompt-tracking.md`, `agents/working-context.md`,
  `docs/development.md`, `docs/temporary/desired_file_system.md`,
  `firmware/README.md`, `firmware/docs/hardware_check.md`,
  `firmware/scripts/`, and `tools/system_visualization/code-graph/code-index.js`.

**Verification**

- The Zephyr build completed successfully. Shell syntax, Code graph inventory
  and validation, Markdown links/fences, and whitespace checks pass. No flash
  was attempted; the ST-LINK udev permission rule remains to be applied.

### 2026-10-25 - Organize The Zephyr Application Under afs_ecu

**User prompt**

User asked to group firmware application code under `firmware/afs_ecu/`, add
`firmware/docs/hardware_check.md`, and provide ST-Link check scripts. User chose
to keep the full Zephyr checkout and imported modules outside `afs_ecu/` so they
remain ignored dependencies.

**Agent changes**

- Moved the application CMake file, configuration, headers, and sources into
  `firmware/afs_ecu/`; kept the west manifest and Zephyr dependencies in their
  existing workspace locations.
- Added a non-flashing OpenOCD probe script and hardware-check guide, including
  the `LIBUSB_ERROR_ACCESS` udev fix found during diagnosis.
- Updated firmware build/flash guidance, project layout documentation, handoff,
  and firmware Code graph paths.

**Files modified**

- `README.md`, `agents/prompt-tracking.md`, `agents/working-context.md`,
  `docs/README.md`, `docs/architecture/components/afs-ecu.md`,
  `docs/development.md`, `docs/temporary/desired_file_system.md`, `firmware/`,
  and `tools/system_visualization/code-graph/`.

**Verification**

- Shell syntax, Code graph inventory and validation, Markdown links/fences, and
  whitespace checks are recorded in the handoff. No firmware build or project
  test suites were run; the OpenOCD probe remains blocked by USB permissions.

### 2026-10-25 - Detect USB-CAN Adapter In Linux VM

**User prompt**

User shared `lsusb` output showing the ST-LINK/V2 (`0483:3748`) and a
Geschwister Schneider CAN adapter (`1d50:606f`), then asked to continue without
waiting on `ip -brief link`.

**Agent changes**

- Confirmed the upstream Linux `gs_usb` driver lists USB ID `1d50:606f`.
- Updated the Linux command reference and workspace handoff to distinguish USB
enumeration from SocketCAN interface creation and physical bus validation.
- Physical CAN transmit/receive verification remains pending; this execution
environment cannot access the USB devices passed through to the user's VM.

**Files modified**

- `docs/temporary/linux_commands.md`, `agents/working-context.md`, and
  `agents/prompt-tracking.md`.

**Verification**

- Checked the upstream Linux kernel driver's USB ID table, Markdown links,
code fences, and whitespace. No project tests were run.
