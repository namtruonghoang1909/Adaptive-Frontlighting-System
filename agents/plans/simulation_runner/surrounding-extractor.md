# Surrounding Extractor Plan

## Goal

Extract nearby-object ground truth under `simulation_runner/src/object_extraction/surrounding/` without adding sensor, CAN, or lighting behavior.

## Implemented Contract

- Frozen `SingleObjectSnapshot` and `SurroundingSnapshot` datatypes plus the matching-pair `SceneSnapshot` datatype.
- Public MetaDrive registry scan for vehicles, pedestrians, cyclists, cones, barriers, and generic traffic objects within a configurable `100 m` center radius.
- World and ego-relative position/velocity, heading, available dimensions, distance, and bearing using x-forward/y-left ego axes.
- Deterministic distance/object-ID ordering, explicit invalid/degraded/empty states, skipped counts, and unavailable optional measurements represented by `None`.
- Fake-object tests for supported types, boundaries, ego exclusion, transforms, missing/non-finite data, disappearing objects, ordering, and immutability.

Runner publication and lock-protected latest-scene storage were added in the following simulation-runner milestone. IPC, CAN geometry compression, and AFS/ADB decisions remain later work.

## Status

Implemented as a standalone extraction API and integrated into every runner reset and step. Real rendered traffic comparison remains a manual verification item.
