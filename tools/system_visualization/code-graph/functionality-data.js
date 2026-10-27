/* Ordered paths through implemented runtime code. These are viewer overlays. */
(() => {
  const R = "simulation_runner/src/metadrive_runner/";
  const I = "simulation_runner/src/ipc_adapter/publisher.py";
  const B = "bridge/src/ipc/runner_ipc.cpp";
  const O = "simulation_runner/src/object_extraction/";
  const D = "simulation_runner/src/scene_display/";
  const A = "dashboard/src/afs_dashboard/";
  const F = "firmware/afs_ecu/";
  const S = "scripts/";
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
        step("publisher", "scene_message", "projects scene to protocol", "sequence, source monotonic timestamp, quality, steering/speed, optional position/heading, and up to 128 objects", I + "#scene_message"),
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
    {
      id: "production_socketcan",
      title: "Production SocketCAN gateway",
      summary: "When enabled with --can-interface, send runner inputs at their configured periods, transmit the leased Dashboard command every 50 ms, and validate and forward ECU status.",
      steps: [
        step("runner_scene", "can_runtime", "samples latest accepted scene", "CanRuntime reads the mutex-protected RunnerIpcServer scene at 20 ms speed/steering deadlines and 100 ms object-grid deadlines", "bridge/src/app/can_runtime.cpp"),
        step("dashboard_server", "can_runtime", "provides command snapshot", "DashboardIpcServer exposes accepted power/mode and a one-send clear-fault pulse; CommandValid is leased to the connected Dashboard", "bridge/src/ipc/runner_ipc.cpp"),
        step("can_runtime", "can_encoder", "validates and projects", "stale or invalid source fields become fail-closed signal values", "bridge/src/app/can_runtime.cpp"),
        step("can_encoder", "can_signals", "returns signal values", "steering, speed, and 10-sector object grid", "bridge/src/can/can_encoder.cpp"),
        step("can_runtime", "can_frame_encoder", "encodes scheduled frames", "generated DBC codec packs runner inputs and the current 0x400 Dashboard command", "bridge/src/app/can_runtime.cpp"),
        step("can_frame_encoder", "can_frames", "returns in-memory frames", "standard Classical CAN 0x100/0x200/0x300 batch plus separately encoded 0x400", "bridge/src/can/can_frame_encoder.cpp"),
        step("can_frames", "socketcan_frame_codec", "converts to native frame", "copies identifier, DLC, and payload to Linux struct can_frame with zero padding", "bridge/src/can/socketcan_frame.cpp"),
        step("socketcan_frame_codec", "socketcan_transport", "sends through bound interface", "pollable raw SocketCAN socket transmits 0x100/0x200 every 20 ms, 0x300 every 100 ms, and 0x400 every 50 ms; no queue of stale runner samples", "bridge/src/can/socketcan_transport.cpp"),
        step("socketcan_transport", "afs_status_decoder", "receives filtered 0x500", "validates DLC, checksum, reserved values, enums, mask, and alive counter", "bridge/src/app/can_runtime.cpp"),
        step("afs_status_decoder", "afs_status", "produces accepted snapshot", "latest status includes host monotonic receive time; rejected frames do not replace it", "bridge/src/can/afs_status.cpp"),
        step("afs_status", "dashboard_server", "retains decoded ECU status", "DashboardIpcServer serves the latest accepted sample with age and a 250 ms display freshness flag", "bridge/src/app/can_runtime.cpp"),
        step("dashboard_server", "dashboard_client", "returns runner, request and ECU data", "SOCK_SEQPACKET status includes decoded faults, executed mode, health, servo feedback, dim mask, and freshness", "bridge/src/ipc/runner_ipc.cpp"),
      ],
    },
    {
      id: "dashboard_can_roundtrip",
      title: "Dashboard CAN command and ECU feedback",
      summary: "Carry an operator command through bridge IPC and SocketCAN, then return decoded ECU status to the native Dashboard.",
      steps: [
        step("dashboard_window", "dashboard_client", "sends operator command", "Power/mode selection sends an identified command; clear-fault is a separate identified action", A + "app/window.py#DashboardWindow"),
        step("dashboard_client", "dashboard_server", "sends request packet", "Versioned Dashboard SOCK_SEQPACKET command or clear_fault message", A + "gateway_client/client.py#GatewayDashboardState"),
        step("dashboard_server", "can_runtime", "provides leased command state", "Accepted request remains valid while the Dashboard is connected; clear-fault is pending until one successful CAN send", B),
        step("can_runtime", "can_frame_encoder", "encodes command at 50 ms", "0x400 Dashboard_Command with alive counter, command-valid, power/mode, checksum, and optional one-frame clear-fault", "bridge/src/app/can_runtime.cpp"),
        step("can_frame_encoder", "can_frames", "packs DBC command", "standard 3-byte 0x400 frame", "bridge/src/can/can_frame_encoder.cpp"),
        step("can_frames", "socketcan_frame_codec", "converts payload", "Linux can_frame conversion preserves ID, DLC, and data", "bridge/src/can/socketcan_frame.cpp"),
        step("socketcan_frame_codec", "socketcan_transport", "transmits on selected bus", "SocketCAN sends only when the bridge is configured with --can-interface NAME", "bridge/src/can/socketcan_transport.cpp"),
        step("socketcan_transport", "afs_status_decoder", "receives ECU response", "Filtered 0x500 AFS_Status is checked before acceptance", "bridge/src/app/can_runtime.cpp"),
        step("afs_status_decoder", "afs_status", "decodes executed state", "Executed mode, health, fault flags, servo feedback, and applied dim mask", "bridge/src/can/afs_status.cpp"),
        step("afs_status", "dashboard_server", "retains accepted status", "Host receive timestamp supports stale indication", "bridge/src/app/can_runtime.cpp"),
        step("dashboard_server", "dashboard_client", "returns status over IPC", "Freshness, ECU flags, executed mode, servo feedback, and applied dim mask", B),
        step("dashboard_client", "dashboard_window", "updates live display", "Live 0x500 values replace simulated ECU fallback and show stale state after 250 ms", A + "gateway_client/client.py#GatewayDashboardState.snapshot"),
      ],
    },
    {
      id: "dashboard_demo",
      title: "Native Dashboard bridge IPC",
      summary: "Launch the three-section Tkinter Dashboard, scroll its controls, preview forward beams with an unlit ADB sector, and merge fresh runner/ECU status with simulated fallback values.",
      steps: [
        step("dashboard_launcher", "dashboard_start", "starts native Dashboard", "script selects the configured Python, sets PYTHONPATH, and execs afs_dashboard with forwarded arguments", "dashboard/scripts/start_dashboard.sh"),
        step("dashboard_start", "dashboard_client", "starts IPC worker", "main() creates GatewayDashboardState with --socket or default path", A + "app/window.py#main"),
        step("dashboard_start", "dashboard_window", "creates native GUI", "DashboardWindow uses the gateway client and enters Tk mainloop", A + "app/window.py#main"),
        step("dashboard_client", "dashboard_server", "handshakes and polls", "SOCK_SEQPACKET v1 hello and get_status; reconnects after failure", A + "gateway_client/client.py#GatewayDashboardState"),
        step("bridge_server", "dashboard_server", "supplies current scene", "RunnerIpcServer::current_scene() provides a matched optional scene under mutex", B),
        step("dashboard_server", "dashboard_client", "returns status", "fresh speed/steering/pose, up to 24 nearby vehicles, retained request ID/validity, CAN availability, and decoded ECU status with age", B),
        step("dashboard_window", "dashboard_client", "sends operator command", "local mode/power selection updates the lighting preview immediately; mode buttons disable when off; identified commands are sent to bridge when connected", A + "app/window.py#DashboardWindow"),
        step("dashboard_client", "dashboard_server", "sends request packet", "request ID, power/mode or clear_fault; no replay after disconnect", A + "gateway_client/client.py#GatewayDashboardState"),
        step("dashboard_server", "dashboard_client", "returns command result", "stores power/mode requests; clear-fault is queued for one successful CAN frame when CAN is enabled", B),
        step("dashboard_client", "dashboard_state", "updates fallback request", "accepted power/mode is reflected in local fallback preview without claiming ECU execution", A + "gateway_client/client.py#GatewayDashboardState"),
        step("dashboard_state", "dashboard_client", "supplies fallback snapshot", "illustrative ego and surrounding objects plus simulated ECU fields", A + "models/state.py#DemoDashboardState.snapshot"),
        step("dashboard_client", "dashboard_window", "supplies merged snapshot", "fresh runner ego, vehicles, and decoded ECU status override fallbacks; retained ECU values show stale age, while the proximity grid remains simulated", A + "gateway_client/client.py#GatewayDashboardState.snapshot"),
      ],
    },
    {
      id: "firmware_can_communication",
      title: "Zephyr ECU CAN communication and status",
      summary: "Receive the bridge's CAN inputs, decode them through the shared DBC codec, retain typed values, apply freshness checks, discard delayed backlog and invalidate inputs after RX queue loss, and transmit current Safe_Default status as 0x500.",
      steps: [
        step("firmware_main", "firmware_application", "starts ECU application", "main() delegates to afs_ecu_application_run()", F + "src/main.c#main"),
        step("firmware_application", "firmware_can_bus", "initializes CAN2", "Uses the board's zephyr,canbus devicetree choice, standard-ID filter, and 500 kbit/s overlay", F + "src/bsw/ecu_abstraction/can_bus.c#afs_can_bus_init"),
        step("firmware_can_bus", "firmware_application", "returns queued input frames", "Zephyr CAN callback copies frames into a bounded 32-frame queue; the application polls it, and on overrun discards delayed frames and invalidates every input", F + "src/bsw/ecu_abstraction/can_bus.c#can_bus_rx_callback"),
        step("firmware_application", "firmware_can_service", "dispatches received IDs", "0x100 Vehicle_Speed, 0x200 Vehicle_Steering, 0x300 Vehicle_Object, and 0x400 Dashboard_Command", F + "src/application/afs_ecu_application.c#afs_ecu_application_run"),
        step("firmware_can_service", "firmware_rte", "validates and stores decoded inputs", "Checks DLC, reserved/range/validity fields, 0x400 XOR checksum, and modulo-16 counters; accepts forward deltas 1–8 and rebaselines after 500 ms without accepted frames; rejected frames immediately invalidate that input", F + "src/bsw/services/communication/can_message_service.c#afs_can_message_service_process"),
        step("firmware_application", "firmware_rte", "reads latest typed inputs", "Single-thread RTE snapshot contains speed, steering, object grid, Dashboard command, and decode-fault state", F + "src/rte/afs_rte.c#afs_rte_read_inputs"),
        step("firmware_application", "firmware_controller", "checks freshness and status", "Speed/steering 100 ms, object grid 250 ms, command 200 ms; unavailable output drivers force Safe_Default", F + "src/application/afs_controller.c#afs_controller_update"),
        step("firmware_controller", "firmware_rte", "publishes current ECU status", "SafeFallback=1, BeamControlLost=1, ServoControlLost=1, placeholder zero feedback/mask until actuator drivers exist", F + "src/application/afs_controller.c#afs_controller_update"),
        step("firmware_application", "firmware_can_status_send", "sends status every 50 ms", "Reads the RTE status, packs 0x500 with the shared DBC C codec and XOR checksum", F + "src/bsw/services/communication/can_message_service.c#afs_can_message_service_send_status"),
        step("firmware_can_status_send", "firmware_can_bus", "transmits ECU status", "Sends standard CAN ID 0x500, DLC 8, on the selected Zephyr CAN controller", F + "src/bsw/ecu_abstraction/can_bus.c#afs_can_bus_send"),
      ],
    },
    {
      id: "firmware_led_heartbeat",
      title: "Zephyr board LED heartbeat",
      summary: "Initialize the board led0 GPIO and toggle it every 500 ms while the ECU CAN application runs.",
      steps: [
        step("firmware_main", "firmware_application", "starts application loop", "main() returns the result of afs_ecu_application_run()", F + "src/main.c#main"),
        step("firmware_application", "firmware_led_init", "initializes board output", "Resolves led0 from devicetree, verifies GPIO readiness, and configures the LED inactive", F + "src/bsw/ecu_abstraction/board_led.c#afs_board_led_init"),
        step("firmware_application", "firmware_led_toggle", "toggles output periodically", "The running ECU loop toggles the board LED every 500 ms", F + "src/application/afs_ecu_application.c#afs_ecu_application_run"),
      ],
    },
    {
      id: "host_system_startup",
      title: "Start the host system",
      summary: "Start bridge, Dashboard, and MetaDrive through their individual launchers, with optional CAN and coordinated shutdown.",
      steps: [
        step("system_launcher", "host_bridge_launcher", "starts bridge first", "Starts the C++ bridge before its clients; forwards --can-interface NAME only when requested", S + "start_system.sh"),
        step("host_bridge_launcher", "bridge_component_launcher", "delegates to bridge launcher", "Passes bridge arguments through to run_runner_bridge.sh", S + "start_bridge.sh"),
        step("system_launcher", "host_dashboard_launcher", "starts native Dashboard", "Starts the native Dashboard after the bridge", S + "start_system.sh"),
        step("host_dashboard_launcher", "dashboard_launcher", "delegates to Dashboard launcher", "Opens the Tkinter window through dashboard/scripts/start_dashboard.sh", S + "start_dashboard.sh"),
        step("system_launcher", "host_runner_launcher", "starts MetaDrive last", "Starts the simulation after bridge and Dashboard; runner options after -- are forwarded", S + "start_system.sh"),
        step("host_runner_launcher", "runner_component_launcher", "delegates to runner launcher", "Passes runner arguments to the simulation runner script", S + "start_runner.sh"),
        step("runner_component_launcher", "main", "executes runner module", "Starts metadrive_runner; the STM32 is already flashed and powered separately", "simulation_runner/scripts/start_metadrive_simulation.sh"),
      ],
    },
  ];
})();
