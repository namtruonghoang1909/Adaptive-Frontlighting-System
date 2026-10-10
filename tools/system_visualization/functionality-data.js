/* Ordered paths through implemented runtime code. These are viewer overlays. */
(() => {
  const R = "simulation_runner/src/metadrive_runner/";
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
        step("ego_extract", "action", "constructs", "EgoActionSnapshot: steering, throttle/brake, latest action", O + "ego/extractor.py#extract_ego"),
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
      summary: "Start the optional local display before entering the simulation loop.",
      steps: [
        step("main", "server", "starts if requested", "SceneDisplayServer(port) when --scene-display is set", R + "__main__.py#main"),
        step("server.start()", "app", "creates", "the local FastAPI application", D + "server.py#SceneDisplayServer.start"),
        step("main", "run", "calls", "run_single_agent(env_config, seed, radius_m, ...)", R + "__main__.py#main"),
        step("run", "run.publish_scene()", "begins publishing", "after the first reset and every step", R + "runner.py#run_single_agent"),
      ],
    },
  ];
})();
