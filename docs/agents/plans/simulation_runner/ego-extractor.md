# Ego Extractor Plan

## Goal

Implement the first simulation-runner extraction module around the single MetaDrive ego vehicle.

## Location

`simulation_runner/src/vehicle_extract/ego/`

- `types.py` defines immutable ego snapshot dataclasses.
- `extractor.py` defines `extract_ego(env, step_info=None) -> EgoSnapshot`.
- `__init__.py` exposes the public ego-extraction API.

## Scope

- Read speed, steering, maximum steering, throttle/brake, position, velocity, heading, seed, episode step, and basic validity diagnostics.
- Keep extraction independent from MetaDrive lifecycle, shared memory, CAN packing, Dashboard transport, and AFS behavior.
- Return an invalid snapshot rather than crash when the active ego is unavailable.
- Use fake MetaDrive-like objects for unit tests.

## Status

Implemented and covered by focused tests. It is integrated with the MetaDrive runner through immutable snapshots; bridge IPC publishing remains a later milestone.
