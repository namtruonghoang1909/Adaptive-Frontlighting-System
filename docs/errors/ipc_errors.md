# Unix Socket IPC Errors

The simulation runner and Dashboard communicate with the C++ bridge through
separate local Unix sockets. This page covers cross-process connection and
message-delivery failures.

## No IPC Failure Diagnosed Yet

No project-specific IPC incident with a confirmed cause and resolution is
recorded here yet. When one occurs, capture which process started first, the
socket paths and permissions, the full logs from both peers, and whether the
server socket exists. The default paths and override variables are documented
in the [bridge guide](../../bridge/README.md), [runner guide](../../simulation_runner/README.md),
and [Dashboard guide](../../dashboard/README.md).

Run focused IPC regression tests with:

```bash
bash tests/scripts/test_unix_socket.sh
```

Record the exact error and verified retest here when an issue is diagnosed.
