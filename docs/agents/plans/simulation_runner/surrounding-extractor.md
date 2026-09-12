# Surrounding Extractor Plan

## Goal

Later extract relevant nearby-object data under `simulation_runner/src/vehicle_extract/surrounding/`.

## Planned Work

- Define immutable surrounding-object and surrounding-snapshot datatypes beside the extractor.
- Read object identity/type, relative position, relative velocity, presence, and freshness from MetaDrive-visible objects.
- Keep extraction independent from CAN packing and AFS behavior.
- Test filtering, ordering, coordinate conversion, and missing-object behavior with fakes.
- Keep detailed ADB mapping logic in a later implementation document.

## Status

Not implemented. Its directory currently contains only a placeholder note.
