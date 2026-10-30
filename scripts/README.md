# Project Launch Scripts

`start_system.sh` starts the C++ bridge, the native Dashboard, and MetaDrive as
one host-side system. The bridge starts without CAN unless an existing,
configured interface is supplied. Each process uses its own root launcher, and
the system launcher stops the other host processes when one exits.

For a step-by-step guide to each host launcher, its windows and terminal
output, and how to inspect IPC and CAN results, see [the launcher guide](guide.md).
Firmware build, ST-Link, flash, and RTT commands are covered in the
[firmware script guide](../firmware/scripts/guide.md). Root `scripts/` contains
project startup commands and one test command: `test_all.sh`. Focused component
test scripts live under [`tests/scripts/`](../tests/scripts/test_guide.md).

```bash
bash scripts/start_system.sh
bash scripts/start_system.sh --can-interface can0
```

Runner-specific options can follow `--`:

```bash
bash scripts/start_system.sh -- --headless --max-steps 100
```

Start one host component with its separate launcher:

```bash
bash scripts/start_runner.sh
bash scripts/start_bridge.sh --can-interface can0
bash scripts/start_dashboard.sh
bash scripts/start_visualization.sh
```

Use `bash scripts/test_all.sh` for the complete software test run. For a
focused component or module check, use the matching script under
`tests/scripts/`; the [test script guide](../tests/scripts/test_guide.md) lists
all entrypoints and module selectors.

Firmware is not a Linux host process. The STM32 starts when powered after it is
flashed; use the build, flash, ST-Link, and RTT scripts in `firmware/scripts/`
for those operations. The Zephyr workspace, imported dependencies, SDK, build,
and ECU application all live under `firmware/`. `start_system.sh` never flashes
the board.
