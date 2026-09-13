"""Common immutable JSON-like data helpers."""

from __future__ import annotations

from collections.abc import Mapping
from enum import Enum
from types import MappingProxyType
from typing import Any, TypeAlias

JSONScalar: TypeAlias = str | int | float | bool | None
FrozenJSON: TypeAlias = JSONScalar | tuple["FrozenJSON", ...] | Mapping[str, "FrozenJSON"]


def freeze_json(value: Any) -> FrozenJSON:
    """Convert simulator values into immutable JSON-like values."""
    if isinstance(value, Enum):
        return freeze_json(value.value)
    if value is None or isinstance(value, str | int | float | bool):
        return value
    if isinstance(value, Mapping):
        return MappingProxyType({str(key): freeze_json(item) for key, item in value.items()})
    if hasattr(value, "tolist"):
        return freeze_json(value.tolist())
    if isinstance(value, tuple | list | set):
        return tuple(freeze_json(item) for item in value)
    if hasattr(value, "item"):
        try:
            return freeze_json(value.item())
        except (TypeError, ValueError):
            pass
    try:
        return float(value)
    except (TypeError, ValueError):
        return str(value)


def freeze_json_mapping(value: Mapping[str, Any] | None) -> Mapping[str, FrozenJSON]:
    """Freeze a mapping for storage inside immutable snapshots."""
    if value is None:
        return MappingProxyType({})
    frozen = freeze_json(value)
    if isinstance(frozen, Mapping):
        return frozen
    return MappingProxyType({})


def thaw_json(value: FrozenJSON) -> Any:
    """Return plain JSON-compatible containers for display/API output."""
    if isinstance(value, Mapping):
        return {key: thaw_json(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [thaw_json(item) for item in value]
    return value
