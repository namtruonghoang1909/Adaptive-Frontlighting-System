from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from object_extraction import (
    EgoActionSnapshot,
    EgoKinematicsSnapshot,
    EgoSnapshot,
    SceneSnapshot,
    SingleObjectSnapshot,
    SurroundingSnapshot,
)
from scene_display import SceneDisplayServer, create_app, scene_display_payload


def make_scene(
    *,
    timestamp: float = 10.0,
    objects: tuple[SingleObjectSnapshot, ...] | None = None,
    ego_valid: bool = True,
    surrounding_valid: bool = True,
    degraded: bool = False,
) -> SceneSnapshot:
    ego = EgoSnapshot(
        valid=ego_valid,
        timestamp_monotonic_s=timestamp,
        kinematics=EgoKinematicsSnapshot(
            speed_mps=5.0,
            speed_kph=18.0,
            position_m=(20.0, 30.0),
            velocity_mps=(5.0, 0.0),
            heading_rad=0.25,
        ),
        action=EgoActionSnapshot(
            steering_normalized=0.1,
            steering_deg=6.0,
            throttle_brake=0.4,
        ),
        errors=("ego unavailable",) if not ego_valid else (),
        seed=21,
        episode_step=3,
        sim_time_s=0.18,
        step_info={
            "control_mode": "target_speed",
            "target_speed_kph": 25.0,
            "private_simulator_value": "must not cross display boundary",
        },
        raw_state={"private_raw_value": "must not cross display boundary"},
    )
    surrounding = SurroundingSnapshot(
        valid=surrounding_valid,
        degraded=degraded,
        timestamp_monotonic_s=timestamp,
        radius_m=100.0,
        objects=objects if objects is not None else (make_object(),),
        scanned_count=4,
        skipped_count=1 if degraded else 0,
        errors=("one object skipped",) if degraded else (),
        seed=21,
        episode_step=3,
        sim_time_s=0.18,
    )
    return SceneSnapshot(ego=ego, surrounding=surrounding)


def make_object() -> SingleObjectSnapshot:
    return SingleObjectSnapshot(
        object_id="vehicle-7",
        object_type="VEHICLE",
        world_position_m=(35.0, 32.0),
        world_velocity_mps=(2.0, 1.0),
        heading_rad=0.4,
        length_m=4.5,
        width_m=1.8,
        height_m=1.5,
        relative_position_m=(15.0, -2.0),
        relative_velocity_mps=(-3.0, 1.0),
        relative_heading_rad=0.15,
        distance_m=15.13274595,
        bearing_rad=-0.13255153,
    )


def test_scene_display_payload_exposes_typed_current_scene_only() -> None:
    payload = scene_display_payload(make_scene(), now_monotonic_s=10.1)

    assert payload["schema_version"] == 2
    assert payload["mode"] == "live"
    assert payload["state"] == "live"
    assert abs(payload["age_s"] - 0.1) < 1e-9
    assert payload["scene"]["sample"] == {
        "source": "metadrive",
        "seed": 21,
        "episode_step": 3,
        "sim_time_s": 0.18,
    }
    assert payload["scene"]["ego"]["control"]["target_speed_kph"] == 25.0
    assert payload["scene"]["surrounding"]["objects"][0]["object_id"] == "vehicle-7"
    assert "lidar" not in payload["scene"]

    serialized = json.dumps(payload)
    assert "private_simulator_value" not in serialized
    assert "private_raw_value" not in serialized


def test_scene_display_payload_distinguishes_collection_states() -> None:
    assert scene_display_payload(None)["state"] == "waiting"
    assert scene_display_payload(
        make_scene(objects=()), now_monotonic_s=10.1
    )["state"] == "empty"
    assert scene_display_payload(
        make_scene(degraded=True), now_monotonic_s=10.1
    )["state"] == "degraded"
    assert scene_display_payload(
        make_scene(surrounding_valid=False), now_monotonic_s=10.1
    )["state"] == "invalid"
    assert scene_display_payload(make_scene(), now_monotonic_s=11.0)["state"] == "stale"


def test_scene_display_app_reads_latest_provider_value_per_request() -> None:
    if importlib.util.find_spec("fastapi") is None:
        return

    current: list[SceneSnapshot | None] = [None]
    app = create_app(snapshot_provider=lambda: current[0], clock=lambda: 10.1)
    endpoint = next(route.endpoint for route in app.routes if route.path == "/api/scene")

    waiting = json.loads(endpoint().body)
    assert waiting["state"] == "waiting"

    current[0] = make_scene()
    live = json.loads(endpoint().body)
    assert live["state"] == "live"
    assert live["scene"]["sample"]["episode_step"] == 3
    assert live["scene"]["surrounding"]["objects"][0]["object_id"] == "vehicle-7"


def test_scene_display_app_reports_provider_errors_without_stopping() -> None:
    if importlib.util.find_spec("fastapi") is None:
        return

    def fail() -> SceneSnapshot | None:
        raise RuntimeError("snapshot read failed")

    app = create_app(snapshot_provider=fail)
    endpoint = next(route.endpoint for route in app.routes if route.path == "/api/scene")
    payload = json.loads(endpoint().body)

    assert payload["schema_version"] == 2
    assert payload["state"] == "error"
    assert "snapshot read failed" in payload["error"]


def test_scene_display_assets_are_bundled_and_server_validates_ports() -> None:
    assets = Path(__file__).parents[1] / "src" / "scene_display" / "assets"
    assert "scene-canvas" in (assets / "index.html").read_text(encoding="utf-8")
    assert "lidar-canvas" not in (assets / "index.html").read_text(encoding="utf-8")
    assert "pollScene" in (assets / "app.js").read_text(encoding="utf-8")
    assert "drawLidar" not in (assets / "app.js").read_text(encoding="utf-8")
    assert (assets / "style.css").is_file()

    for port in (-1, 65536, True, 2.5):
        try:
            SceneDisplayServer(port=port)  # type: ignore[arg-type]
        except ValueError:
            pass
        else:
            raise AssertionError("expected invalid scene display port rejection")

    for stale_after in (0, -1, float("nan"), float("inf")):
        try:
            scene_display_payload(None, stale_after_s=stale_after)
        except ValueError:
            pass
        else:
            raise AssertionError("expected invalid stale threshold rejection")
