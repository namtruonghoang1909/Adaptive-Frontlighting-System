"""MetaDrive configuration for the Python simulation runner."""

from __future__ import annotations

from collections.abc import Mapping
from copy import deepcopy
from typing import Any

DEFAULT_ENV_CONFIG: dict[str, Any] = {
    "use_render": True,
    # Rendered runs receive the project-owned keyboard policy during env creation.
    "manual_control": False,
    "traffic_density": 0.1,
    "num_scenarios": 10_000,
    "random_agent_model": False,
    "random_lane_width": True,
    "random_lane_num": True,
    # Driving mistakes remain observable diagnostics instead of ending the episode.
    "out_of_route_done": False,
    "out_of_road_done": False,
    "on_continuous_line_done": False,
    "on_broken_line_done": False,
    "crash_vehicle_done": False,
    "crash_object_done": False,
    "crash_human_done": False,
    "vehicle_config": {
        "show_lidar": True,
        "show_navi_mark": False,
        "show_line_to_navi_mark": False,
    },
    "map": 4,
    "start_seed": 10,
    "physics_world_step_size": 0.02,
    "decision_repeat": 3,
    # The runner owns wall-clock pacing. MetaDrive's per-tick limiter is disabled after reset.
    "force_render_fps": None,
}


def build_env_config(
    *,
    headless: bool = False,
    overrides: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Build an isolated MetaDrive config for interactive or headless execution."""
    config = deepcopy(DEFAULT_ENV_CONFIG)
    config["use_render"] = not headless

    if overrides:
        _deep_merge(config, overrides)

    config["manual_control"] = False
    config["force_render_fps"] = None
    _validate_config(config)
    return config


def _deep_merge(target: dict[str, Any], updates: Mapping[str, Any]) -> None:
    for key, value in updates.items():
        current = target.get(key)
        if isinstance(current, dict) and isinstance(value, Mapping):
            _deep_merge(current, value)
        else:
            target[key] = deepcopy(value)


def _validate_config(config: Mapping[str, Any]) -> None:
    try:
        physics_step = float(config["physics_world_step_size"])
        decision_repeat = int(config["decision_repeat"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("physics_world_step_size and decision_repeat must be numeric") from exc

    if physics_step <= 0:
        raise ValueError("physics_world_step_size must be greater than zero")
    if decision_repeat <= 0:
        raise ValueError("decision_repeat must be greater than zero")

    force_render_fps = config.get("force_render_fps")
    if force_render_fps is not None:
        try:
            render_fps = int(force_render_fps)
        except (TypeError, ValueError) as exc:
            raise ValueError("force_render_fps must be numeric or None") from exc
        if render_fps <= 0:
            raise ValueError("force_render_fps must be greater than zero or None")
