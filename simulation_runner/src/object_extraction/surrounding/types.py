"""Immutable surrounding-object snapshot models."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class SingleObjectSnapshot:
    """One simulator object expressed in world and ego-relative coordinates."""

    object_id: str
    object_type: str
    world_position_m: tuple[float, float]
    world_velocity_mps: tuple[float, float] | None
    heading_rad: float | None
    length_m: float | None
    width_m: float | None
    height_m: float | None
    relative_position_m: tuple[float, float]
    relative_velocity_mps: tuple[float, float] | None
    relative_heading_rad: float | None
    distance_m: float
    bearing_rad: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "object_id": self.object_id,
            "object_type": self.object_type,
            "world_position_m": list(self.world_position_m),
            "world_velocity_mps": _list_or_none(self.world_velocity_mps),
            "heading_rad": self.heading_rad,
            "length_m": self.length_m,
            "width_m": self.width_m,
            "height_m": self.height_m,
            "relative_position_m": list(self.relative_position_m),
            "relative_velocity_mps": _list_or_none(self.relative_velocity_mps),
            "relative_heading_rad": self.relative_heading_rad,
            "distance_m": self.distance_m,
            "bearing_rad": self.bearing_rad,
        }


@dataclass(frozen=True, slots=True)
class SurroundingSnapshot:
    """A complete replacement scan of eligible objects around the ego vehicle."""

    valid: bool
    timestamp_monotonic_s: float
    radius_m: float
    objects: tuple[SingleObjectSnapshot, ...] = ()
    degraded: bool = False
    skipped_count: int = 0
    scanned_count: int = 0
    errors: tuple[str, ...] = ()
    source: str = "metadrive"
    seed: int | None = None
    episode_step: int | None = None
    sim_time_s: float | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "objects", tuple(self.objects))
        object.__setattr__(self, "errors", tuple(self.errors))

    def to_dict(self) -> dict[str, Any]:
        return {
            "valid": self.valid,
            "degraded": self.degraded,
            "timestamp_monotonic_s": self.timestamp_monotonic_s,
            "radius_m": self.radius_m,
            "objects": [item.to_dict() for item in self.objects],
            "skipped_count": self.skipped_count,
            "scanned_count": self.scanned_count,
            "errors": list(self.errors),
            "source": self.source,
            "seed": self.seed,
            "episode_step": self.episode_step,
            "sim_time_s": self.sim_time_s,
        }


def _list_or_none(value: tuple[float, float] | None) -> list[float] | None:
    return list(value) if value is not None else None
