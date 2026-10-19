# Bridge Tests

The IPC test suite has three layers:

- `runner_ipc_integration.cpp` exercises the C++ receiver with a small local
  test publisher. It checks handshake/session handling, scene replacement,
  decoded values, socket permissions, competing publishers, reconnects, and
  rejection of malformed, stale, out-of-order, oversized, and out-of-range
  input.
- `runner_ipc_end_to_end.py` runs the actual Python `RunnerPublisher` against
  the C++ bridge executable using synthetic `SceneSnapshot` values. It checks
  publisher-first startup, ego/object serialization, full replacement with an
  empty scan, and session/sequence continuity after a bridge restart. CTest
  registers it when a Python 3 interpreter is available.
- `runner_ipc_live_smoke.sh` starts the C++ bridge and a short headless
  MetaDrive run as separate processes, then validates the accepted scene
  packets. It uses the configured MetaDrive environment and requires no CAN
  hardware.

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

Set `METADRIVE_PYTHON` or `AFS_BRIDGE_BUILD_DIR` to override its defaults. The
unit cases for Python scene projection live in
`simulation_runner/tests/test_ipc_publisher.py` and use the existing Python test
procedure. CAN conversion, scheduling, and `vcan0` integration coverage remain
future work.
