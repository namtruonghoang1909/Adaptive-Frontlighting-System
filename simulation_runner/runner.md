# Simulation Runner

Run all commands from the repository root on Linux.

## Requirements

- Python 3.10 or newer;
- Panda3D, MetaDrive, and MetaDrive assets matching the installed MetaDrive version;
- `DISPLAY` or `WAYLAND_DISPLAY` for rendered runs;
- FastAPI and Uvicorn when `--scene-display` or `--visualize` is used.

The scripts use this Python interpreter by default:

```text
simulation/metadrive/metadrive_venv/bin/python
```

Set `METADRIVE_PYTHON=/path/to/python` before a script to use another environment.
The launchers add `simulation_runner/src` to `PYTHONPATH` automatically.

## Main Scripts

| Script | Purpose |
|---|---|
| `simulation_runner/scripts/check_simulation_requirements.sh` | Check the selected mode's Python packages, MetaDrive assets, display environment, and optional scene-display packages without starting MetaDrive. |
| `simulation_runner/scripts/start_metadrive_simulation.sh` | Start the simulation and forward all runner arguments. |

Check the required resources:

```bash
bash simulation_runner/scripts/check_simulation_requirements.sh --rendered
bash simulation_runner/scripts/check_simulation_requirements.sh --headless
bash simulation_runner/scripts/check_simulation_requirements.sh \
  --headless --scene-display
```

Show the available checker or runner options:

```bash
bash simulation_runner/scripts/check_simulation_requirements.sh --help
bash simulation_runner/scripts/start_metadrive_simulation.sh --help
```

## Runner Arguments

| Argument | Default | Description |
|---|---:|---|
| `-h`, `--help` | - | Show runner help and exit. |
| `--headless` | off | Run without the MetaDrive window and use MetaDrive's IDM policy for the ego vehicle. |
| `--seed INTEGER` | `21` | Set the initial scenario seed. Completed episodes continue with the next seed. |
| `--map INTEGER` | `4` | Set the MetaDrive map block count. |
| `--traffic-density NUMBER` | `0.1` | Set traffic density from 0 through 1. |
| `--max-steps INTEGER` | `0` | Stop after this many total environment steps. `0` runs until interrupted. |
| `--print-every INTEGER` | `10` | Print every Nth step. Must be greater than zero. |
| `--decision-repeat INTEGER` | `3` | Set the number of `0.02 s` physics ticks per environment step. Must be greater than zero. |
| `--realtime` | rendered: on; headless: off | Pace environment steps to simulation time. |
| `--no-realtime` | rendered: off; headless: on | Run without runner-owned real-time pacing. |
| `--surrounding-radius-m NUMBER` | `100` | Set the surrounding-object center-to-center extraction radius in meters. |
| `--scene-display`, `--visualize` | off | Start the browser scene display. |
| `--scene-display-port INTEGER` | `8765` | Set the local scene-display port from 1 through 65535. |

## Run Examples

Rendered simulation:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh
```

Rendered simulation with the browser scene display at `http://127.0.0.1:8765`:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh --scene-display
```

Open the URL printed by the runner while it is active. The browser shows the
latest ego pose and supported surrounding traffic objects from MetaDrive's
object registry. Use `--headless --scene-display` for a browser-only run without
the MetaDrive window. Pass `--scene-display-port 8877` to change the local port.
The default surrounding collection radius is 100 m; browser zoom changes only
the visible range, not extraction.
MetaDrive's built-in LiDAR sensor and its rendered-window overlay remain enabled
in the simulator configuration, but project snapshots and the browser display
no longer contain LiDAR readings.

Finite headless run:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh \
  --headless --max-steps 100 --print-every 10
```

Headless, real-time run with the browser scene display:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh \
  --headless --realtime --visualize
```

Run with a chosen seed, extraction radius, and step interval:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh \
  --seed 42 --surrounding-radius-m 50 --decision-repeat 2
```

Use another scene-display port:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh \
  --scene-display --scene-display-port 8877
```

Use another Python environment:

```bash
METADRIVE_PYTHON=/path/to/python \
  bash simulation_runner/scripts/start_metadrive_simulation.sh \
  --headless --max-steps 10
```
