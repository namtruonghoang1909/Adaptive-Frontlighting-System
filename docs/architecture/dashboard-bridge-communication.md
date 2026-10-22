# Dashboard–Bridge IPC

The native Dashboard and C++ bridge communicate over a local Unix Domain Socket
with `SOCK_SEQPACKET`. This channel is separate from the runner scene socket.
The bridge owns both socket endpoints; the Dashboard reconnects when the bridge
is absent or restarted. This is implemented on `feat/dashboard` without
SocketCAN or ECU reception.

## Socket And Lifecycle

| Item | Current behavior |
|---|---|
| Default path | `$XDG_RUNTIME_DIR/afs/dashboard-bridge.sock`, or `/tmp/afs-<uid>/dashboard-bridge.sock` when `XDG_RUNTIME_DIR` is unset |
| Override | `AFS_DASHBOARD_SOCKET` for both processes, `--dashboard-socket PATH` for the bridge, or `--socket PATH` for the Dashboard window |
| Framing | One UTF-8 JSON object per packet; protocol version 1; maximum 4096 bytes per Dashboard packet |
| Access | Private user-owned directory (`0700`), socket (`0600`), and same-UID peer check |
| Client | One active Dashboard connection at a time; the current client polls every 250 ms and reconnects after disconnection |
| Shutdown | The bridge stops both IPC listeners on signal; the Dashboard client stops when its window closes |

The bridge's runner socket still uses its own version 1 scene protocol and 64
KiB packet limit. The Dashboard socket is a distinct contract.

## Messages

The Dashboard starts with a handshake and receives an acknowledgement:

```json
{"protocol_version":1,"type":"hello","role":"dashboard"}
{"protocol_version":1,"type":"hello_ack","role":"dashboard"}
```

A mode or power action sends a full persistent request. The bridge validates
and stores the latest accepted request in memory, then replies with the same
request ID:

```json
{"protocol_version":1,"type":"command","request_id":"a1b2","power_on":true,"mode":"high_beam_dimming"}
{"protocol_version":1,"type":"command_result","request_id":"a1b2","accepted":true,"reason":"stored_in_bridge"}
```

Modes are `low_beam_no_swivel`, `low_beam_swivel`,
`high_beam_no_dimming`, and `high_beam_dimming`. Request IDs contain 1–64
ASCII letters, digits, hyphens, or underscores. A successful result means the
bridge stored the operator request. It does **not** mean a CAN frame was sent or
an ECU executed the mode. The bridge retains the last accepted power and mode
across Dashboard disconnects until the bridge process exits. The Dashboard
does not replay pending actions after reconnecting.

A clear-fault action has its own ID. Until CAN/ECU control is implemented, the
bridge rejects it explicitly:

```json
{"protocol_version":1,"type":"clear_fault","request_id":"c3d4"}
{"protocol_version":1,"type":"command_result","request_id":"c3d4","accepted":false,"reason":"ecu_unavailable"}
```

The client requests a current status snapshot:

```json
{"protocol_version":1,"type":"get_status"}
{"protocol_version":1,"type":"status","runner":{"connected":true,"fresh":true,"age_ms":42,"speed_kmh":36.0,"steering_deg":7.5,"position_x_m":128.6,"position_y_m":44.2,"heading_deg":2.1,"objects_valid":true,"objects_limited":false,"objects":[{"x_forward_m":39.0,"y_left_m":0.2}]},"request":{"present":true,"request_id":"a1b2","power_on":true,"mode":"high_beam_dimming"},"ecu":{"available":false}}
```

`runner.connected` means the bridge currently holds a scene from the active
runner session. `runner.fresh` requires an accepted, unfaulted scene no older
than 250 ms. Invalid or stale speed/steering fields are `null`; an absent
sample has `age_ms: null`. Position and heading are `null` when absent,
invalid, or stale; earlier v1 runner publishers may omit these fields in the
scene packet. `objects_valid` requires a fresh, complete runner
object scan. When valid, `objects` contains the nearest 24 `VEHICLE` positions
with `x_forward_m` in 0–100 m and `y_left_m` within ±12 m; `objects_limited`
marks a list cut to 24. Invalid or stale scans return an empty array and the
Dashboard uses labeled simulated positions. A fresh valid empty array means
there are no nearby vehicles in the supported region. The top Dashboard view
shows the 0–80 m, ±6.5 m subset. These positions are not a projected sector
grid. The bridge does not send sector masks, servo feedback, fault registers,
or executed mode yet. The Dashboard labels its fallback
values for those fields as simulated.

`request.request_id` is the identifier of the bridge's latest stored command,
or `null` when no command has been stored. The Dashboard can reconcile an
in-flight command after reconnect by matching this ID. It never replays the
command merely because the connection broke.

Unknown or malformed request packets get an `error` packet and do not change
bridge state. A broken connection fails any in-flight Dashboard action; the
client does not queue it for replay. The bridge's request is separate from
simulated ECU execution shown in the current Dashboard.

## Current Process Boundary

```text
MetaDrive runner -- runner scene socket --> C++ bridge
Native Dashboard <-- Dashboard status socket --> C++ bridge
ECU status / CAN path: unavailable
```

The next CAN integration will send accepted requests as `0x400` commands and
replace simulated ECU display values with decoded `0x500` status. That work
must retain separate requested, accepted, and executed states and explicit
freshness.
