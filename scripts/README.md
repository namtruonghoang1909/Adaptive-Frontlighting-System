# Project Launch Scripts

`start_system.sh` starts the C++ bridge, the native Dashboard, and MetaDrive as
one host-side system. The bridge starts without CAN unless an existing,
configured interface is supplied. Each process uses its own root launcher, and
the system launcher stops the other host processes when one exits.

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

Firmware is not a Linux host process. The STM32 starts when powered after it is
flashed; use the build, flash, ST-Link, and RTT scripts in `firmware/scripts/`
for those operations. The Zephyr workspace, imported dependencies, SDK, build,
and ECU application all live under `firmware/`. `start_system.sh` never flashes
the board.
