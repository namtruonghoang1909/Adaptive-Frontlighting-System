# Project Script Errors

No project setup/check launcher failure with a confirmed cause and resolution
is recorded here yet. For future entries, record the exact command and
arguments, current directory, return code, and complete output. Root scripts
start the host components, prepare project-local dependencies, or inspect
software/hardware readiness; firmware scripts build, flash, or inspect the ECU.

`setup_system.sh` never installs system packages. Use `--dry-run` before
firmware setup because west and the Zephyr SDK may download several gigabytes.
`scripts/check.sh system` performs read-only hardware visibility checks by default.
Its `--hardware` option runs `firmware/scripts/check_stlink.sh`, which uses
OpenOCD to reset, halt, and resume the STM32 without programming flash.

Run launcher regression tests with:

```bash
bash tests/scripts/test_launchers.sh
```

For read-only CAN checks, use `bash scripts/check.sh can [INTERFACE]`. For CAN
interface configuration and bring-up, use `bash scripts/check.sh can-up
[INTERFACE]`; see the [CAN errors](can_errors.md). For combined host startup,
see the [project scripts guide](../../scripts/dialogue.md).
