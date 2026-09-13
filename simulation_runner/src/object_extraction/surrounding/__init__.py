"""Surrounding-object snapshot types and extraction."""

from object_extraction.surrounding.extractor import extract_surrounding
from object_extraction.surrounding.types import (
    SingleObjectSnapshot,
    SurroundingSnapshot,
)

__all__ = ["SingleObjectSnapshot", "SurroundingSnapshot", "extract_surrounding"]
