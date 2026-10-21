# `feat/bridge/can-encoding` Checklist

## Goal And Scope

Convert the latest accepted runner IPC scene into in-memory CAN frames in the
C++ bridge. This branch should implement the pure encoding path for
`0x100 Vehicle_Speed`, `0x200 Vehicle_Steering`, and `0x300 Vehicle_Object`.
It should not open SocketCAN or send frames to `vcan0`/`can0`; transport and
`vcan0` integration follow in a later step. The ECU still owns swivel,
high-beam masking, actuator decisions, and fallback lighting.

`0x500 AFS_Status` receive/decode, `0x400 Dashboard_Command` generation,
Dashboard IPC, and firmware behavior are outside this branch's runtime scope.
The DBC can describe the full agreed message set, while implementation here
focuses on the three runner-derived transmit frames.

## Already Agreed

- [x] Runner-to-bridge Unix socket IPC and its process tests are implemented.
- [x] The bridge owns host-side CAN conversion; the Python runner sends scene
  observations and does not pack CAN frames.
- [x] `0x300` is one Classical CAN DLC 8 frame with ten 5-bit sector records:
  one occupancy bit and four cumulative subsector dimming bits per sector.
- [x] `0x300` has no grid sample counter. Byte 0 is reserved; `GridValid` is
  the source-grid freshness/validity gate, and the ECU's CAN receive timeout
  detects a missing frame stream. The ECU acts on the latest grid without
  comparing it to a previous grid.
- [x] Set a 100 ms ECU timeout for `0x100`, `0x200`, and `0x300` at the
  20 ms transmit period (five expected periods). Low validity flags make their
  source inputs unusable immediately; a missing accepted frame stream reaches
  timeout after 100 ms. A received `GridValid=0` frame clears the grid immediately.
- [x] Do not add application XOR checksums to `0x100` or `0x200`; reserve byte
  7 and rely on Classical CAN CRC. `0x300` also has no application checksum;
  `0x500` and `0x400` retain their documented XOR checksums.
- [x] If steering or speed exceeds its representable CAN field, clamp only to
  make the payload encodable, set its `Saturated` flag and clear its `Valid`
  flag. The ECU ignores the clamped value; `Saturated=1` with `Valid=1` is
  invalid.
- [x] Legal per-sector subsector patterns are only `0000`, `0001`, `0011`,
  `0111`, and `1111`. `0001` represents a vehicle farther than 75 m; nearer
  detections extend the mask so the subsectors above the vehicle are off.
- [x] Range-to-mask mapping is `>75 m: 0001`, `50–75 m: 0011`,
  `25–50 m: 0111`, and `0–25 m: 1111`. Combine masks from overlapping
  vehicles in one sector with bitwise OR; the nearer vehicle's stronger mask
  takes effect.
- [x] In the wire nibble, bit 0 represents the farthest subsector and bit 3
  the nearest. Thus the logical patterns `0001`, `0011`, `0111`, and `1111`
  have numeric values 1, 3, 7, and 15 respectively.
- [x] Use four equal distance bands across the 100 m detection range:
  `0 <= d < 25 m`, `25 <= d < 50 m`, `50 <= d < 75 m`, and
  `75 <= d <= 100 m`.
- [x] For horizontal sectors, use the full vehicle footprint and set every
  sector it overlaps.
- [x] For radial bands, use the full footprint and set every band it overlaps;
  crossing a threshold selects the stronger mask from the closer band.
- [x] Reuse the current visualization's 10-sector geometry as the bridge/ECU
  software contract: sector `00` is leftmost, far-field edges are about
  `±14.223°`, and edge cells extend to `±18°` through 30 m before blending to
  the far-field edges by 50 m. This remains uncalibrated geometry.
- [x] Include `VEHICLE` objects only in the first version. Pedestrians,
  cyclists, and static traffic objects are excluded for now.
- [x] If IPC reports object-list truncation, set `GridValid=0`,
  `ObjectListOverflow=1`, and transmit no sector mask. Truncated input is also
  marked degraded by the IPC contract.
- [x] Treat runner samples older than 250 ms as stale for all runner-derived
  CAN inputs: set `SteeringValid=0`, `SpeedValid=0`, and `GridValid=0`, and
  clear all `0x300` sector bits. This uses the runner-to-bridge IPC source-age
  limit.
- [x] On any detected input transfer, parse, validation, freshness, or
  perception-quality fault, set `GridValid=0` and transmit zero sector records.
  The ECU ignores the grid and enters fallback. A fresh accepted scene is
  required before the grid becomes valid again.
- [x] Expected IPC sequence gaps are allowed because the publisher may skip
  intermediate scenes; a gap alone does not invalidate the grid.
- [x] If `objects_valid=false`, set `GridValid=0` and clear sector bits. A
  fresh valid scan with no vehicles remains `GridValid=1` with an all-clear
  grid.
- [x] If `objects_degraded=true`, set `GridValid=0` and clear sector bits even
  when the object list was not truncated. Truncation additionally sets
  `ObjectListOverflow=1`.
- [x] For radial projection, compute the nearest Euclidean distance from ego
  to the full vehicle footprint and the farthest distance to its boundary.
  Clip the resulting range to 0–100 m and include every intersected band;
  footprints wholly outside that range contribute no sector records.
- [x] When `GridValid=0`, transmit zero sector records. Keep sending the
  invalid `0x300` grid frame so the ECU clears its active grid and enters fallback.
  Do not fall back on expected IPC sequence gaps; a fresh accepted scene is
  required after a detected fault.
- [x] `PerceptionDegraded=1` implies `GridValid=0`; the ECU rejects a frame
  that sets both `PerceptionDegraded=1` and `GridValid=1`.
- [x] Set `PerceptionDegraded` for object-scan or required-geometry quality
  faults only; transport, parse, and freshness faults alone do not set it.
  `ObjectListOverflow` specifically identifies runner-side candidate drops at
  the configured object-list limit.

## Checklist

### 1. Close The Encoding Contract

- [x] If a relevant vehicle lacks usable length, width, or relative heading,
  invalidate the entire grid, zero all sector records, and trigger ECU fallback
  until a fresh complete scene arrives.
- [x] Confirm wire bit order for the cumulative mask: bit 0 is farthest and
  bit 3 is nearest, matching the agreed logical pattern values.
- [x] For `0x200`, preserve the `steering_deg` sign received from MetaDrive
  IPC; do not invert or normalize it in the bridge. ECU left/right
  interpretation follows the same source convention.
- [x] Use the active MetaDrive `max_steering_deg` as the `0x200` accepted
  steering-angle limit (`±max_steering_deg`); do not impose a separate fixed
  angle limit in the CAN contract.
- [x] Extend runner IPC with the active `ego.max_steering_deg`, then validate
  `steering_deg` against it in the bridge. A missing limit remains unavailable
  for CAN validity handling; the receiver no longer uses a fixed `±90°` check.
- [x] Do not use steering rate for the agreed swivel input; reserve byte 3 of
  `0x200` and transmit zero. The ECU uses steering angle and vehicle speed for
  the current swivel behavior.
- [x] Carry the runner's signed `ego.longitudinal_speed_mps` in `0x100` and
  eliminate the `VehicleReverse` bit; negative speed represents reverse, and
  byte 0 bit 6 becomes reserved.
- [x] Encode `LongitudinalSpeedMps` as signed int16 little-endian at
  `0.01 m/s/bit` (`-327.68..+327.67 m/s`).
- [x] Omit acceleration from `0x100` and reserve byte 3; the current swivel
  behavior needs signed speed, not acceleration.
- [x] Increment `0x100` and `0x200` `AliveCounter` on every transmitted frame,
  including invalid data and repeated source samples; roll over from 15 to 0.
- [x] Remove `GridSampleCounter`; keep `GridValid` as the source-grid freshness
  and validity gate and use the ECU CAN receive timeout for link loss.
- [x] Add an explicit invalid-grid/fault state so malformed, oversized, stale,
  or otherwise rejected IPC scenes invalidate `0x300` even while the last
  accepted scene remains available for diagnostics. The IPC receiver latches
  detected packet, parse, freshness, and disconnect faults until a fresh scene.
- [x] Reconcile byte order, scaling, saturation, validity, reserved-bit, and
  transmit-period details across the three message specs. The checksum choice
  is agreed: `0x100`, `0x200`, and `0x300` have no application checksum.

### 2. Add The CAN Schema And Pure Codec

- [x] Add the CANdb++ compatible DBC at `bridge/can/afs.dbc` and check
  that signal names, IDs, DLCs, scaling, enums, and bit positions match the
  Markdown docs.
- [x] Choose and document the DBC-to-C codec generation workflow: run cantools
  when the DBC changes, check the generated C files into
  `bridge/src/can/generated/`, and compile them into the gateway without a
  Python runtime or build-time dependency.
- [x] Add a transport-independent signal-value interface and validation/
  projection layer under `bridge/include/afs_bridge/` and `bridge/src/can/`.
  It validates steering/speed freshness and range, quantizes them to the
  agreed DBC resolution, advances alive counters, and projects complete
  vehicle footprints into the 10-sector grid.
- [x] Add the frame interface and convert validated values through the
  DBC-generated C signal encoders and message packers into the `0x100`,
  `0x200`, and complete `0x300` payloads. Preserve reserved zeros; these
  messages do not use application checksums.
- [x] Ensure stale or invalid source data produces invalid signal values and
  a zeroed invalid grid. A fresh valid empty object list produces a valid
  all-clear grid.
- [x] Keep CAN I/O, transmission scheduling, SocketCAN setup, and hardware
  configuration out of this branch.

### 3. Verify The Encoders

- [x] Add unit tests for source validity, CAN-range saturation, alive-counter
  rollover, grid quality flags, full-footprint sectors, and radial masks.
- [ ] Add unit tests for the documented golden payloads, including the
  `0x300` example `00 01 00 7C 00 C0 00 00`.
- [ ] Test signed and scaled steering values, speed/reverse conversion,
  out-of-range saturation with validity cleared, alive-counter rollover, and
  reserved bytes (including
  byte 7 staying zero on `0x100` and `0x200`).
- [ ] Test `0x300` packing for all ten sectors and each legal cumulative mask,
  overlapping vehicles and sectors, band-boundary cases, valid-empty grids,
  degraded/truncated input, and invalid/stale input.
- [ ] Add a bridge-level test that supplies a synthetic accepted IPC scene and
  inspects the produced frame values without a CAN interface.
- [x] Add and run an optional finite headless MetaDrive smoke check that logs
  representative in-memory frames, verifies every batch with the generated C
  unpackers, and independently cross-checks every captured frame with cantools
  against `bridge/can/afs.dbc`; this diagnostic does not use SocketCAN.
- [ ] Build the bridge and run its CTest suite plus the new CAN tests.
- [ ] Synchronize the Code graph inventory and any affected graph descriptions
  or functionality paths, then run the graph checks as required by
  `agents/code_visualize.md`.
- [x] Update the bridge/CAN docs and `agents/working-context.md` so implemented
  signal validation/projection and DBC-generated frame packing are clearly
  separated from SocketCAN transport and ECU behavior.

## Completion Criteria

- A synthetic, fresh IPC scene deterministically produces valid `0x100`,
  `0x200`, and one complete `0x300` frame in memory.
- Golden vectors and boundary/invalid-input tests pass without CAN hardware.
- Stale or invalid input is never represented as a fresh valid ADB grid.
- The bridge contains no SocketCAN transport in this branch; a later transport
  step can consume the tested frame values and add `vcan0` coverage.
- Documentation, working context, and the Code graph agree with the code.

## Current Worktree Note

The branch also contains pending `0x300` documentation updates and the System
Visualization folder reorganization from earlier requests. Preserve those
changes and keep CAN implementation changes scoped to the bridge/CAN work
described here. The DBC byte layout and generated payload codec are checked
in; `CanFrameEncoder` wraps the generated code. Do not hand-code DBC bit
packing.

## References

- [CAN message index](../../docs/can/README.md)
- [`0x100 Vehicle_Speed`](../../docs/can/messages/0x100_Vehicle_Speed.md)
- [`0x200 Vehicle_Steering`](../../docs/can/messages/0x200_Vehicle_Steering.md)
- [`0x300 Vehicle_Object`](../../docs/can/messages/0x300_Vehicle_Object.md)
- [Runner-to-bridge IPC contract](../../docs/architecture/runner-bridge-communication.md)
- [Bridge component design](../../docs/architecture/components/bridge.md)
- [Bridge CAN module notes](../../bridge/src/can/README.md)
- [Code graph maintenance rules](../code_visualize.md)
