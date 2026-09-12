# Simulation Runner Scripts

This directory contains exactly two Linux helpers for the current single-agent MetaDrive milestone.

| Script | Purpose |
|---|---|
| `check_metadrive.sh` | Check that MetaDrive and the project extraction modules can be imported. |
| `start_metadrive_simulation.sh` | Start the project-owned single-agent MetaDrive runner. |

Both scripts use this interpreter by default:

```text
simulation/metadrive/metadrive_venv/bin/python
```

## Check Libraries

Verify that MetaDrive, the project runner, and the vehicle extractor can be imported:

```bash
bash simulation_runner/scripts/check_metadrive.sh
```

A successful check prints the Python executable and the loaded paths for `metadrive`, `metadrive_runner`, and `vehicle_extract`. A missing interpreter or failed import returns a non-zero exit code.

## Start Single-Agent MetaDrive

Start the rendered single-agent simulation and ego extractor:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh
```

Runner arguments are forwarded unchanged:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh --seed 30
```

Select how many `0.02 s` physics ticks MetaDrive groups into each environment step:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh --decision-repeat 2
```

The default is `3`, producing a `0.06 s` step and approximately 16.7 rendered updates per simulated second. Values `1`, `2`, `4`, and `5` produce approximately 50, 25, 12.5, and 10 updates per simulated second. The launcher forwards this option to the runner without changing it.

A finite headless run uses the same script:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh \
  --headless --max-steps 100 --print-every 10
```

Rendered mode is paced to one `0.06 s` environment step per `0.06 s` of wall time. Use `--no-realtime` to disable this pacing. Headless mode is unpaced by default; add `--realtime` when a real-time headless source is required.

The launcher does not set render FPS. The runner no longer accepts `--force-render-fps`; rendered execution uses environment-step pacing while Panda3D rendering remains unconstrained.

Rendered runs start in expert mode. Press `T` for the project-owned target-speed keyboard mode; full controls and behavior are documented in the [runner README](../src/metadrive_runner/README.md).

Use `Ctrl+C` to stop an unlimited-length run.

## Different Python Interpreter

Set `METADRIVE_PYTHON` when the MetaDrive environment is elsewhere:

```bash
METADRIVE_PYTHON=/path/to/python \
  bash simulation_runner/scripts/check_metadrive.sh
```
