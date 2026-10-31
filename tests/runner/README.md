# Simulation Runner Tests

Each folder checks one runner module. These unit tests use MetaDrive-like
fixtures and do not start the simulator. The live runner-to-frame smoke belongs
to the bridge CAN tests under [`../can/bridge/frame_smoke/`](../can/bridge/frame_smoke/).

| Folder | What it tests |
|---|---|
| [`ego_extraction/`](ego_extraction/) | Extracting and formatting valid or unavailable ego-vehicle values. |
| [`ipc_publisher/`](ipc_publisher/) | Projecting scene snapshots into bridge messages, enforcing packet/value limits, and choosing the Unix-socket path. |
| [`lifecycle/`](lifecycle/) | Environment setup, stepping, reset policy, pacing, callbacks, failure cleanup, and runner shutdown. |
| [`scene_display/`](scene_display/) | Read-only scene payloads, provider updates/errors, bundled assets, and local server validation. |
| [`scene_snapshot/`](scene_snapshot/) | Matching ego and surrounding samples into immutable complete scenes. |
| [`snapshot_store/`](snapshot_store/) | Latest-scene replacement, validation, retention, and concurrent readers. |
| [`surrounding_extraction/`](surrounding_extraction/) | Object filtering, distance limits, coordinate transforms, invalid scans, and immutable snapshots. |
| [`vehicle_control/`](vehicle_control/) | Steering and speed targets, controller response, clamping, braking, and emergency stop. |

Run all runner modules with `bash tests/scripts/test_runner.sh`, or pass one
folder name, for example `bash tests/scripts/test_runner.sh ego_extraction`.
The [component test guide](../scripts/test_guide.md) lists commands for the
other test areas.
