"""Single-agent MetaDrive lifecycle and ego extraction loop."""

from __future__ import annotations

import time
from collections.abc import Callable, Mapping
from copy import deepcopy
from dataclasses import dataclass
from typing import Any

from metadrive_runner.config import build_env_config
from vehicle_extract.ego import EgoSnapshot, extract_ego

SnapshotHandler = Callable[[EgoSnapshot], None]
EnvironmentFactory = Callable[[dict[str, Any]], Any]
Clock = Callable[[], float]
Sleeper = Callable[[float], None]


@dataclass(frozen=True, slots=True)
class RunnerSummary:
    """Summary returned when a finite runner invocation completes."""

    steps_completed: int
    episodes_started: int
    snapshots_emitted: int
    invalid_snapshots: int
    final_seed: int


def run_single_agent(
    *,
    env_config: Mapping[str, Any] | None = None,
    seed: int = 21,
    max_steps: int | None = None,
    on_snapshot: SnapshotHandler | None = None,
    env_factory: EnvironmentFactory | None = None,
    realtime: bool | None = None,
    clock: Clock = time.monotonic,
    sleeper: Sleeper = time.sleep,
) -> RunnerSummary:
    """Run MetaDrive and emit an ego snapshot after every reset and simulation step."""
    if max_steps is not None and max_steps < 0:
        raise ValueError("max_steps must be non-negative or None")

    config = deepcopy(dict(env_config)) if env_config is not None else build_env_config()
    pace_realtime = bool(config.get("use_render", False)) if realtime is None else realtime
    step_duration_s = _simulation_step_duration_s(config)
    current_seed = int(seed)
    factory = env_factory or _create_metadrive_env
    env = factory(config)

    steps_completed = 0
    episodes_started = 1
    snapshots_emitted = 0
    invalid_snapshots = 0

    def emit(snapshot: EgoSnapshot) -> None:
        nonlocal snapshots_emitted, invalid_snapshots
        snapshots_emitted += 1
        if not snapshot.valid:
            invalid_snapshots += 1
        if on_snapshot is not None:
            on_snapshot(snapshot)

    try:
        reset_info = _reset(env, current_seed)
        _disable_metadrive_fps_control(env)
        _enable_expert_takeover(env, config)
        snapshot = extract_ego(env, step_info=reset_info)
        emit(snapshot)
        _render(env, config, snapshot)
        next_step_deadline = clock()

        while max_steps is None or steps_completed < max_steps:
            if pace_realtime:
                next_step_deadline += step_duration_s
                _wait_until(next_step_deadline, clock, sleeper)

            _, _, terminated, truncated, info = env.step([0.0, 0.0])
            steps_completed += 1

            step_info = info if isinstance(info, Mapping) else {}
            snapshot = extract_ego(env, step_info=step_info)
            emit(snapshot)
            _render(env, config, snapshot)

            if bool(terminated) or bool(truncated):
                if max_steps is not None and steps_completed >= max_steps:
                    break

                current_seed = _next_seed(env, current_seed)
                reset_info = _reset(env, current_seed)
                episodes_started += 1
                _enable_expert_takeover(env, config)
                snapshot = extract_ego(env, step_info=reset_info)
                emit(snapshot)
                _render(env, config, snapshot)
                next_step_deadline = clock()
    finally:
        env.close()

    return RunnerSummary(
        steps_completed=steps_completed,
        episodes_started=episodes_started,
        snapshots_emitted=snapshots_emitted,
        invalid_snapshots=invalid_snapshots,
        final_seed=current_seed,
    )


def format_snapshot(snapshot: EgoSnapshot) -> str:
    """Format the core ego values as one compact terminal line."""
    position = snapshot.kinematics.position_m
    position_text = (
        "n/a"
        if position is None
        else "(" + ", ".join(_format_number(value, 2) for value in position) + ")"
    )
    errors = "none" if not snapshot.errors else "; ".join(snapshot.errors)
    target_speed_kph = _step_info_float(snapshot, "target_speed_kph")
    target_steering = _step_info_float(snapshot, "target_steering_normalized")
    return (
        f"seed={snapshot.seed} "
        f"step={snapshot.episode_step} "
        f"sim_s={_format_number(snapshot.sim_time_s, 2)} "
        f"speed_kph={_format_number(snapshot.kinematics.speed_kph, 2)} "
        f"steering={_format_number(snapshot.action.steering_normalized, 3)} "
        f"steering_deg={_format_number(snapshot.action.steering_deg, 2)} "
        f"target_speed_kph={_format_number(target_speed_kph, 1)} "
        f"target_steering={_format_number(target_steering, 3)} "
        f"position={position_text} "
        f"heading_rad={_format_number(snapshot.kinematics.heading_rad, 3)} "
        f"valid={snapshot.valid} "
        f"errors={errors}"
    )


def build_render_text(env: Any, snapshot: EgoSnapshot) -> dict[str, str]:
    """Build MetaDrive overlay text from the latest ego snapshot."""
    position = snapshot.kinematics.position_m
    position_text = (
        "n/a"
        if position is None
        else "(" + ", ".join(_format_number(value, 1) for value in position) + ")"
    )
    control_mode = snapshot.step_info.get("control_mode", "initializing")
    target_speed_kph = _step_info_float(snapshot, "target_speed_kph")
    target_steering = _step_info_float(snapshot, "target_steering_normalized")
    return {
        "Auto-Drive (Switch mode: T)": (
            "on"
            if bool(
                getattr(
                    getattr(env, "current_track_agent", None),
                    "expert_takeover",
                    False,
                )
            )
            else "off"
        ),
        "Control Mode": str(control_mode),
        "Target Speed": f"{_format_number(target_speed_kph, 1)} km/h",
        "Target Steering": _format_number(target_steering, 3),
        "Ego Speed": f"{_format_number(snapshot.kinematics.speed_kph, 1)} km/h",
        "Ego Steering": (
            f"{_format_number(snapshot.action.steering_normalized, 3)} "
            f"({_format_number(snapshot.action.steering_deg, 1)} deg)"
        ),
        "Ego Position": position_text,
        "Snapshot": (
            f"seed={snapshot.seed} step={snapshot.episode_step} "
            f"valid={snapshot.valid}"
        ),
    }


def _create_metadrive_env(config: dict[str, Any]) -> Any:
    try:
        from metadrive import MetaDriveEnv
        from metadrive.policy.idm_policy import IDMPolicy
    except ImportError as exc:
        raise RuntimeError(
            "MetaDrive is unavailable. Use the local simulation/metadrive Python "
            "environment or install simulation/metadrive in editable mode."
        ) from exc

    class BridgeMetaDriveEnv(MetaDriveEnv):
        def done_function(self, vehicle_id: str) -> tuple[bool, dict[str, Any]]:
            done, info = super().done_function(vehicle_id)
            return _suppress_unconfigurable_mistake_termination(done, info), info

    resolved_config = deepcopy(config)
    if resolved_config.get("use_render", False):
        from metadrive_runner.controls.metadrive_policy import TargetSpeedKeyboardPolicy

        resolved_config["manual_control"] = False
        resolved_config["agent_policy"] = TargetSpeedKeyboardPolicy
    elif "agent_policy" not in resolved_config:
        resolved_config["agent_policy"] = IDMPolicy
    return BridgeMetaDriveEnv(resolved_config)


def _suppress_unconfigurable_mistake_termination(
    done: bool,
    info: Mapping[str, Any],
) -> bool:
    """Keep building collisions non-terminal while preserving true episode completion."""
    if not done or not bool(info.get("crash_building", False)):
        return done
    if bool(info.get("arrive_dest", False)) or bool(info.get("max_step", False)):
        return done
    return False


def _reset(env: Any, seed: int) -> Mapping[str, Any]:
    reset_result = env.reset(seed=seed)
    if isinstance(reset_result, tuple) and len(reset_result) >= 2:
        info = reset_result[1]
        if isinstance(info, Mapping):
            return info
    return {}


def _enable_expert_takeover(env: Any, config: Mapping[str, Any]) -> None:
    if not config.get("use_render", False):
        return
    try:
        env.agent.expert_takeover = True
    except Exception:
        return


def _render(
    env: Any,
    config: Mapping[str, Any],
    snapshot: EgoSnapshot,
) -> None:
    if config.get("use_render", False):
        env.render(text=build_render_text(env, snapshot))


def _next_seed(env: Any, fallback_seed: int) -> int:
    try:
        return int(env.current_seed) + 1
    except (AttributeError, TypeError, ValueError):
        return fallback_seed + 1


def _disable_metadrive_fps_control(env: Any) -> None:
    engine = getattr(env, "engine", None)
    force_fps = getattr(engine, "force_fps", None)
    disable = getattr(force_fps, "disable", None)
    if callable(disable):
        disable()

    ignore = getattr(engine, "ignore", None)
    if callable(ignore):
        ignore("f")


def _simulation_step_duration_s(config: Mapping[str, Any]) -> float:
    try:
        duration_s = float(config["physics_world_step_size"]) * int(config["decision_repeat"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(
            "physics_world_step_size and decision_repeat must define a valid simulation step"
        ) from exc
    if duration_s <= 0:
        raise ValueError("simulation step duration must be greater than zero")
    return duration_s


def _wait_until(
    deadline_s: float,
    clock: Clock,
    sleeper: Sleeper,
) -> None:
    remaining_s = deadline_s - clock()
    if remaining_s > 0:
        sleeper(remaining_s)


def _format_number(value: float | None, precision: int) -> str:
    return "n/a" if value is None else f"{value:.{precision}f}"


def _step_info_float(snapshot: EgoSnapshot, key: str) -> float | None:
    value = snapshot.step_info.get(key)
    try:
        return None if value is None else float(value)
    except (TypeError, ValueError):
        return None
