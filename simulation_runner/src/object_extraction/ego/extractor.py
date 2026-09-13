"""MetaDrive ego vehicle extraction."""

from __future__ import annotations

import time
from collections.abc import Iterable, Mapping
from typing import Any

from object_extraction.common import freeze_json
from object_extraction.ego.types import (
    EgoActionSnapshot,
    EgoDiagnosticsSnapshot,
    EgoKinematicsSnapshot,
    EgoSnapshot,
)


def extract_ego(
    env: Any,
    step_info: Mapping[str, Any] | None = None,
    timestamp_monotonic_s: float | None = None,
) -> EgoSnapshot:
    """Extract the latest single-agent ego vehicle state from a MetaDrive env."""
    timestamp = time.monotonic() if timestamp_monotonic_s is None else timestamp_monotonic_s
    errors: list[str] = []
    ego = _get_ego(env, errors)

    if ego is None:
        return EgoSnapshot(
            valid=False,
            timestamp_monotonic_s=timestamp,
            errors=tuple(errors),
            step_info=dict(step_info or {}),
        )

    speed_mps = _read_float(ego, "speed", errors)
    speed_kph = _read_float(ego, "speed_km_h", errors)
    if speed_mps is None and speed_kph is not None:
        speed_mps = speed_kph / 3.6
    if speed_kph is None and speed_mps is not None:
        speed_kph = speed_mps * 3.6

    steering_normalized = _read_float(ego, "steering", errors)
    max_steering_deg = _read_float(ego, "max_steering", errors)
    steering_deg = None
    if steering_normalized is not None and max_steering_deg is not None:
        steering_deg = steering_normalized * max_steering_deg

    latest_action = _read_latest_action(ego, errors)

    raw_state = _read_raw_state(ego, errors)
    episode_step = _read_int(env, "episode_step")
    seed = _read_int(env, "current_seed")

    return EgoSnapshot(
        valid=True,
        timestamp_monotonic_s=timestamp,
        kinematics=EgoKinematicsSnapshot(
            speed_mps=speed_mps,
            speed_kph=speed_kph,
            position_m=_read_float_tuple(ego, "position", errors),
            velocity_mps=_read_float_tuple(ego, "velocity", errors),
            heading_rad=_read_float(ego, "heading_theta", errors),
        ),
        action=EgoActionSnapshot(
            steering_normalized=steering_normalized,
            steering_deg=steering_deg,
            max_steering_deg=max_steering_deg,
            throttle_brake=_read_float(ego, "throttle_brake", errors),
            latest_applied_action=latest_action,
        ),
        diagnostics=EgoDiagnosticsSnapshot(
            on_lane=_read_bool(ego, "on_lane"),
            lane_index=freeze_json(_read_value(ego, "lane_index")),
            crash_vehicle=_read_bool(ego, "crash_vehicle"),
            crash_object=_read_bool(ego, "crash_object"),
            crash_building=_read_bool(ego, "crash_building"),
            crash_sidewalk=_read_bool(ego, "crash_sidewalk"),
            out_of_route=_read_bool(ego, "out_of_route"),
        ),
        errors=tuple(errors),
        seed=seed,
        episode_step=episode_step,
        sim_time_s=_compute_sim_time_s(env, episode_step),
        step_info=dict(step_info or {}),
        raw_state=raw_state,
    )


def _get_ego(env: Any, errors: list[str]) -> Any | None:
    try:
        return env.agent
    except Exception as exc:
        errors.append(f"env.agent unavailable: {exc}")

    agents = _read_value(env, "agents")
    if isinstance(agents, Mapping):
        if "default_agent" in agents:
            return agents["default_agent"]
        if len(agents) == 1:
            return next(iter(agents.values()))
    errors.append("single-agent ego vehicle not found")
    return None


def _read_raw_state(ego: Any, errors: list[str]) -> dict[str, Any]:
    get_state = getattr(ego, "get_state", None)
    if not callable(get_state):
        return {}
    try:
        state = get_state()
    except Exception as exc:
        errors.append(f"ego.get_state failed: {exc}")
        return {}
    if isinstance(state, Mapping):
        return dict(state)
    errors.append("ego.get_state did not return a mapping")
    return {}


def _read_latest_action(ego: Any, errors: list[str]) -> tuple[float, ...] | None:
    action_queue = _read_value(ego, "last_current_action")
    if action_queue is None:
        return None
    try:
        latest = action_queue[-1]
    except Exception as exc:
        errors.append(f"ego.last_current_action unavailable: {exc}")
        return None
    return _to_float_tuple(latest)


def _read_float(obj: Any, name: str, errors: list[str]) -> float | None:
    value = _read_value(obj, name)
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        errors.append(f"{name} is not numeric: {exc}")
        return None


def _read_int(obj: Any, name: str) -> int | None:
    value = _read_value(obj, name)
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _read_bool(obj: Any, name: str) -> bool | None:
    value = _read_value(obj, name)
    if value is None:
        return None
    return bool(value)


def _read_float_tuple(obj: Any, name: str, errors: list[str]) -> tuple[float, ...] | None:
    value = _read_value(obj, name)
    if value is None:
        return None
    converted = _to_float_tuple(value)
    if converted is None:
        errors.append(f"{name} is not a numeric sequence")
    return converted


def _to_float_tuple(value: Any) -> tuple[float, ...] | None:
    if isinstance(value, str | bytes):
        return None
    if hasattr(value, "tolist"):
        value = value.tolist()
    if not isinstance(value, Iterable):
        return None
    try:
        return tuple(float(item) for item in value)
    except (TypeError, ValueError):
        return None


def _read_value(obj: Any, name: str) -> Any:
    try:
        value = getattr(obj, name)
    except Exception:
        return None
    if callable(value):
        try:
            return value()
        except TypeError:
            return value
        except Exception:
            return None
    return value


def _compute_sim_time_s(env: Any, episode_step: int | None) -> float | None:
    if episode_step is None:
        return None
    config = _read_value(env, "config")
    if not isinstance(config, Mapping):
        return None
    try:
        physics_step = float(config["physics_world_step_size"])
        decision_repeat = int(config["decision_repeat"])
    except (KeyError, TypeError, ValueError):
        return None
    return episode_step * physics_step * decision_repeat
