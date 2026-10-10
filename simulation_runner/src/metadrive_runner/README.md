# MetaDrive Runner

This package owns the single-agent MetaDrive lifecycle, driving controls, environment-step pacing, scene publication, render overlay, and command-line entry point.

## Scene Publication Flow

```text
validate runner arguments
  -> clear the retained scene from an earlier runner invocation
  -> construct and reset MetaDriveEnv
  -> take one monotonic timestamp
  -> extract EgoSnapshot
  -> extract SurroundingSnapshot with matching sample metadata
  -> validate and construct SceneSnapshot
  -> replace the process-local latest scene under a lock
  -> invoke the compatible ego-only on_snapshot callback
  -> optional scene_display reads the latest scene from its HTTP thread
  -> render the ego overlay when enabled
  -> repeat extraction/publication after every step and episode reset
  -> retain the final scene and close MetaDrive in finally
```

The immutable `SceneSnapshot` prevents mixed ego and surrounding metadata. Its constructor requires matching timestamp, source, seed, episode step, and simulation time. `RunnerSummary.invalid_snapshots` counts invalid ego or surrounding scenes.

## In-Process Read Interface

`snapshot_store.py` exposes:

```python
from metadrive_runner import (
    get_ego_snapshot,
    get_scene_snapshot,
    get_surrounding_snapshot,
)
```

Each function takes a short lock and returns the latest immutable object or `None`. Writers replace one complete `SceneSnapshot`; there is no history queue. Use `get_scene_snapshot()` when ego and surrounding data must come from the same sample. Separate component getter calls can observe different scenes if the runner publishes between those calls.

Write and clear functions are private to `metadrive_runner`. Other modules read snapshots through the public getters. This is an in-process interface; cross-process IPC remains future work.

`scene_display` is the first consumer of the interface. When enabled, it runs FastAPI/Uvicorn on a managed background thread while MetaDrive stays on the main thread. It polls the complete scene through `get_scene_snapshot()` and never reads the ego and surrounding components separately.

## Lifecycle And Controls

Rendered mode injects `TargetSpeedKeyboardPolicy`, starts in expert mode, and paces complete environment steps to simulated time. Headless mode uses MetaDrive's `IDMPolicy` and runs without pacing by default. MetaDrive's per-physics-tick FPS limiter and its `F` binding are disabled because the runner owns complete-step timing.

Driving mistakes remain diagnostic states instead of immediately respawning the ego vehicle. Destination arrival and horizon truncation advance to the next seed when the global step limit permits another episode.

| Key | Action |
|---|---|
| `T` | Toggle expert auto-drive and target-speed mode. |
| `W` / `S` | Raise / lower persistent target speed. |
| `A` / `D` | Adjust steering while held; release returns toward center. |
| `C` | Center steering immediately. |
| `Space` | Set target speed to zero and brake immediately. |
| `Ctrl+C` | Stop and close MetaDrive. |

Target and control changes are rates multiplied by simulation-step duration. A PI loop controls throttle/brake, and takeover initializes from the current vehicle state.

## Defaults

- initial seed: `21`;
- physics tick: `0.02 s`;
- decision repeat: `3`;
- environment step: `0.06 s`;
- terminal print interval: 10 steps;
- surrounding center radius: `100 m`;
- rendered pacing: enabled;
- headless pacing: disabled.

The requirements, scripts, runner arguments, and run examples are in [../../runner.md](../../runner.md).

## Verification

Fake-environment tests cover lifecycle ordering, scene metadata, scene retention, invalid-scene counting, radius validation, callback compatibility, timing, reset behavior, controls, render gating, cleanup, and concurrent store reads. A real finite headless run verifies the installed MetaDrive API and assets.
