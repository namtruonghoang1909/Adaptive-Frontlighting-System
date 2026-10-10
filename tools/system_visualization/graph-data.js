/* Curated implemented classes, nested members, and verified interactions. */
(() => {
  const R = "simulation_runner/src/metadrive_runner/";
  const O = "simulation_runner/src/object_extraction/";
  const D = "simulation_runner/src/scene_display/";
  const top = (id, label, layer, kind, source, description) =>
    ({ id, label, layer, kind, source, description });
  const child = (parent, label, kind, source, description) =>
    ({ id: parent + "." + label, label, parent, kind, source, description });
  const edge = (from, to, label, kind, evidence) =>
    ({ from, to, label, kind, evidence });

  globalThis.CLASS_GRAPH = {
    layers: [
      { id: "runner", label: "MetaDrive runner", folder: "simulation_runner/src/metadrive_runner", color: "#71b5ee", status: "implemented", description: "Simulation lifecycle, keyboard policy, control, and the latest-scene store." },
      { id: "extraction", label: "Object extraction", folder: "simulation_runner/src/object_extraction", color: "#6ed3b1", status: "implemented", description: "Typed ego, surrounding, and combined scene snapshots." },
      { id: "display", label: "Scene display", folder: "simulation_runner/src/scene_display", color: "#e6ad75", status: "implemented", description: "Optional local API and browser canvas for the live scene." },
      { id: "bridge", label: "CAN bridge", folder: "bridge", color: "#c49be8", status: "planned", description: "Runtime classes are not implemented yet." },
      { id: "dashboard", label: "Dashboard", folder: "dashboard", color: "#e9a5c6", status: "planned", description: "Runtime classes are not implemented yet." },
      { id: "firmware", label: "Firmware", folder: "firmware", color: "#e4d37b", status: "planned", description: "Runtime classes are not implemented yet." },
    ],
    // Local panel coordinates follow the implemented paths; expanded members orbit their parent.
    layout: {
      main: [200, 260], run: [600, 520], summary: [1000, 580],
      policy: [200, 950], keyboard: [600, 1100], input: [1000, 1240],
      tuning: [600, 1400], controller: [600, 1730], command: [200, 2100],
      read: [600, 2100], write: [1000, 2400],

      ego_extract: [200, 280], ego: [600, 340], kinematics: [1000, 260],
      action: [1000, 740], diagnostics: [1000, 1100],
      surround_extract: [200, 960], surround: [600, 1010], object: [1000, 1740],
      scene: [600, 1500],

      server: [200, 650], app: [600, 720], payload: [1000, 1250],
      poll: [600, 1820], draw: [600, 2330],
    },
    nodes: [
      top("main", "main()", "runner", "function", R + "__main__.py#main", "Parses runner options, starts the optional display, then runs the simulation."),
      top("run", "run_single_agent()", "runner", "function", R + "runner.py#run_single_agent", "Owns resets and steps, extracts a complete scene, and publishes it after each sample."),
      top("summary", "RunnerSummary", "runner", "class", R + "runner.py#RunnerSummary", "Counts completed steps, episodes, and emitted or invalid scenes."),
      top("policy", "TargetSpeedKeyboardPolicy", "runner", "class", R + "controls/metadrive_policy.py#TargetSpeedKeyboardPolicy", "MetaDrive policy that switches between expert and keyboard target-speed control."),
      top("keyboard", "_PandaKeyboardInput", "runner", "class", R + "controls/metadrive_policy.py#_PandaKeyboardInput", "Reads Panda3D keyboard state and converts it into DriverInput values."),
      top("controller", "TargetSpeedController", "runner", "class", R + "controls/controller.py#TargetSpeedController", "Maintains speed and steering targets and computes the next vehicle command."),
      top("input", "DriverInput", "runner", "class", R + "controls/controller.py#DriverInput", "Keyboard state sampled for one simulation step."),
      top("tuning", "ControlTuning", "runner", "class", R + "controls/controller.py#ControlTuning", "Rates, limits, and PI gains for the target-speed controller."),
      top("command", "ControlCommand", "runner", "class", R + "controls/controller.py#ControlCommand", "Steering, throttle or brake, and persistent targets returned by the controller."),
      top("write", "_write_scene_snapshot()", "runner", "function", R + "snapshot_store.py#_write_scene_snapshot", "Atomically replaces the latest in-process scene under a lock."),
      top("read", "get_scene_snapshot()", "runner", "function", R + "snapshot_store.py#get_scene_snapshot", "Reads the latest complete scene for in-process consumers."),

      top("ego_extract", "extract_ego()", "extraction", "function", O + "ego/extractor.py#extract_ego", "Reads the ego vehicle and returns one typed sample."),
      top("ego", "EgoSnapshot", "extraction", "class", O + "ego/types.py#EgoSnapshot", "One ego sample with kinematics, action, diagnostics, and validity."),
      top("kinematics", "EgoKinematicsSnapshot", "extraction", "class", O + "ego/types.py#EgoKinematicsSnapshot", "Speed, position, velocity, and heading of the ego vehicle."),
      top("action", "EgoActionSnapshot", "extraction", "class", O + "ego/types.py#EgoActionSnapshot", "Current steering and throttle or brake action."),
      top("diagnostics", "EgoDiagnosticsSnapshot", "extraction", "class", O + "ego/types.py#EgoDiagnosticsSnapshot", "Lane and collision diagnostics captured with the ego sample."),
      top("surround_extract", "extract_surrounding()", "extraction", "function", O + "surrounding/extractor.py#extract_surrounding", "Collects eligible nearby simulator objects relative to the ego vehicle."),
      top("surround", "SurroundingSnapshot", "extraction", "class", O + "surrounding/types.py#SurroundingSnapshot", "A complete replacement scan of nearby object snapshots."),
      top("object", "SingleObjectSnapshot", "extraction", "class", O + "surrounding/types.py#SingleObjectSnapshot", "One object's world and ego-relative geometry and motion."),
      top("scene", "SceneSnapshot", "extraction", "class", O + "scene.py#SceneSnapshot", "Keeps ego and surrounding objects together; rejects mismatched timestamp, source, seed, step, or simulation time."),

      top("server", "SceneDisplayServer", "display", "class", D + "server.py#SceneDisplayServer", "Runs the optional local FastAPI scene display on a managed thread."),
      top("app", "create_app()", "display", "function", D + "server.py#create_app", "Creates the latest-scene endpoint and serves browser assets."),
      top("payload", "scene_display_payload()", "display", "function", D + "normalization.py#scene_display_payload", "Converts a scene into the display JSON contract and freshness state."),
      top("poll", "pollScene()", "display", "function", D + "assets/app.js", "Fetches the latest scene JSON in the browser."),
      top("draw", "drawScene()", "display", "function", D + "assets/app.js", "Draws the ego and registry-derived surrounding objects in one browser canvas."),

      child("run", "publish_scene()", "function", R + "runner.py#run_single_agent", "Nested function called after reset and each step; builds and stores one matching scene."),
      child("policy", "act()", "method", R + "controls/metadrive_policy.py#TargetSpeedKeyboardPolicy.act", "Samples input and returns a MetaDrive action for the active control mode."),
      child("policy", "reset()", "method", R + "controls/metadrive_policy.py#TargetSpeedKeyboardPolicy.reset", "Resets the policy when MetaDrive starts a new episode."),
      child("keyboard", "read()", "method", R + "controls/metadrive_policy.py#_PandaKeyboardInput.read", "Samples watched keys and returns one DriverInput."),
      child("controller", "synchronize()", "method", R + "controls/controller.py#TargetSpeedController.synchronize", "Matches manual targets to the current vehicle before switching control modes."),
      child("controller", "update()", "method", R + "controls/controller.py#TargetSpeedController.update", "Advances targets from keyboard input and returns a ControlCommand."),
      child("ego", "kinematics", "field", O + "ego/types.py#EgoSnapshot", "EgoKinematicsSnapshot field of this sample."),
      child("ego", "action", "field", O + "ego/types.py#EgoSnapshot", "EgoActionSnapshot field of this sample."),
      child("ego", "diagnostics", "field", O + "ego/types.py#EgoSnapshot", "EgoDiagnosticsSnapshot field of this sample."),
      child("surround", "objects", "field", O + "surrounding/types.py#SurroundingSnapshot", "Tuple of SingleObjectSnapshot values in this replacement scan."),
      child("scene", "ego", "field", O + "scene.py#SceneSnapshot", "EgoSnapshot from the same simulator state."),
      child("scene", "surrounding", "field", O + "scene.py#SceneSnapshot", "SurroundingSnapshot from the same simulator state."),
      child("server", "start()", "method", D + "server.py#SceneDisplayServer.start", "Starts the local server and creates its FastAPI application."),
      child("server", "stop()", "method", D + "server.py#SceneDisplayServer.stop", "Shuts down the managed local server."),
    ],
    edges: [
      edge("main", "run", "calls", "call", R + "__main__.py#main"),
      edge("main", "server", "starts", "call", R + "__main__.py#main"),
      edge("run", "run.publish_scene()", "after reset/step", "call", R + "runner.py#run_single_agent"),
      edge("run", "summary", "returns", "data", R + "runner.py#run_single_agent"),
      edge("run.publish_scene()", "ego_extract", "calls", "call", R + "runner.py#run_single_agent"),
      edge("run.publish_scene()", "surround_extract", "calls", "call", R + "runner.py#run_single_agent"),
      edge("run.publish_scene()", "scene", "constructs", "data", R + "runner.py#run_single_agent"),
      edge("run.publish_scene()", "write", "publishes", "call", R + "runner.py#run_single_agent"),
      edge("ego_extract", "ego", "returns", "data", O + "ego/extractor.py#extract_ego"),
      edge("surround_extract", "surround", "returns", "data", O + "surrounding/extractor.py#extract_surrounding"),
      edge("ego", "surround_extract", "ego pose", "data", O + "surrounding/extractor.py#extract_surrounding"),
      edge("ego.kinematics", "kinematics", "contains", "data", O + "ego/types.py#EgoSnapshot"),
      edge("ego.action", "action", "contains", "data", O + "ego/types.py#EgoSnapshot"),
      edge("ego.diagnostics", "diagnostics", "contains", "data", O + "ego/types.py#EgoSnapshot"),
      edge("surround.objects", "object", "contains", "data", O + "surrounding/types.py#SurroundingSnapshot"),
      edge("scene.ego", "ego", "contains", "data", O + "scene.py#SceneSnapshot"),
      edge("scene.surrounding", "surround", "contains", "data", O + "scene.py#SceneSnapshot"),
      edge("scene", "write", "stored by", "data", R + "snapshot_store.py#_write_scene_snapshot"),
      edge("read", "scene", "returns latest", "data", R + "snapshot_store.py#get_scene_snapshot"),
      edge("server.start()", "app", "creates", "call", D + "server.py#SceneDisplayServer.start"),
      edge("app", "read", "provider reads", "call", D + "server.py#create_app"),
      edge("app", "payload", "normalizes", "call", D + "server.py#create_app"),
      edge("scene", "payload", "reads", "data", D + "normalization.py#scene_display_payload"),
      edge("app", "poll", "serves JSON to", "data", D + "server.py#create_app"),
      edge("poll", "draw", "updates view", "call", D + "assets/app.js"),
      edge("policy", "controller", "owns", "data", R + "controls/metadrive_policy.py#TargetSpeedKeyboardPolicy"),
      edge("policy", "keyboard", "owns", "data", R + "controls/metadrive_policy.py#TargetSpeedKeyboardPolicy"),
      edge("policy.act()", "keyboard.read()", "samples keys", "call", R + "controls/metadrive_policy.py#TargetSpeedKeyboardPolicy.act"),
      edge("keyboard.read()", "input", "returns", "data", R + "controls/metadrive_policy.py#_PandaKeyboardInput.read"),
      edge("policy.act()", "controller.update()", "manual action", "call", R + "controls/metadrive_policy.py#TargetSpeedKeyboardPolicy.act"),
      edge("policy", "controller.synchronize()", "mode switch", "call", R + "controls/metadrive_policy.py#TargetSpeedKeyboardPolicy"),
      edge("controller", "tuning", "uses", "data", R + "controls/controller.py#TargetSpeedController"),
      edge("input", "controller.update()", "accepts", "data", R + "controls/controller.py#TargetSpeedController.update"),
      edge("controller.update()", "command", "returns", "data", R + "controls/controller.py#TargetSpeedController.update"),
      edge("policy", "command", "applies", "data", R + "controls/metadrive_policy.py#TargetSpeedKeyboardPolicy"),
    ],
  };
})();
