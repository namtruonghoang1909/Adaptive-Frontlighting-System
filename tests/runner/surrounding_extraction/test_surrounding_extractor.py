from __future__ import annotations

import math
from dataclasses import FrozenInstanceError

from object_extraction.ego.types import EgoKinematicsSnapshot, EgoSnapshot
from object_extraction.surrounding import SingleObjectSnapshot, extract_surrounding


class FakeObject:
    def __init__(
        self,
        name: str,
        object_type: str,
        position: object,
        *,
        velocity: object = (0.0, 0.0),
        heading: object = 0.0,
        length: object = 4.0,
        width: object = 2.0,
        height: object = 1.5,
    ) -> None:
        self.name = name
        self.metadrive_type = object_type
        self.position = position
        self.velocity = velocity
        self.heading_theta = heading
        self.LENGTH = length
        self.WIDTH = width
        self.HEIGHT = height


class FakeEngine:
    def __init__(self, objects: dict[object, object]) -> None:
        self.objects = objects

    def get_objects(self) -> dict[object, object]:
        return self.objects


class FakeEnv:
    def __init__(self, ego: FakeObject, objects: dict[object, object]) -> None:
        self.agent = ego
        self.engine = FakeEngine(objects)


def ego_snapshot(*, heading: float = 0.0) -> EgoSnapshot:
    return EgoSnapshot(
        valid=True,
        timestamp_monotonic_s=12.5,
        seed=21,
        episode_step=4,
        sim_time_s=0.24,
        kinematics=EgoKinematicsSnapshot(
            position_m=(10.0, 20.0), velocity_mps=(1.0, 2.0), heading_rad=heading
        ),
    )


def test_extracts_supported_types_at_radius_boundary_and_orders_deterministically() -> None:
    ego = FakeObject("ego", "VEHICLE", (10.0, 20.0))
    objects = {"ego": ego}
    for index, object_type in enumerate(
        ("VEHICLE", "PEDESTRIAN", "CYCLIST", "TRAFFIC_OBJECT", "TRAFFIC_CONE", "TRAFFIC_BARRIER")
    ):
        distance = 100.0 if index == 0 else 10.0
        objects[f"object-{index}"] = FakeObject(
            f"object-{index}", object_type, (10.0 + distance, 20.0)
        )
    objects["road"] = FakeObject("road", "LANE_SURFACE_STREET", (11.0, 20.0))
    objects["building"] = FakeObject("building", "BUILDING", (12.0, 20.0))
    objects["far"] = FakeObject("far", "VEHICLE", (110.0001, 20.0))

    snapshot = extract_surrounding(FakeEnv(ego, objects), ego_snapshot())

    assert snapshot.valid is True
    assert snapshot.degraded is False
    assert len(snapshot.objects) == 6
    assert [item.object_id for item in snapshot.objects[:5]] == [
        "object-1", "object-2", "object-3", "object-4", "object-5"
    ]
    assert snapshot.objects[-1].object_id == "object-0"
    assert snapshot.objects[-1].distance_m == 100.0
    assert {item.object_type for item in snapshot.objects} == {
        "VEHICLE", "PEDESTRIAN", "CYCLIST", "TRAFFIC_OBJECT", "TRAFFIC_CONE", "TRAFFIC_BARRIER"
    }


def test_rotates_positions_velocities_and_relative_heading_into_ego_axes() -> None:
    ego = FakeObject("ego", "VEHICLE", (10.0, 20.0))
    other = FakeObject(
        "other", "VEHICLE", (10.0, 30.0), velocity=(3.0, 4.0), heading=math.pi
    )
    snapshot = extract_surrounding(
        FakeEnv(ego, {"ego": ego, "other": other}),
        ego_snapshot(heading=math.pi / 2),
    )

    item = snapshot.objects[0]
    assert isinstance(item, SingleObjectSnapshot)
    assert abs(item.relative_position_m[0] - 10.0) < 1e-9
    assert abs(item.relative_position_m[1]) < 1e-9
    assert item.relative_velocity_mps is not None
    assert abs(item.relative_velocity_mps[0] - 2.0) < 1e-9
    assert abs(item.relative_velocity_mps[1] + 2.0) < 1e-9
    assert abs(item.relative_heading_rad - math.pi / 2) < 1e-9
    assert abs(item.bearing_rad) < 1e-9


def test_missing_optional_values_are_none_and_bad_objects_degrade_scan() -> None:
    ego = FakeObject("ego", "VEHICLE", (10.0, 20.0))
    partial = FakeObject(
        "partial", "PEDESTRIAN", (12.0, 20.0), velocity=(math.nan, 0), heading=math.inf,
        length="bad", width=-1, height=None,
    )
    bad_position = FakeObject("bad", "VEHICLE", (math.nan, 2.0))
    snapshot = extract_surrounding(
        FakeEnv(ego, {"ego": ego, "partial": partial, "bad": bad_position, None: partial}),
        ego_snapshot(),
    )

    assert snapshot.valid is True
    assert snapshot.degraded is True
    assert snapshot.skipped_count == 2
    assert len(snapshot.errors) == 2
    item = snapshot.objects[0]
    assert item.world_velocity_mps is None
    assert item.relative_velocity_mps is None
    assert item.heading_rad is None
    assert item.relative_heading_rad is None
    assert item.length_m is None and item.width_m is None and item.height_m is None


def test_empty_scan_is_valid_and_each_scan_replaces_disappeared_objects() -> None:
    ego = FakeObject("ego", "VEHICLE", (10.0, 20.0))
    env = FakeEnv(ego, {"ego": ego, "one": FakeObject("one", "VEHICLE", (11.0, 20.0))})
    first = extract_surrounding(env, ego_snapshot())
    env.engine.objects = {"ego": ego}
    second = extract_surrounding(env, ego_snapshot())

    assert len(first.objects) == 1
    assert second.valid is True
    assert second.objects == ()


def test_registry_or_ego_pose_failure_is_invalid_and_snapshots_are_immutable() -> None:
    ego = FakeObject("ego", "VEHICLE", (0.0, 0.0))
    invalid_ego = EgoSnapshot(
        valid=False,
        timestamp_monotonic_s=3.0,
        kinematics=EgoKinematicsSnapshot(position_m=None, heading_rad=0.0),
    )
    invalid = extract_surrounding(FakeEnv(ego, {}), invalid_ego)
    assert invalid.valid is False

    env = FakeEnv(ego, {})
    del env.engine
    missing = extract_surrounding(env, ego_snapshot())
    assert missing.valid is False
    assert "registry unavailable" in missing.errors[0]
    try:
        missing.valid = True  # type: ignore[misc]
    except FrozenInstanceError:
        pass
    else:
        raise AssertionError("snapshot should be frozen")
