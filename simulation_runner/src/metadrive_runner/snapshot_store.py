"""Lock-protected latest scene storage for in-process runner consumers."""

from __future__ import annotations

from threading import Lock

from object_extraction import EgoSnapshot, SceneSnapshot, SurroundingSnapshot

_scene_snapshot_lock = Lock()
_latest_scene_snapshot: SceneSnapshot | None = None


def _write_scene_snapshot(snapshot: SceneSnapshot) -> None:
    """Replace the complete latest scene while holding the store lock."""
    if not isinstance(snapshot, SceneSnapshot):
        raise TypeError("snapshot must be a SceneSnapshot")

    global _latest_scene_snapshot
    with _scene_snapshot_lock:
        _latest_scene_snapshot = snapshot


def _clear_scene_snapshot() -> None:
    """Clear any scene retained from an earlier runner invocation."""
    global _latest_scene_snapshot
    with _scene_snapshot_lock:
        _latest_scene_snapshot = None


def get_scene_snapshot() -> SceneSnapshot | None:
    """Return the latest complete scene, or ``None`` before publication."""
    with _scene_snapshot_lock:
        return _latest_scene_snapshot


def get_ego_snapshot() -> EgoSnapshot | None:
    """Return the ego component of the latest scene, if available."""
    with _scene_snapshot_lock:
        scene = _latest_scene_snapshot
        return None if scene is None else scene.ego


def get_surrounding_snapshot() -> SurroundingSnapshot | None:
    """Return the surrounding component of the latest scene, if available."""
    with _scene_snapshot_lock:
        scene = _latest_scene_snapshot
        return None if scene is None else scene.surrounding
