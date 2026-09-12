# MetaDrive Runner Plan

## Goal

Own the single-agent MetaDrive lifecycle under `simulation_runner/src/metadrive_runner/` and validate the ego extractor against real simulator state.

## Implementation

- `config.py` builds isolated interactive or headless environment configurations.
- `runner.py` resets, paces complete environment steps to monotonic deadlines, extracts, emits snapshots through a callback, renders the live overlay, advances seeds after genuine episode completion, and closes MetaDrive in `finally`.
- Crashes, road/route departure, and lane-line violations remain diagnostic events instead of terminating and respawning the ego vehicle. Route completion and horizon truncation still advance to the next seed.
- `__main__.py` provides rendered and finite headless CLI modes.
- Rendered mode injects the simulation-runner-owned `TargetSpeedKeyboardPolicy`, starts with expert auto-drive, and supports `T` toggling to persistent target-speed control.
- Manual `W/S` input latches a target speed regulated by PI throttle/brake control; `A/D` adjusts steering while held and automatically returns toward center after release, `C` centers immediately, and `Space` stops.
- Target changes are rates multiplied by simulation-step duration, making sensitivity independent of rendering throughput and decision-step configuration.
- Headless mode lazily installs MetaDrive's `IDMPolicy`.
- The callback is the future Python IPC-publisher integration point for the separate C++ gateway; the runner has no CAN dependency. Source is organized under `simulation_runner/`.

## Defaults

- Initial seed: `21`
- Physics tick: `0.02 s`
- Decision repeat: `3`
- Simulated interval per step: `0.06 s`
- Rendered pacing: one complete `0.06 s` environment step per approximately `0.06 s` wall time
- Runtime decision repeat: configurable with `--decision-repeat`; default `3`
- MetaDrive per-physics-tick FPS limiter: disabled
- Episode behavior: driving mistakes remain in the current episode; genuine completion/truncation resets using the next seed
- Console interval: every 10 simulation steps

## Testing

- Pure controller and fake-environment tests cover persistent speed targets, automatic steering centering, time-based rates, PI response, emergency stop, configuration isolation, reset/step extraction order, real-time deadlines, internal limiter disabling, next-seed continuation, global step limits, invalid snapshots, render gating, formatting, and guaranteed cleanup.
- Real validation uses the repository's Linux MetaDrive 0.4.3 environment in rendered and headless modes.

## Status

Implemented. Unit tests and CLI parsing pass. Environment-step pacing passed initial visual validation; the target-speed keyboard policy still needs validation in the rendered Linux runtime.
