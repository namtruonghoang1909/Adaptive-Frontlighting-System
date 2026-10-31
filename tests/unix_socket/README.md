# Unix-Socket IPC Tests

These integration tests exercise local process communication between the
Python runner or Dashboard and the C++ bridge.

| Folder | What it tests |
|---|---|
| [`runner_bridge/`](runner_bridge/) | C++ runner-message reception, protocol validation, Python publisher delivery, reconnect behavior, and an optional live MetaDrive smoke. |
| [`dashboard_bridge/`](dashboard_bridge/) | Dashboard command and status IPC between the native UI client and bridge. |

Run all IPC tests with `bash tests/scripts/test_unix_socket.sh`, or select one
side with `bash tests/scripts/test_unix_socket.sh runner_bridge` or
`bash tests/scripts/test_unix_socket.sh dashboard_bridge`. The host must allow
binding local Unix sockets. These tests do not require a CAN adapter.
