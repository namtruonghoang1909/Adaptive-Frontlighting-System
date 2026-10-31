# C++ Bridge Errors

Use this page for failures inside the native gateway. The bridge owns runner
and Dashboard Unix sockets plus optional SocketCAN; its test suites are listed
in the [CAN test guide](../../tests/can/README.md) and focused test scripts.

## CAN Transmit Failure

The bridge has logged `SocketCAN transmit failed on can0: No buffer space
available` during adapter testing. This is a host-side SocketCAN send failure;
see the [CAN troubleshooting record](can_errors.md#no-buffer-space-available-on-bridge-transmit)
for interface counters, bus ACK, and physical-layer checks. The bridge keeps
its IPC services available and retries transport operation, but a logged failed
send must not be treated as a transmitted frame.

## Other Bridge Failures

No separate bridge startup or scheduling failure has been diagnosed in the
current project log. For a new failure, capture the exact launcher command,
complete bridge output, whether `--can-interface` was supplied, and the status
of the runner, Dashboard, and CAN interface. Run the narrow regression suite:

```bash
bash tests/scripts/test_bridge.sh
```

For IPC connection failures, use [ipc_errors.md](ipc_errors.md). For hardware
transport issues, use [can_errors.md](can_errors.md).
