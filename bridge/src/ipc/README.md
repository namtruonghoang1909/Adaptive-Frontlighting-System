# IPC

`RunnerIpcServer` owns the runner-facing `AF_UNIX/SOCK_SEQPACKET` server. It
enforces same-UID peers, a private socket, protocol v1 handshake, packet and
object bounds, finite numeric values, session and sequence ordering, and
250-ms source freshness. Accepted scenes replace one mutex-protected latest
value. Disconnect clears its available flag; malformed and stale packets do
not refresh the scene. Each accepted scene is printed to stdout as its original
JSON packet, prefixed with its sequence number; rejected handshakes and scene
packets are reported to stderr. This module does not implement CAN packing or
lighting.

Build with CMake from `bridge/`; the `afs_runner_bridge` executable accepts an
optional `--socket PATH`, otherwise it uses `AFS_BRIDGE_SOCKET` or
`$XDG_RUNTIME_DIR/afs/runner-bridge.sock`, falling back to
`/tmp/afs-<uid>/runner-bridge.sock` when `XDG_RUNTIME_DIR` is unset.
