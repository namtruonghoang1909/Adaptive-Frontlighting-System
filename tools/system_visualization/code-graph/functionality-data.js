/* Ordered paths through implemented runtime code. These are viewer overlays. */
(() => {
  const R = "simulation_runner/src/metadrive_runner/";
  const I = "simulation_runner/src/ipc_adapter/publisher.py";
  const B = "bridge/src/ipc/runner_ipc.cpp";
  const O = "simulation_runner/src/object_extraction/";
  const D = "simulation_runner/src/scene_display/";
  const step = (from, to, action, detail, evidence) =>
    ({ from, to, action, detail, evidence });

  globalThis.FUNCTIONALITY_FLOWS = [
    {
      id: "ego_extraction",
      title: "Ego extraction",
      summary: "Read the ego vehicle, construct typed state, and publish it in the scene.",
      steps: [
        step("run.publish_scene()", "ego_extract", "calls extract_ego()", "env, step_info, timestamp_monotonic_s", R + "runner.py#run_single_agent"),
        step("ego_extract", "kinematics", "constructs", "EgoKinematicsSnapshot: speed, position, velocity, heading", O + "ego/extractor.py#extract_ego"),
        step("ego_extract", "action", "constructs", "EgoActionSnapshot: steering, active maximum steering angle, throttle/brake, latest action", O + "ego/extractor.py#extract_ego"),
        step("ego_extract", "diagnostics", "constructs", "EgoDiagnosticsSnapshot: lane and crash state", O + "ego/extractor.py#extract_ego"),
        step("ego_extract", "ego", "returns", "EgoSnapshot with the typed parts and one timestamp", O + "ego/extractor.py#extract_ego"),
        step("ego", "scene", "passes", "ego=snapshot into SceneSnapshot", R + "runner.py#run_single_agent"),
        step("scene", "write", "stores", "complete SceneSnapshot", R + "runner.py#run_single_agent"),
      ],
    },
    {
      id: "surrounding_extraction",
      title: "Surrounding extraction",
      summary: "Scan supported objects, transform them relative to ego, and publish the result.",
      steps: [
        step("run.publish_scene()", "surround_extract", "calls extract_surrounding()", "env, EgoSnapshot, radius_m", R + "runner.py#run_single_agent"),
        step("ego", "surround_extract", "supplies", "ego position, heading, velocity, and sample identity", O + "surrounding/extractor.py#extract_surrounding"),
        step("surround_extract", "object", "constructs per object", "SingleObjectSnapshot with world and ego-relative geometry", O + "surrounding/extractor.py#extract_surrounding"),
        step("object", "surround", "collects", "sorted objects tuple in SurroundingSnapshot", O + "surrounding/extractor.py#extract_surrounding"),
        step("surround_extract", "surround", "returns", "SurroundingSnapshot with scan validity and counts", O + "surrounding/extractor.py#extract_surrounding"),
        step("surround", "scene", "passes", "surrounding=surrounding into SceneSnapshot", R + "runner.py#run_single_agent"),
        step("scene", "write", "stores", "complete SceneSnapshot", R + "runner.py#run_single_agent"),
      ],
    },
    {
      id: "scene_publication",
      title: "Scene publication",
      summary: "After reset or step, create one matching scene and replace the latest value.",
      steps: [
        step("run", "run.publish_scene()", "calls after reset/step", "one monotonic timestamp per scene", R + "runner.py#run_single_agent"),
        step("run.publish_scene()", "ego_extract", "calls", "extract_ego(env, step_info, timestamp)", R + "runner.py#run_single_agent"),
        step("run.publish_scene()", "surround_extract", "calls", "extract_surrounding(env, ego, radius_m)", R + "runner.py#run_single_agent"),
        step("run.publish_scene()", "scene", "constructs", "SceneSnapshot(ego, surrounding)", R + "runner.py#run_single_agent"),
        step("scene", "write", "replaces latest", "lock-protected scene store", R + "snapshot_store.py#_write_scene_snapshot"),
      ],
    },
    {
      id: "browser_display",
      title: "Browser scene display",
      summary: "Read the latest scene, serve JSON, and draw ego and surrounding objects.",
      steps: [
        step("server.start()", "app", "creates", "FastAPI application and /api/scene endpoint", D + "server.py#SceneDisplayServer.start"),
        step("app", "read", "calls provider", "get_scene_snapshot() for the latest scene", D + "server.py#create_app"),
        step("read", "scene", "returns", "SceneSnapshot or None", R + "snapshot_store.py#get_scene_snapshot"),
        step("scene", "payload", "normalizes", "scene_display_payload(scene) JSON contract", D + "normalization.py#scene_display_payload"),
        step("app", "poll", "serves to browser", "GET /api/scene", D + "server.py#create_app"),
        step("poll", "draw", "calls", "drawScene() with the latest response", D + "assets/app.js"),
      ],
    },
    {
      id: "manual_control",
      title: "Manual driving control",
      summary: "Convert keys into a target-speed command and apply it as a MetaDrive action.",
      steps: [
        step("policy.act()", "keyboard.read()", "samples keys", "Panda3D input state", R + "controls/metadrive_policy.py#TargetSpeedKeyboardPolicy.act"),
        step("keyboard.read()", "input", "returns", "DriverInput steering, speed, and stop flags", R + "controls/metadrive_policy.py#_PandaKeyboardInput.read"),
        step("input", "controller.update()", "passes", "DriverInput, speed_kph, dt_s", R + "controls/controller.py#TargetSpeedController.update"),
        step("policy.act()", "controller.update()", "calls in manual mode", "TargetSpeedController.update(...)", R + "controls/metadrive_policy.py#TargetSpeedKeyboardPolicy.act"),
        step("controller.update()", "command", "returns", "ControlCommand steering and throttle/brake", R + "controls/controller.py#TargetSpeedController.update"),
        step("command", "policy", "applies", "action=[steering_normalized, throttle_brake]", R + "controls/metadrive_policy.py#TargetSpeedKeyboardPolicy"),
      ],
    },
    {
      id: "runner_startup",
      title: "Runner startup",
      summary: "Start bridge publishing and the optional local display before entering the simulation loop.",
      steps: [
        step("main", "publisher", "always starts", "RunnerPublisher(path) starts a dedicated reconnecting worker on every invocation", R + "__main__.py#main"),
        step("main", "server", "starts if requested", "SceneDisplayServer(port) when --scene-display is set", R + "__main__.py#main"),
        step("server.start()", "app", "creates", "the local FastAPI application", D + "server.py#SceneDisplayServer.start"),
        step("main", "run", "calls", "run_single_agent(env_config, seed, radius_m, ...)", R + "__main__.py#main"),
        step("run", "run.publish_scene()", "begins publishing", "after the first reset and every step", R + "runner.py#run_single_agent"),
      ],
    },
    {
      id: "runner_bridge_ipc",
      title: "Runner to bridge IPC",
      summary: "Read the latest complete scene, publish protocol v1 packets, and retain the newest accepted source sample.",
      steps: [
        step("main", "publisher", "always starts", "RunnerPublisher(path) starts a dedicated reconnecting worker and retries until the bridge is available", R + "__main__.py#main"),
        step("publisher", "read", "reads current sample", "get_scene_snapshot() returns one matched ego and object scene", I + "#RunnerPublisher"),
        step("publisher", "scene_message", "projects scene to protocol", "sequence, source monotonic timestamp, quality, steering angle and active limit, speed, and up to 128 objects", I + "#scene_message"),
        step("scene_message", "bridge_server", "sends one packet", "SOCK_SEQPACKET UTF-8 JSON; hello handshake precedes scene packets", I + "#scene_message"),
        step("bridge_server", "runner_scene", "validates, logs, and replaces", "session, increasing sequence, packet bounds, fields, and source age before latest-state replacement; prints each accepted JSON packet to stdout", B),
      ],
    },
    {
      id: "can_frame_smoke",
      title: "Headless MetaDrive CAN frame smoke",
      summary: "The diagnostic logger receives real runner IPC, encodes the three DBC frames every 20 ms, and checks the captured bytes against both generated C unpackers and cantools; it never sends CAN traffic.",
      steps: [
        step("can_frame_logger", "bridge_server", "starts the receiver", "CanFrameLogger runs RunnerIpcServer on a background thread at the script-provided socket path", "bridge/src/app/can_frame_logger.cpp"),
        step("scene_message", "bridge_server", "sends each headless sample", "RunnerPublisher sends the versioned scene over SOCK_SEQPACKET", "simulation_runner/src/ipc_adapter/publisher.py"),
        step("bridge_server", "runner_scene", "validates and stores", "latest accepted RunnerScene with monotonic capture time and source validity fields", B),
        step("runner_scene", "can_encoder", "supplies the latest scene", "the diagnostic loop samples RunnerIpcServer::latest_scene() each 20 ms", "bridge/src/app/can_frame_logger.cpp"),
        step("can_encoder", "can_signals", "validates and projects", "CanEncoder::encode(scene, monotonic time) returns steering, speed, and 10-sector signal values", "bridge/src/can/can_encoder.cpp"),
        step("can_signals", "can_frame_encoder", "passes signal values", "CanFrameEncoder::encode(const CanSignalValues&) calls the generated C signal encoders and message packers", "bridge/src/can/can_frame_encoder.cpp"),
        step("can_frame_encoder", "can_frames", "returns three frames", "standard CAN ID, DLC, and payload values in speed (0x100), steering (0x200), object (0x300) order; no scheduling or transmission", "bridge/src/can/can_frame_encoder.cpp"),
        step("can_frames", "can_frame_logger", "captures each payload", "writes every encoded frame and expected signals to temporary JSONL; generated C unpackers verify each batch", "bridge/src/app/can_frame_logger.cpp"),
        step("can_frame_logger", "can_capture_verifier", "checks the DBC independently", "the smoke shell script invokes cantools against bridge/can/afs.dbc and checks every decoded signal and reserved zero", "bridge/scripts/verify_can_frame_capture.py#main"),
      ],
    },
  ];
})();
