"""Convert project snapshot datatypes into the scene display's JSON contract."""

from __future__ import annotations

import math
import time
from typing import Any

from object_extraction import SceneSnapshot


def scene_display_payload(
    scene: SceneSnapshot | None,
    *,
    stale_after_s: float = 0.5,
    now_monotonic_s: float | None = None,
) -> dict[str, Any]:
    """Return normalized display data without exposing simulator-owned mappings."""
    stale_after = _positive_finite(stale_after_s, "stale_after_s")
    if scene is None:
        return {
            "schema_version": 2,
            "mode": "live",
            "state": "waiting",
            "age_s": None,
            "stale_after_s": stale_after,
            "scene": None,
        }
    if not isinstance(scene, SceneSnapshot):
        raise TypeError("scene must be a SceneSnapshot or None")

    now = time.monotonic() if now_monotonic_s is None else float(now_monotonic_s)
    age_s = max(0.0, now - scene.timestamp_monotonic_s) if math.isfinite(now) else None
    if not scene.valid:
        state = "invalid"
    elif scene.degraded:
        state = "degraded"
    elif age_s is not None and age_s > stale_after:
        state = "stale"
    elif not scene.surrounding.objects:
        state = "empty"
    else:
        state = "live"

    ego = scene.ego
    surrounding = scene.surrounding
    return {
        "schema_version": 2,
        "mode": "live",
        "state": state,
        "age_s": age_s,
        "stale_after_s": stale_after,
        "scene": {
            "valid": scene.valid,
            "degraded": scene.degraded,
            "timestamp_monotonic_s": scene.timestamp_monotonic_s,
            "sample": {
                "source": ego.source,
                "seed": ego.seed,
                "episode_step": ego.episode_step,
                "sim_time_s": ego.sim_time_s,
            },
            "ego": {
                "valid": ego.valid,
                "errors": list(ego.errors),
                "kinematics": ego.kinematics.to_dict(),
                "action": ego.action.to_dict(),
                "diagnostics": ego.diagnostics.to_dict(),
                "control": {
                    "mode": _text_or_none(ego.step_info.get("control_mode")),
                    "target_speed_kph": _finite_or_none(
                        ego.step_info.get("target_speed_kph")
                    ),
                    "target_steering_normalized": _finite_or_none(
                        ego.step_info.get("target_steering_normalized")
                    ),
                },
            },
            "surrounding": {
                "valid": surrounding.valid,
                "degraded": surrounding.degraded,
                "radius_m": surrounding.radius_m,
                "objects": [item.to_dict() for item in surrounding.objects],
                "scanned_count": surrounding.scanned_count,
                "skipped_count": surrounding.skipped_count,
                "errors": list(surrounding.errors),
            },
        },
    }


def _positive_finite(value: float, name: str) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be finite and greater than zero") from exc
    if not math.isfinite(result) or result <= 0:
        raise ValueError(f"{name} must be finite and greater than zero")
    return result


def _finite_or_none(value: object) -> float | None:
    try:
        result = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _text_or_none(value: object) -> str | None:
    if value is None:
        return None
    try:
        text = str(value)
    except Exception:
        return None
    return text or None
