"""MetaDrive surrounding-object extraction."""

from __future__ import annotations

import math
from collections.abc import Iterable, Mapping
from typing import Any

from object_extraction.ego import EgoSnapshot
from object_extraction.surrounding.types import (
    SingleObjectSnapshot,
    SurroundingSnapshot,
)

_SUPPORTED_TYPES = {
    "VEHICLE",
    "PEDESTRIAN",
    "CYCLIST",
    "TRAFFIC_OBJECT",
    "TRAFFIC_CONE",
    "TRAFFIC_BARRIER",
}


def extract_surrounding(
    env: Any,
    ego_snapshot: EgoSnapshot,
    *,
    radius_m: float = 100.0,
) -> SurroundingSnapshot:
    """Collect eligible registry objects whose centers are within ``radius_m``."""
    radius = _valid_radius(radius_m)
    metadata = {
        "timestamp_monotonic_s": ego_snapshot.timestamp_monotonic_s,
        "radius_m": radius,
        "seed": ego_snapshot.seed,
        "episode_step": ego_snapshot.episode_step,
        "sim_time_s": ego_snapshot.sim_time_s,
    }
    ego_position = _finite_vector2(ego_snapshot.kinematics.position_m)
    ego_heading = _finite_float(ego_snapshot.kinematics.heading_rad)
    if ego_position is None or ego_heading is None:
        return SurroundingSnapshot(
            valid=False,
            errors=("usable ego position and heading are required",),
            **metadata,
        )

    try:
        registry = env.engine.get_objects()
    except Exception as exc:
        return SurroundingSnapshot(
            valid=False,
            errors=(f"MetaDrive object registry unavailable: {exc}",),
            **metadata,
        )
    if not isinstance(registry, Mapping):
        return SurroundingSnapshot(
            valid=False,
            errors=("MetaDrive object registry did not return a mapping",),
            **metadata,
        )

    ego_object = _read_attr(env, "agent")
    ego_name = _usable_identity(_read_attr(ego_object, "name"))
    ego_velocity = _finite_vector2(ego_snapshot.kinematics.velocity_mps)
    objects: list[SingleObjectSnapshot] = []
    errors: list[str] = []
    skipped = 0
    scanned = 0

    for registry_id, obj in registry.items():
        object_type = _semantic_type(obj)
        if object_type not in _SUPPORTED_TYPES:
            continue
        if obj is ego_object:
            continue
        object_id = _usable_identity(registry_id)
        if ego_name is not None and object_id == ego_name:
            continue

        scanned += 1
        if object_id is None:
            skipped += 1
            errors.append("eligible object skipped: unusable identity")
            continue
        position = _finite_vector2(_read_attr(obj, "position"))
        if position is None:
            skipped += 1
            errors.append(f"{object_id}: unusable position")
            continue

        world_delta = (position[0] - ego_position[0], position[1] - ego_position[1])
        distance = math.hypot(*world_delta)
        if distance > radius:
            continue
        relative_position = _rotate_world_to_ego(world_delta, ego_heading)
        velocity = _finite_vector2(_read_attr(obj, "velocity"))
        relative_velocity = None
        if velocity is not None and ego_velocity is not None:
            relative_velocity = _rotate_world_to_ego(
                (velocity[0] - ego_velocity[0], velocity[1] - ego_velocity[1]),
                ego_heading,
            )
        heading = _finite_float(_read_attr(obj, "heading_theta"))
        objects.append(
            SingleObjectSnapshot(
                object_id=object_id,
                object_type=object_type,
                world_position_m=position,
                world_velocity_mps=velocity,
                heading_rad=heading,
                length_m=_dimension(obj, "LENGTH"),
                width_m=_dimension(obj, "WIDTH"),
                height_m=_dimension(obj, "HEIGHT"),
                relative_position_m=relative_position,
                relative_velocity_mps=relative_velocity,
                relative_heading_rad=(
                    _normalize_angle(heading - ego_heading) if heading is not None else None
                ),
                distance_m=distance,
                bearing_rad=math.atan2(relative_position[1], relative_position[0]),
            )
        )

    objects.sort(key=lambda item: (item.distance_m, item.object_id))
    return SurroundingSnapshot(
        valid=True,
        degraded=bool(errors),
        objects=tuple(objects),
        skipped_count=skipped,
        scanned_count=scanned,
        errors=tuple(errors),
        **metadata,
    )


def _valid_radius(value: float) -> float:
    try:
        radius = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("radius_m must be a finite non-negative number") from exc
    if not math.isfinite(radius) or radius < 0:
        raise ValueError("radius_m must be a finite non-negative number")
    return radius


def _semantic_type(obj: Any) -> str | None:
    value = _read_attr(obj, "metadrive_type")
    if value is None:
        return None
    try:
        text = str(value)
    except Exception:
        return None
    return text if text else None


def _usable_identity(value: Any) -> str | None:
    if value is None:
        return None
    try:
        text = str(value)
    except Exception:
        return None
    return text if text.strip() else None


def _dimension(obj: Any, name: str) -> float | None:
    value = _finite_float(_read_attr(obj, name))
    return value if value is not None and value >= 0 else None


def _finite_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _finite_vector2(value: Any) -> tuple[float, float] | None:
    if isinstance(value, str | bytes) or value is None:
        return None
    if hasattr(value, "tolist"):
        value = value.tolist()
    if not isinstance(value, Iterable):
        return None
    try:
        items = tuple(value)
    except TypeError:
        return None
    if len(items) < 2:
        return None
    x = _finite_float(items[0])
    y = _finite_float(items[1])
    return None if x is None or y is None else (x, y)


def _read_attr(obj: Any, name: str) -> Any:
    if obj is None:
        return None
    try:
        value = getattr(obj, name)
    except Exception:
        return None
    if callable(value):
        try:
            return value()
        except Exception:
            return None
    return value


def _rotate_world_to_ego(
    vector: tuple[float, float], heading_rad: float
) -> tuple[float, float]:
    cosine = math.cos(heading_rad)
    sine = math.sin(heading_rad)
    return (
        cosine * vector[0] + sine * vector[1],
        -sine * vector[0] + cosine * vector[1],
    )


def _normalize_angle(angle_rad: float) -> float:
    return math.atan2(math.sin(angle_rad), math.cos(angle_rad))
