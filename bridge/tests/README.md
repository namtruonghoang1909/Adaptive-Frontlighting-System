# Bridge Tests

`runner_ipc_integration.cpp` runs the real C++ receiver with a small local test
publisher over `AF_UNIX/SOCK_SEQPACKET`. It checks handshake/session handling,
scene replacement, decoded values, socket permissions, a competing publisher,
reconnects, and rejection of malformed, stale, out-of-order, oversized, and
out-of-range input.

Run it from the repository root on Linux:

```bash
cmake -S bridge -B build/bridge
cmake --build build/bridge --target afs_runner_ipc_integration_test
ctest --test-dir build/bridge --output-on-failure
```

The test has no external test-framework dependency. CAN conversion, scheduling,
and `vcan0` integration coverage remain future work.
