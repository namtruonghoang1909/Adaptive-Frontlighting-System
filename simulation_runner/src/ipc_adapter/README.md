# IPC Adapter

`RunnerPublisher` reads complete scenes from `get_scene_snapshot()` and sends
version 1 JSON packets to the local C++ bridge over `AF_UNIX/SOCK_SEQPACKET`.
It performs a `hello` handshake, keeps one session UUID across reconnects, and
publishes the newest scene at up to 20 Hz without a history queue. It skips
unchanged or older-than-250-ms scenes and retries connections with bounded
backoff.

The runner starts it on every invocation and retries until the bridge receiver
is available. Use `--bridge-socket PATH` or `AFS_BRIDGE_SOCKET` to configure the
endpoint. Otherwise both programs use
`$XDG_RUNTIME_DIR/afs/runner-bridge.sock`, falling back to
`/tmp/afs-<uid>/runner-bridge.sock` when `XDG_RUNTIME_DIR` is unset.
Protocol projection, packet-size enforcement, and object truncation live in
`publisher.py`. The adapter owns no CAN IDs, DBC packing, SocketCAN, Dashboard
state, or AFS control.
