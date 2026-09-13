from __future__ import annotations

from dataclasses import FrozenInstanceError, replace

from object_extraction import EgoSnapshot, SceneSnapshot, SurroundingSnapshot


def matching_scene() -> SceneSnapshot:
    ego = EgoSnapshot(
        valid=True,
        timestamp_monotonic_s=12.5,
        seed=21,
        episode_step=4,
        sim_time_s=0.24,
    )
    surrounding = SurroundingSnapshot(
        valid=True,
        timestamp_monotonic_s=12.5,
        radius_m=100.0,
        seed=21,
        episode_step=4,
        sim_time_s=0.24,
    )
    return SceneSnapshot(ego=ego, surrounding=surrounding)


def test_scene_snapshot_requires_matching_components_and_is_immutable() -> None:
    scene = matching_scene()

    for changed in (
        replace(scene.surrounding, timestamp_monotonic_s=13.0),
        replace(scene.surrounding, seed=22),
        replace(scene.surrounding, episode_step=5),
        replace(scene.surrounding, sim_time_s=0.30),
    ):
        try:
            SceneSnapshot(ego=scene.ego, surrounding=changed)
        except ValueError:
            pass
        else:
            raise AssertionError("expected mismatched scene rejection")

    try:
        scene.ego = scene.ego  # type: ignore[misc]
    except FrozenInstanceError:
        pass
    else:
        raise AssertionError("scene snapshot should be frozen")

    assert scene.valid is True
    assert scene.degraded is False
