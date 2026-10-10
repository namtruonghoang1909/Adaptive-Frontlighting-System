from __future__ import annotations

from threading import Event, Thread

from metadrive_runner.snapshot_store import (
    _clear_scene_snapshot,
    _write_scene_snapshot,
    get_ego_snapshot,
    get_scene_snapshot,
    get_surrounding_snapshot,
)
from object_extraction import EgoSnapshot, SceneSnapshot, SurroundingSnapshot


def scene(step: int) -> SceneSnapshot:
    timestamp = float(step)
    ego = EgoSnapshot(
        valid=True,
        timestamp_monotonic_s=timestamp,
        seed=21,
        episode_step=step,
        sim_time_s=step * 0.06,
    )
    surrounding = SurroundingSnapshot(
        valid=True,
        timestamp_monotonic_s=timestamp,
        radius_m=100.0,
        seed=21,
        episode_step=step,
        sim_time_s=step * 0.06,
    )
    return SceneSnapshot(ego=ego, surrounding=surrounding)


def test_snapshot_store_starts_empty_and_exposes_scene_components() -> None:
    _clear_scene_snapshot()
    assert get_scene_snapshot() is None
    assert get_ego_snapshot() is None
    assert get_surrounding_snapshot() is None

    current = scene(3)
    _write_scene_snapshot(current)

    assert get_scene_snapshot() is current
    assert get_ego_snapshot() is current.ego
    assert get_surrounding_snapshot() is current.surrounding

    _clear_scene_snapshot()
    assert get_scene_snapshot() is None


def test_snapshot_store_rejects_non_scene_values() -> None:
    _clear_scene_snapshot()
    try:
        _write_scene_snapshot(object())  # type: ignore[arg-type]
    except TypeError as exc:
        assert "SceneSnapshot" in str(exc)
    else:
        raise AssertionError("expected non-scene publication to fail")
    assert get_scene_snapshot() is None


def test_snapshot_store_replaces_complete_scenes_for_concurrent_readers() -> None:
    _clear_scene_snapshot()
    writer_done = Event()
    mismatches: list[tuple[int | None, int | None]] = []

    def writer() -> None:
        for step in range(500):
            _write_scene_snapshot(scene(step))
        writer_done.set()

    def reader() -> None:
        reads_after_completion = 0
        while not writer_done.is_set() or reads_after_completion < 10:
            current = get_scene_snapshot()
            if current is None:
                continue
            if writer_done.is_set():
                reads_after_completion += 1
            ego_step = current.ego.episode_step
            surrounding_step = current.surrounding.episode_step
            if ego_step != surrounding_step:
                mismatches.append((ego_step, surrounding_step))

    writer_thread = Thread(target=writer)
    reader_thread = Thread(target=reader)
    reader_thread.start()
    writer_thread.start()
    writer_thread.join()
    reader_thread.join()

    assert mismatches == []
    final = get_scene_snapshot()
    assert final is not None
    assert final.ego.episode_step == 499
    assert final.surrounding.episode_step == 499

    _clear_scene_snapshot()
