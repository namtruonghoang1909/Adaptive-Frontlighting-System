# MetaDrive Runner

Project-owned single-agent MetaDrive lifecycle for running the simulator and validating the ego extractor.

This currently starts MetaDrive, driving controls, and ego extraction. The surrounding extractor is available as a separate API; runner integration and IPC publishing to the C++ bridge are not implemented.

## Data Flow

```text
build config
  -> construct MetaDriveEnv with project TargetSpeedKeyboardPolicy when rendered
  -> reset(seed)
  -> extract_ego(...)
  -> snapshot callback
  -> disable MetaDrive's per-physics-tick FPS limiter
  -> wait for the next simulated-time wall-clock deadline
  -> policy samples keys and computes steering plus throttle/brake
  -> step([0.0, 0.0]); custom policy supplies the rendered action
  -> extract_ego(..., step_info=info)
  -> snapshot callback and optional render overlay
  -> keep driving mistakes in the current episode
  -> reset with next seed after genuine completion/truncation
  -> close in finally
```

The CLI currently uses the snapshot callback to print data. The future IPC adapter will use the same callback to publish selected observations to the C++ bridge.

## Linux Setup

All commands in this guide use repository-relative paths and must be run from the repository root on Linux.

Verify that MetaDrive and the project extraction libraries are available:

```bash
bash simulation_runner/scripts/check_metadrive.sh
```

If the check reports that `metadrive_runner` or `object_extraction` is missing, install the simulation runner and its test dependency into that virtual environment once:

```bash
simulation/metadrive/metadrive_venv/bin/python -m pip install -e "./simulation_runner[dev]"
```

Editable installation makes `metadrive_runner` and `object_extraction` importable while source changes remain immediately visible. The two helper commands are described in the [scripts README](../../scripts/README.md).

Installation is optional. Every command below also works without it by prefixing the command with `PYTHONPATH=simulation_runner/src`.

## Run With Rendering

Start the interactive simulator:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh
```

For smoother visual updates while keeping the `0.02 s` physics tick unchanged, reduce the number of physics ticks grouped into each environment step:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh --decision-repeat 2
```

The launcher locates the repository and configures `PYTHONPATH`. The equivalent direct command is:

```bash
PYTHONPATH=simulation_runner/src \
simulation/metadrive/metadrive_venv/bin/python -m metadrive_runner
```

With the simulation runner installed, the equivalent entry-point command is:

```bash
simulation/metadrive/metadrive_venv/bin/afs-metadrive-runner
```

Rendered mode starts with expert auto-drive and real-time environment-step pacing enabled. MetaDrive's internal FPS limiter and `F` key binding are disabled because they render between physics ticks and can slow simulated time when the machine cannot sustain the requested rate.

No render FPS value is configured, and `--force-render-fps` is intentionally not a runner option. The runner controls when complete environment steps occur; Panda3D's displayed/render throughput remains unconstrained.

| Invocation | Simulation pacing | Rendering |
|---|---|---|
| No timing option | Real time: one `0.06 s` step per `0.06 s` wall time | Enabled, no fixed render FPS |
| `--no-realtime` | As fast as the machine allows | Enabled, no fixed render FPS |
| `--headless` | As fast as the machine allows | Disabled |
| `--headless --realtime` | Real time: one `0.06 s` step per `0.06 s` wall time | Disabled |

### Internal Limiter Versus Runner Pacing

MetaDrive's forced-FPS mode runs Panda's task manager between physics ticks. With `decision_repeat=3`, one `env.step()` advances three `0.02 s` physics ticks and can perform three rate-limited render-task updates. If the achieved task rate is `21 FPS`, simulation advances at approximately `21 x 0.02 = 0.42` simulated seconds per wall-clock second.

When forced-FPS mode is disabled, MetaDrive performs the three physics ticks first and runs the task manager once at the end of the environment step. Without external pacing, `21` complete environment steps per second would advance approximately `21 x 0.06 = 1.26` simulated seconds per wall-clock second even though the displayed task rate is still near `21 FPS`.

The project runner therefore disables MetaDrive's forced-FPS mode and schedules complete environment steps at `0.06 s` monotonic deadlines. This ties simulation time to wall time when each step finishes within its budget. The displayed FPS remains a rendering-performance measurement, not the simulation clock.

| Control | Action |
|---|---|
| `T` | Toggle expert auto-drive and target-speed control |
| `W` / `S` | Raise / lower the persistent target speed |
| `A` / `D` | Adjust steering while held; releasing returns it toward center |
| `C` | Center steering immediately |
| `Space` | Set target speed to zero and brake immediately |
| `Ctrl+C` | Stop the runner and close MetaDrive |

Releasing `W` or `S` leaves the target speed at its current value. Releasing `A` or `D` returns steering smoothly toward center. On switching from expert to manual mode, the controller starts from the vehicle's current speed, steering, and throttle to avoid an abrupt takeover. A PI loop adjusts throttle/brake to maintain target speed; fixed throttle alone would not maintain speed as vehicle load changes.

The default target-speed increase rate is `10 km/h/s`, while `S` lowers the target at `30 km/h/s`. Normalized steering changes at `0.5/s` while a steering key is held and returns toward center at `1.0/s` after release. Ordinary throttle changes are limited to `1.5/s`, while reductions toward braking can change at `4.0/s`; `Space` still applies full braking immediately. All rates are multiplied by simulation-step duration, so changing FPS or `decision_repeat` does not change their per-second sensitivity. The render overlay and terminal snapshots include actual and target values.

## Run Headless

Use the same launcher with headless and finite-step options to run without a graphical window:

```bash
bash simulation_runner/scripts/start_metadrive_simulation.sh \
  --headless --max-steps 100 --print-every 10
```

The equivalent direct command is:

```bash
PYTHONPATH=simulation_runner/src \
simulation/metadrive/metadrive_venv/bin/python -m metadrive_runner \
  --headless --max-steps 100 --print-every 10
```

Headless mode uses MetaDrive's `IDMPolicy` so speed and steering change without keyboard input. It runs as fast as the machine allows by default; pass `--realtime` when another wall-clock system must consume it at simulation speed.

A successful run ends with output similar to:

```text
runner complete: steps=100 episodes=1 snapshots=101 invalid=0 final_seed=21
```

The episode and snapshot counts can be higher if the route completes or MetaDrive truncates the episode before the step limit. Crashes, leaving the road or route, and crossing lane lines remain visible diagnostic states and do not respawn the ego vehicle. The important success condition is `invalid=0`.

## CLI Options

| Option | Default | Meaning |
|---|---:|---|
| `--headless` | off | Disable rendering and use IDM control |
| `--seed` | `21` | Initial MetaDrive scenario seed |
| `--max-steps` | `0` | Total steps across episodes; `0` runs until interrupted |
| `--print-every` | `10` | Print one snapshot every N episode steps |
| `--decision-repeat` | `3` | Number of `0.02 s` physics ticks grouped into each environment step |
| `--realtime` | rendered: on; headless: off | Pace each complete environment step to simulated time |
| `--no-realtime` | off | Disable environment-step pacing |

Show the command help with:

```bash
PYTHONPATH=simulation_runner/src \
simulation/metadrive/metadrive_venv/bin/python -m metadrive_runner --help
```

The default physics configuration remains `0.02 s` per physics tick with three ticks per environment step, giving `0.06 s` of simulated time per extracted step. In real-time mode, the runner uses monotonic deadlines so reset is displayed at wall time `0.0 s`, step 1 near `0.06 s`, step 2 near `0.12 s`, and so on. Extraction therefore runs at approximately `16.7 Hz` in wall time as well as simulated time.

`--decision-repeat` changes the number of ticks grouped into a step, not the duration of an individual physics tick. For example, `--decision-repeat 2` produces a `0.04 s` step and approximately 25 steps and rendered updates per simulated second.

This corresponds to `50` physics ticks and approximately `16.7` extracted environment states per simulated second. It does not require the displayed FPS counter to equal either value.

Rendering and extraction work are included inside that schedule. If a complete step takes longer than `0.06 s`, the runner cannot recover the lost performance and continues as fast as the machine allows.

## Run Unit Tests

Run all simulation-runner tests directly with pytest:

```bash
PYTHONPATH=simulation_runner/src \
simulation/metadrive/metadrive_venv/bin/python -m pytest simulation_runner/tests -v
```

Run only the MetaDrive runner tests:

```bash
PYTHONPATH=simulation_runner/src \
simulation/metadrive/metadrive_venv/bin/python -m pytest \
  simulation_runner/tests/test_metadrive_runner.py -v
```

Run only the target-speed controller tests:

```bash
PYTHONPATH=simulation_runner/src \
simulation/metadrive/metadrive_venv/bin/python -m pytest \
  simulation_runner/tests/test_vehicle_control.py -v
```

These tests use fake MetaDrive-like environments and a simulator-independent controller. They verify latched speed targets, automatic steering centering, time-based sensitivity, control limits, PI response, emergency braking, configuration merging, reset and step ordering, real-time deadlines, MetaDrive limiter disabling, step limits, rendering behavior, snapshot formatting, invalid snapshot counting, exceptions, `KeyboardInterrupt`, and guaranteed `env.close()`. They do not open Panda3D.

## Validate The Real Extractor

After unit tests pass, run the finite headless command and inspect the printed snapshots. Confirm that:

- `valid=True` and `errors=none`;
- `episode_step` increases;
- `sim_s` increases by approximately `0.06` per step with the default `decision_repeat=3`;
- `speed_kph`, steering, position, and heading are numeric;
- the final summary reports `invalid=0`.

Then run rendered mode, press `T`, and confirm that the speed target remains fixed after releasing `W/S`, steering returns toward zero after releasing `A/D`, and actual speed converges toward target speed. Check that overlay and terminal values agree.

## Exit Codes

| Code | Meaning |
|---:|---|
| `0` | Finite run completed without invalid snapshots |
| `1` | MetaDrive/runtime error or one or more snapshots were invalid |
| `130` | User stopped the runner with `Ctrl+C` |

When `run_single_agent(...)` is called as a library function, failures propagate after `env.close()` runs. The CLI converts `RuntimeError` into exit code `1` and `KeyboardInterrupt` into `130`.

## Troubleshooting

### `No module named metadrive`

Install the local MetaDrive checkout into its virtual environment:

```bash
simulation/metadrive/metadrive_venv/bin/python -m pip install -e simulation/metadrive
```

### `No module named metadrive_runner`

Either install the simulation runner with `pip install -e "./simulation_runner[dev]"` or include `PYTHONPATH=simulation_runner/src` in the command.

### `No module named pytest`

Install the simulation-runner development dependency:

```bash
simulation/metadrive/metadrive_venv/bin/python -m pip install -e "./simulation_runner[dev]"
```

### Rendering Cannot Open A Window

Run `--headless`, or execute rendered mode from a graphical Linux session with working display forwarding.
