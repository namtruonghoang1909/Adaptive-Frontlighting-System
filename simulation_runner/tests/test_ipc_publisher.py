from __future__ import annotations

import json
import math
import os
from unittest.mock import patch

from ipc_adapter import publisher
from object_extraction import (
    EgoActionSnapshot,
    EgoKinematicsSnapshot,
    EgoSnapshot,
    SceneSnapshot,
    SingleObjectSnapshot,
    SurroundingSnapshot,
)


def _object(index: int, distance_m: float) -> SingleObjectSnapshot:
    return SingleObjectSnapshot(
        object_id=f"vehicle-{index}",
        object_type="VEHICLE",
        world_position_m=(distance_m, 0.0),
        world_velocity_mps=None,
        heading_rad=0.0,
        length_m=4.5,
        width_m=1.8,
        height_m=1.5,
        relative_position_m=(distance_m, -2.0),
        relative_velocity_mps=None,
        relative_heading_rad=0.0,
        distance_m=distance_m,
        bearing_rad=-0.1,
    )


def _scene(
    *,
    objects: tuple[SingleObjectSnapshot, ...] = (_object(7, 28.0),),
    ego_valid: bool = True,
    objects_valid: bool = True,
    degraded: bool = False,
) -> SceneSnapshot:
    timestamp = 123.5
    ego = EgoSnapshot(
        valid=ego_valid,
        timestamp_monotonic_s=timestamp,
        kinematics=EgoKinematicsSnapshot(
            velocity_mps=(3.0, 4.0), heading_rad=math.pi / 2
        ),
        action=EgoActionSnapshot(steering_deg=12.5),
        source="test",
        seed=21,
        episode_step=8,
        sim_time_s=0.48,
    )
    surrounding = SurroundingSnapshot(
        valid=objects_valid,
        timestamp_monotonic_s=timestamp,
        radius_m=100.0,
        objects=objects,
        degraded=degraded,
        source="test",
        seed=21,
        episode_step=8,
        sim_time_s=0.48,
    )
    return SceneSnapshot(ego=ego, surrounding=surrounding)


def test_scene_message_projects_ego_and_surrounding_fields() -> None:
    message = publisher.scene_message(_scene(), "session", 4, 123_500_000_000)

    assert message["protocol_version"] == 1
    assert message["type"] == "scene"
    assert message["sequence"] == 4
    assert message["sample"] == {
        "source": "test",
        "seed": 21,
        "episode_step": 8,
        "sim_time_s": 0.48,
    }
    assert message["ego"]["steering_deg"] == 12.5
    assert abs(message["ego"]["longitudinal_speed_mps"] - 4.0) < 1e-9
    assert message["quality"] == {
        "ego_valid": True,
        "objects_valid": True,
        "objects_degraded": False,
        "objects_truncated": False,
    }
    assert message["objects"] == [
        {
            "id": "vehicle-7",
            "type": "VEHICLE",
            "x_forward_m": 28.0,
            "y_left_m": -2.0,
            "length_m": 4.5,
            "width_m": 1.8,
            "relative_heading_rad": 0.0,
        }
    ]


def test_scene_message_keeps_nearest_objects_and_marks_truncation() -> None:
    objects = tuple(_object(index, float(200 - index)) for index in range(130))
    message = publisher.scene_message(
        _scene(objects=objects), "session", 9, 123_500_000_000
    )

    assert len(message["objects"]) == publisher.MAX_OBJECTS
    assert message["objects"][0]["id"] == "vehicle-129"
    assert message["objects"][-1]["id"] == "vehicle-2"
    assert message["quality"]["objects_degraded"] is True
    assert message["quality"]["objects_truncated"] is True


def test_scene_message_preserves_invalid_empty_scan_as_invalid() -> None:
    message = publisher.scene_message(
        _scene(objects=(), ego_valid=False, objects_valid=False, degraded=True),
        "session",
        10,
        123_500_000_000,
    )

    assert message["objects"] == []
    assert message["quality"]["ego_valid"] is False
    assert message["quality"]["objects_valid"] is False
    assert message["quality"]["objects_degraded"] is True
    assert message["quality"]["objects_truncated"] is False


def test_encoder_rejects_nonfinite_and_oversized_packets() -> None:
    for value in (math.nan, math.inf, -math.inf):
        try:
            publisher._encode({"value": value})
        except ValueError:
            pass
        else:
            raise AssertionError("nonfinite JSON value should be rejected")

    try:
        publisher._encode({"value": "x" * publisher.MAX_PACKET_BYTES})
    except ValueError:
        pass
    else:
        raise AssertionError("packet larger than the protocol limit should be rejected")


def test_default_socket_path_uses_override_runtime_dir_then_private_tmp() -> None:
    with patch.dict(os.environ, {"AFS_BRIDGE_SOCKET": "/tmp/custom.sock", "XDG_RUNTIME_DIR": "/run/user/42"}):
        assert publisher.default_socket_path() == "/tmp/custom.sock"
    with patch.dict(os.environ, {"XDG_RUNTIME_DIR": "/run/user/42"}, clear=True):
        assert publisher.default_socket_path() == "/run/user/42/afs/runner-bridge.sock"
    with patch.dict(os.environ, {}, clear=True), patch.object(publisher.os, "getuid", return_value=42):
        assert publisher.default_socket_path() == "/tmp/afs-42/runner-bridge.sock"
