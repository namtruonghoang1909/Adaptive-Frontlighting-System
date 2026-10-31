# Project Scripts

This folder contains the public commands for starting host programs, checking
dependencies and hardware, and setting up local dependencies. Focused startup
and check implementations live in their matching subfolders.
Project test cases and test runners live under the repository-root `tests/`
directory; run the full suite with `bash tests/test_all.sh`.

## Public Commands

| Script | Purpose |
|---|---|
| [`start.sh`](start.sh) | Start the whole host system or one component. Pass a component name first, then its options. |
| [`check.sh`](check.sh) | Check system readiness, CAN, or ECU reachability; can also bring a detected CAN interface up. Pass a check name first. |
| [`setup_system.sh`](setup_system.sh) | Prepare project-local runner, test, or firmware dependencies. Supports `--dry-run`; never installs system packages. |

### Start Examples

```bash
bash scripts/start.sh system
bash scripts/start.sh system --can-interface can0
bash scripts/start.sh system -- --headless --max-steps 100
bash scripts/start.sh runner --headless --max-steps 100
bash scripts/start.sh bridge --can-interface can0
bash scripts/start.sh dashboard
bash scripts/start.sh savvycan
bash scripts/start.sh visualization
```

Use `bash scripts/start.sh --help` to list components. Arguments after the
component name are forwarded to its launcher. The `system` selector starts the
bridge, native Dashboard, and MetaDrive runner together. CAN is opt-in, and the
system launcher stops the other host processes if one exits.

### Check Examples

```bash
bash scripts/check.sh system
bash scripts/check.sh can
bash scripts/check.sh can-up
bash scripts/check.sh ecu
bash scripts/check.sh system --hardware
```

`system` checks host dependencies and reports hardware visibility. `can` is a
read-only check for a recognized USB SocketCAN adapter that is UP at 500 kbit/s
and `ERROR-ACTIVE`. `can-up` configures a detected down interface; it may use
`sudo`. `ecu` checks ST-Link USB and SWD reachability. OpenOCD resets, halts, and
resumes the STM32 for that check but does not flash it. `system --hardware`
checks both CAN readiness and ECU reachability. See the
[CAN hardware guide](../docs/hardware/can_interface.md),
[ST-Link guide](../firmware/docs/hardware_check.md), and
[script error log](../docs/errors/scripts_errors.md).

### Setup Example

```bash
bash scripts/setup_system.sh --component runner --dry-run
bash scripts/setup_system.sh --component tests
bash scripts/setup_system.sh --component firmware --dry-run
```

Supported setup components are `runner`, `tests`, `firmware`, and `all`.
Firmware setup can download and unpack several gigabytes, so review its dry-run
before running it without `--dry-run`.

## Script Directories

- [`boot_scripts/`](boot_scripts/) contains the component startup helpers used
  by `start.sh`.
- [`check_scripts/`](check_scripts/) contains the dependency and hardware check
  helpers used by `check.sh`.
- [`../tests/`](../tests/README.md) contains project tests, focused test
  commands, and the full-suite command `bash tests/test_all.sh`.
- [`../firmware/scripts/`](../firmware/scripts/guide.md) contains ECU build,
  flash, ST-Link, and RTT tools.
