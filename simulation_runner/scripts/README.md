# Simulation Runner Scripts

Run these Linux helpers from the repository root.

| Script | Purpose |
|---|---|
| `check_simulation_requirements.sh` | Check Python, imports, MetaDrive assets, selected-mode display readiness, and optional scene-display dependencies without starting MetaDrive. |
| `start_metadrive_simulation.sh` | Start the runner and forward all command-line arguments unchanged. |

The scripts use `simulation/metadrive/metadrive_venv/bin/python` by default and add `simulation_runner/src` to `PYTHONPATH`.

```bash
bash simulation_runner/scripts/check_simulation_requirements.sh --rendered
bash simulation_runner/scripts/start_metadrive_simulation.sh
```

Run rendered MetaDrive with the live browser scene display:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh --scene-display
```

Open the scene display URL printed by the runner (`http://127.0.0.1:8765` by default).
Pass runner arguments after the script name to change the defaults, for example
`--traffic-density 0.6`, `--scene-display-port 8877`, or `--max-steps 100`.

For headless execution:

```bash
bash simulation_runner/scripts/check_simulation_requirements.sh --headless
bash simulation_runner/scripts/start_metadrive_simulation.sh \
  --headless --max-steps 100
```

Check and run the browser scene display:

```bash
bash simulation_runner/scripts/check_simulation_requirements.sh \
  --headless --scene-display
bash simulation_runner/scripts/start_metadrive_simulation.sh \
  --headless --realtime --scene-display
```

Set `METADRIVE_PYTHON=/path/to/python` to use another environment. Run the
checker separately before starting a rendered or browser-display session.

See [../runner.md](../runner.md) for requirements, runner arguments, and run examples.
