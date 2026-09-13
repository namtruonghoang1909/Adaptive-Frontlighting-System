"""Ego vehicle snapshot models."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from object_extraction.common import FrozenJSON, freeze_json_mapping, thaw_json


@dataclass(frozen=True, slots=True)
class EgoKinematicsSnapshot:
    """Current physical state of the MetaDrive ego vehicle."""

    speed_mps: float | None = None
    speed_kph: float | None = None
    position_m: tuple[float, ...] | None = None
    velocity_mps: tuple[float, ...] | None = None
    heading_rad: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "speed_mps": self.speed_mps,
            "speed_kph": self.speed_kph,
            "position_m": list(self.position_m) if self.position_m is not None else None,
            "velocity_mps": list(self.velocity_mps) if self.velocity_mps is not None else None,
            "heading_rad": self.heading_rad,
        }


@dataclass(frozen=True, slots=True)
class EgoActionSnapshot:
    """Current ego control state and latest applied action."""

    steering_normalized: float | None = None
    steering_deg: float | None = None
    max_steering_deg: float | None = None
    throttle_brake: float | None = None
    latest_applied_action: tuple[float, ...] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "steering_normalized": self.steering_normalized,
            "steering_deg": self.steering_deg,
            "max_steering_deg": self.max_steering_deg,
            "throttle_brake": self.throttle_brake,
            "latest_applied_action": (
                list(self.latest_applied_action) if self.latest_applied_action is not None else None
            ),
        }


@dataclass(frozen=True, slots=True)
class EgoDiagnosticsSnapshot:
    """Basic ego validity and crash/lane state from MetaDrive."""

    on_lane: bool | None = None
    lane_index: Any | None = None
    crash_vehicle: bool | None = None
    crash_object: bool | None = None
    crash_building: bool | None = None
    crash_sidewalk: bool | None = None
    out_of_route: bool | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "on_lane": self.on_lane,
            "lane_index": thaw_json(self.lane_index),
            "crash_vehicle": self.crash_vehicle,
            "crash_object": self.crash_object,
            "crash_building": self.crash_building,
            "crash_sidewalk": self.crash_sidewalk,
            "out_of_route": self.out_of_route,
        }


@dataclass(frozen=True, slots=True)
class EgoSnapshot:
    """One complete ego extraction sample."""

    valid: bool
    timestamp_monotonic_s: float
    kinematics: EgoKinematicsSnapshot = field(default_factory=EgoKinematicsSnapshot)
    action: EgoActionSnapshot = field(default_factory=EgoActionSnapshot)
    diagnostics: EgoDiagnosticsSnapshot = field(default_factory=EgoDiagnosticsSnapshot)
    errors: tuple[str, ...] = ()
    source: str = "metadrive"
    seed: int | None = None
    episode_step: int | None = None
    sim_time_s: float | None = None
    step_info: Mapping[str, FrozenJSON] = field(default_factory=dict)
    raw_state: Mapping[str, FrozenJSON] = field(default_factory=dict)

    def __post_init__(self) -> None:
        object.__setattr__(self, "errors", tuple(self.errors))
        object.__setattr__(self, "step_info", freeze_json_mapping(self.step_info))
        object.__setattr__(self, "raw_state", freeze_json_mapping(self.raw_state))

    def to_dict(self) -> dict[str, Any]:
        return {
            "valid": self.valid,
            "timestamp_monotonic_s": self.timestamp_monotonic_s,
            "kinematics": self.kinematics.to_dict(),
            "action": self.action.to_dict(),
            "diagnostics": self.diagnostics.to_dict(),
            "errors": list(self.errors),
            "source": self.source,
            "seed": self.seed,
            "episode_step": self.episode_step,
            "sim_time_s": self.sim_time_s,
            "step_info": thaw_json(self.step_info),
            "raw_state": thaw_json(self.raw_state),
        }
