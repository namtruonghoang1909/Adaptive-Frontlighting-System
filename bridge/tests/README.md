# Bridge Tests

Run `bash tools/test_components.sh bridge` from the repository root for the
build and standard CTest suite. The optional SocketCAN bus case uses
`bash tools/test_components.sh bridge-vcan` after preparing `vcan0`.

The bridge has IPC integration coverage and a host-side CAN signal-value test:

- `runner_ipc_integration.cpp` exercises the C++ receiver with a small local
  test publisher. It checks handshake/session handling, scene replacement,
  decoded values, socket permissions, competing publishers, reconnects, and
  rejection of malformed, stale, out-of-order, oversized, and out-of-range
  input. Steering validation uses the active MetaDrive limit carried in each
  scene, including values above the former fixed 90-degree bound.
- `runner_ipc_end_to_end.py` runs the actual Python `RunnerPublisher` against
  the C++ bridge executable using synthetic `SceneSnapshot` values. It checks
  publisher-first startup, ego/object serialization, full replacement with an
  empty scan, dynamic steering-limit serialization, and session/sequence
  continuity after a bridge restart. CTest
  registers it when a Python 3 interpreter is available.
- `dashboard_ipc_integration.cpp` checks connected command validity, a clear-
  fault pulse with no prior mode request, ECU status field forwarding, and
  CommandValid clearing after Dashboard disconnect.
- `../dashboard/tests/test_gateway_status.py` checks live/stale ECU status
  presentation, simulated fallback before the first ECU sample, and clear-fault
  acceptance without claiming ECU execution. It also checks that the requested
  mode remains distinct from the ECU-reported executed mode. CTest registers it
  when Python 3 is available.
- `runner_ipc_live_smoke.sh` starts the C++ bridge and a short headless
  MetaDrive run as separate processes, then validates the accepted scene
  packets. It uses the configured MetaDrive environment and requires no CAN
  hardware.
- `can_encoder_test.cpp` checks freshness and source validity, signed/scaled
  steering and speed values, saturation flags, alive-counter rollover, grid
  quality handling, full-footprint sector coverage, and cumulative range masks.
  It exercises signal values only.
- `can_frame_encoder_test.cpp` checks the `0x400` Dashboard command golden
  vector, XOR checksum, DBC identifier/DLC, and rejection of reserved mode
  values.
- `socketcan_frame_test.cpp` checks project/native Classical CAN conversion,
  payload/DLC preservation, zeroed padding, and rejection of extended, remote,
  error, and oversized frames.
- `afs_status_test.cpp` checks decoded status fields, XOR validation, reserved
  fields, enum and mask bounds, and alive-counter progression/restart handling.
- `socketcan_vcan_end_to_end.py` runs the production bridge against a prepared
  virtual CAN interface. It observes `0x400` commands, checks the one-frame
  clear-fault pulse and Dashboard disconnect invalidation, injects a valid
  `0x500` status, and checks Dashboard forwarding.
- `bridge/scripts/run_can_frame_smoke.sh` starts a separate frame logger and a
  finite headless MetaDrive run. It logs source values, CAN bytes, and values
  decoded by the generated DBC C codec, checking signal round trips and
  reserved zeros. It then independently decodes every captured batch with
  cantools and `bridge/can/afs.dbc`, without opening SocketCAN.

Run it from the repository root on Linux:

```bash
cmake -S bridge -B build/bridge
cmake --build build/bridge
ctest --test-dir build/bridge --output-on-failure
```

Run the optional live MetaDrive check with:

```bash
bash bridge/tests/runner_ipc_live_smoke.sh
```

Run the CAN encoder smoke check with cantools available to the configured
MetaDrive Python environment:

```bash
bash bridge/scripts/run_can_frame_smoke.sh
```

Set `CANTOOLS_PYTHON` and `CANTOOLS_PYTHONPATH` if cantools is installed in a
different environment. `AFS_CAN_SMOKE_STEPS` controls the finite simulation
length.

Set `METADRIVE_PYTHON` or `AFS_BRIDGE_BUILD_DIR` to override its defaults.
Run the SocketCAN integration only after preparing `vcan0` (or another vcan
interface) with the required OS network permissions:

```bash
cmake -S bridge -B build/bridge-vcan \
  -DAFS_ENABLE_SOCKETCAN_VCAN_TEST=ON -DAFS_VCAN_INTERFACE=vcan0
cmake --build build/bridge-vcan
ctest --test-dir build/bridge-vcan -R socketcan_vcan_end_to_end --output-on-failure
```

The unit cases for Python scene projection live in
`simulation_runner/tests/test_ipc_publisher.py` and use the existing Python test
procedure. The integration test uses Python's standard Linux CAN socket API;
it does not require `can-utils`.
