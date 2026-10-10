"""Atomic scene snapshot composed from ego and surrounding extraction."""

from __future__ import annotations

from dataclasses import dataclass

from object_extraction.ego import EgoSnapshot
from object_extraction.surrounding import SurroundingSnapshot


@dataclass(frozen=True, slots=True)
class SceneSnapshot:
    """Ego and surrounding objects from the same simulator state."""

    ego: EgoSnapshot
    surrounding: SurroundingSnapshot

    def __post_init__(self) -> None:
        if self.ego.timestamp_monotonic_s != self.surrounding.timestamp_monotonic_s:
            raise ValueError("ego and surrounding timestamps must match")
        for field_name in ("source", "seed", "episode_step", "sim_time_s"):
            if getattr(self.ego, field_name) != getattr(self.surrounding, field_name):
                raise ValueError(f"ego and surrounding {field_name} values must match")

    @property
    def valid(self) -> bool:
        return self.ego.valid and self.surrounding.valid

    @property
    def degraded(self) -> bool:
        return bool(self.ego.errors) or self.surrounding.degraded

    @property
    def timestamp_monotonic_s(self) -> float:
        return self.ego.timestamp_monotonic_s
