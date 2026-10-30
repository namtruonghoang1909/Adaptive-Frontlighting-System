from __future__ import annotations

from collections import deque
from typing import Any

from metadrive_runner import (
    DEFAULT_ENV_CONFIG,
    build_env_config,
    build_render_text,
    format_snapshot,
    get_ego_snapshot,
    get_scene_snapshot,
    get_surrounding_snapshot,
    run_single_agent,
)
from metadrive_runner.__main__ import _build_env_config, build_parser
from metadrive_runner.runner import _suppress_unconfigurable_mistake_termination


class FakeEgo:
    max_steering = 60.0
    throttle_brake = 0.4
    velocity = (3.0, 4.0)
    heading_theta = 1.2
    on_lane = True
    lane_index = ("N1", "N2", 0)
    crash_vehicle = False
    crash_object = False
    crash_building = False
    crash_sidewalk = False
    out_of_route = False

    def __init__(self) -> None:
        self.speed = 0.0
        self.speed_km_h = 0.0
        self.steering = 0.0
        self.position = (0.0, 0.0)
        self.expert_takeover = False
        self.last_current_action = deque([(0.0, 0.0)], maxlen=2)

    def update(self, total_step: int) -> None:
        self.speed = float(total_step)
        self.speed_km_h = self.speed * 3.6
        self.steering = total_step / 10
        self.position = (float(total_step), float(total_step + 1))
        self.last_current_action.append((self.steering, self.throttle_brake))

    def reset(self) -> None:
        self.speed = 0.0
        self.speed_km_h = 0.0
        self.steering = 0.0
        self.position = (0.0, 0.0)
        self.expert_takeover = False
        self.last_current_action.append((0.0, 0.0))

    def get_state(self) -> dict[str, object]:
        return {"position": self.position, "velocity": self.velocity}


class FakeForceFPS:
    def __init__(self) -> None:
        self.disable_calls = 0

    def disable(self) -> None:
        self.disable_calls += 1


class FakeEngine:
    def __init__(self) -> None:
        self.force_fps = FakeForceFPS()
        self.ignored_events: list[str] = []
        self.objects: dict[str, object] = {}

    def ignore(self, event: str) -> None:
        self.ignored_events.append(event)

    def get_objects(self) -> dict[str, object]:
        return self.objects


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleep_calls: list[float] = []

    def __call__(self) -> float:
        return self.now

    def sleep(self, duration_s: float) -> None:
        self.sleep_calls.append(duration_s)
        self.now += duration_s


class FakeEnv:
    def __init__(
        self,
        config: dict[str, Any],
        *,
        terminate_on_steps: set[int] | None = None,
        fail_on_step: int | None = None,
    ) -> None:
        self.config = config
        self.engine = FakeEngine()
        self.agent = FakeEgo()
        self.current_track_agent = self.agent
        self.current_seed = 0
        self.episode_step = 0
        self.total_steps = 0
        self.terminate_on_steps = terminate_on_steps or set()
        self.fail_on_step = fail_on_step
        self.reset_calls: list[int] = []
        self.actions: list[list[float]] = []
        self.render_calls: list[dict[str, str]] = []
        self.close_calls = 0

    def reset(self, *, seed: int) -> tuple[object, dict[str, object]]:
        self.current_seed = seed
        self.episode_step = 0
        self.reset_calls.append(seed)
        self.agent.reset()
        return object(), {"reset": True}

    def step(self, action: list[float]) -> tuple[object, float, bool, bool, dict[str, object]]:
        self.total_steps += 1
        if self.fail_on_step == self.total_steps:
            raise RuntimeError("step failed")

        self.episode_step += 1
        self.actions.append(action)
        self.agent.update(self.total_steps)
        terminated = self.total_steps in self.terminate_on_steps
        return object(), 0.0, terminated, False, {
            "arrive_dest": terminated,
            "control_mode": "target_speed",
            "target_speed_kph": 25.0,
            "target_steering_normalized": 0.1,
        }

    def render(self, *, text: dict[str, str]) -> None:
        self.render_calls.append(text)

    def close(self) -> None:
        self.close_calls += 1


class MissingEgoEnv:
    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self.current_seed = 0
        self.episode_step = 0
        self.render_calls = 0
        self.close_calls = 0

    def reset(self, *, seed: int) -> tuple[object, dict[str, object]]:
        self.current_seed = seed
        self.episode_step = 0
        return object(), {}

    def step(self, action: list[float]) -> tuple[object, float, bool, bool, dict[str, object]]:
        self.episode_step += 1
        return object(), 0.0, False, False, {}

    def render(self, *, text: dict[str, str]) -> None:
        self.render_calls += 1

    def close(self) -> None:
        self.close_calls += 1


def test_build_env_config_isolated_and_mode_specific() -> None:
    interactive = build_env_config()
    interactive["vehicle_config"]["show_lidar"] = False

    fresh = build_env_config()
    headless = build_env_config(
        headless=True,
        overrides={
            "manual_control": True,
            "force_render_fps": 50,
            "vehicle_config": {"show_lidar": False},
        },
    )

    assert fresh["use_render"] is True
    assert fresh["manual_control"] is False
    assert fresh["force_render_fps"] is None
    assert fresh["vehicle_config"]["show_lidar"] is True
    assert fresh["out_of_route_done"] is False
    assert fresh["out_of_road_done"] is False
    assert fresh["on_continuous_line_done"] is False
    assert fresh["on_broken_line_done"] is False
    assert fresh["crash_vehicle_done"] is False
    assert fresh["crash_object_done"] is False
    assert fresh["crash_human_done"] is False
    assert headless["use_render"] is False
    assert headless["manual_control"] is False
    assert headless["force_render_fps"] is None
    assert headless["vehicle_config"]["show_lidar"] is False
    assert headless["vehicle_config"]["show_navi_mark"] is False


def test_cli_configures_decision_repeat() -> None:
    default_args = build_parser().parse_args([])
    configured_args = build_parser().parse_args(
        [
            "--headless",
            "--map", "3",
            "--traffic-density", "0.6",
            "--decision-repeat",
            "2",
            "--surrounding-radius-m",
            "40.5",
            "--visualize",
            "--scene-display-port",
            "9000",
        ]
    )

    default_config = _build_env_config(default_args)
    configured = _build_env_config(configured_args)

    assert default_config["decision_repeat"] == DEFAULT_ENV_CONFIG["decision_repeat"]
    assert configured["use_render"] is False
    assert configured["decision_repeat"] == 2
    assert configured["map"] == 3
    assert configured["traffic_density"] == 0.6
    assert default_args.surrounding_radius_m == 100.0
    assert configured_args.surrounding_radius_m == 40.5
    assert default_args.scene_display is False
    assert configured_args.scene_display is True
    assert configured_args.scene_display_port == 9000


def test_building_collision_does_not_end_episode() -> None:
    crash = {"crash_building": True, "arrive_dest": False, "max_step": False}
    crash_at_destination = {"crash_building": True, "arrive_dest": True, "max_step": False}
    crash_at_horizon = {"crash_building": True, "arrive_dest": False, "max_step": True}

    assert _suppress_unconfigurable_mistake_termination(True, crash) is False
    assert _suppress_unconfigurable_mistake_termination(True, crash_at_destination) is True
    assert _suppress_unconfigurable_mistake_termination(True, crash_at_horizon) is True
    assert _suppress_unconfigurable_mistake_termination(True, {}) is True


def test_runner_extracts_renders_and_resets_next_seed() -> None:
    config = build_env_config()
    env = FakeEnv(config, terminate_on_steps={2})
    snapshots = []

    summary = run_single_agent(
        env_config=config,
        seed=21,
        max_steps=3,
        on_snapshot=snapshots.append,
        env_factory=lambda received: env,
        realtime=False,
    )

    assert env.reset_calls == [21, 22]
    assert env.actions == [[0.0, 0.0], [0.0, 0.0], [0.0, 0.0]]
    assert [snapshot.seed for snapshot in snapshots] == [21, 21, 21, 22, 22]
    assert [snapshot.episode_step for snapshot in snapshots] == [0, 1, 2, 0, 1]
    assert snapshots[2].step_info["arrive_dest"] is True
    assert env.agent.expert_takeover is True
    assert len(env.render_calls) == len(snapshots)
    assert env.engine.force_fps.disable_calls == 1
    assert env.engine.ignored_events == ["f"]
    assert env.close_calls == 1
    assert summary.steps_completed == 3
    assert summary.episodes_started == 2
    assert summary.snapshots_emitted == 5
    assert summary.invalid_snapshots == 0
    assert summary.final_seed == 22


def test_runner_does_not_reset_after_step_limit() -> None:
    config = build_env_config()
    env = FakeEnv(config, terminate_on_steps={2})

    summary = run_single_agent(
        env_config=config,
        seed=30,
        max_steps=2,
        env_factory=lambda received: env,
        realtime=False,
    )

    assert env.reset_calls == [30]
    assert summary.episodes_started == 1
    assert summary.final_seed == 30
    assert env.close_calls == 1


def test_headless_runner_emits_and_counts_invalid_snapshots() -> None:
    config = build_env_config(headless=True)
    env = MissingEgoEnv(config)
    snapshots = []
    sleep_calls = []

    summary = run_single_agent(
        env_config=config,
        max_steps=2,
        on_snapshot=snapshots.append,
        env_factory=lambda received: env,
        sleeper=sleep_calls.append,
    )

    assert len(snapshots) == 3
    assert summary.invalid_snapshots == 3
    assert sleep_calls == []
    assert env.render_calls == 0
    assert env.close_calls == 1


def test_runner_closes_environment_when_step_fails() -> None:
    config = build_env_config()
    env = FakeEnv(config, fail_on_step=1)

    try:
        run_single_agent(
            env_config=config,
            max_steps=1,
            env_factory=lambda received: env,
            realtime=False,
        )
    except RuntimeError as exc:
        assert str(exc) == "step failed"
    else:
        raise AssertionError("expected step failure")

    assert env.close_calls == 1


def test_runner_closes_environment_on_keyboard_interrupt() -> None:
    config = build_env_config()
    env = FakeEnv(config)

    def interrupt(action: list[float]) -> tuple[object, float, bool, bool, dict[str, object]]:
        raise KeyboardInterrupt

    env.step = interrupt  # type: ignore[method-assign]

    try:
        run_single_agent(
            env_config=config,
            max_steps=1,
            env_factory=lambda received: env,
            realtime=False,
        )
    except KeyboardInterrupt:
        pass
    else:
        raise AssertionError("expected KeyboardInterrupt")

    assert env.close_calls == 1


def test_rendered_runner_paces_steps_to_simulation_time() -> None:
    config = build_env_config()
    env = FakeEnv(config)
    clock = FakeClock()
    expected_step_duration = (
        float(config["physics_world_step_size"]) * int(config["decision_repeat"])
    )

    summary = run_single_agent(
        env_config=config,
        max_steps=3,
        env_factory=lambda received: env,
        clock=clock,
        sleeper=clock.sleep,
    )

    assert summary.steps_completed == 3
    assert len(clock.sleep_calls) == 3
    assert all(
        abs(duration - expected_step_duration) < 1e-9
        for duration in clock.sleep_calls
    )
    assert abs(clock.now - 3 * expected_step_duration) < 1e-9


def test_snapshot_terminal_and_render_formatting() -> None:
    config = build_env_config()
    env = FakeEnv(config)
    snapshots = []

    run_single_agent(
        env_config=config,
        max_steps=1,
        on_snapshot=snapshots.append,
        env_factory=lambda received: env,
        realtime=False,
    )

    snapshot = snapshots[-1]
    line = format_snapshot(snapshot)
    overlay = build_render_text(env, snapshot)

    assert "speed_kph=3.60" in line
    assert "steering=0.100" in line
    assert "target_speed_kph=25.0" in line
    assert "target_steering=0.100" in line
    assert "valid=True" in line
    assert overlay["Ego Speed"] == "3.6 km/h"
    assert overlay["Control Mode"] == "target_speed"
    assert overlay["Target Speed"] == "25.0 km/h"
    assert overlay["Target Steering"] == "0.100"
    assert overlay["Snapshot"] == "seed=21 step=1 valid=True"


def test_runner_publishes_matching_scenes_before_callback_across_resets() -> None:
    config = build_env_config()
    env = FakeEnv(config, terminate_on_steps={1})
    snapshots = []
    scenes = []

    def capture_after_publish(snapshot: object) -> None:
        snapshots.append(snapshot)
        current = get_scene_snapshot()
        assert current is not None
        scenes.append(current)

    summary = run_single_agent(
        env_config=config,
        max_steps=2,
        on_snapshot=capture_after_publish,
        env_factory=lambda received: env,
        realtime=False,
        surrounding_radius_m=40.5,
    )

    assert len(snapshots) == 4
    assert len(scenes) == 4
    assert [item.ego.episode_step for item in scenes] == [0, 1, 0, 1]
    assert [item.ego.seed for item in scenes] == [21, 21, 22, 22]
    assert all(item.ego is snapshots[index] for index, item in enumerate(scenes))
    assert all(item.surrounding.radius_m == 40.5 for item in scenes)
    assert all(
        item.ego.timestamp_monotonic_s == item.surrounding.timestamp_monotonic_s
        and item.ego.seed == item.surrounding.seed
        and item.ego.episode_step == item.surrounding.episode_step
        and item.ego.sim_time_s == item.surrounding.sim_time_s
        for item in scenes
    )

    final = get_scene_snapshot()
    assert final is scenes[-1]
    assert get_ego_snapshot() is final.ego
    assert get_surrounding_snapshot() is final.surrounding
    assert summary.invalid_snapshots == 0


def test_runner_counts_invalid_surrounding_scenes() -> None:
    config = build_env_config(headless=True)
    env = FakeEnv(config)
    del env.engine

    summary = run_single_agent(
        env_config=config,
        max_steps=1,
        env_factory=lambda received: env,
        realtime=False,
    )

    scene = get_scene_snapshot()
    assert scene is not None
    assert scene.ego.valid is True
    assert scene.surrounding.valid is False
    assert scene.valid is False
    assert summary.invalid_snapshots == 2


def test_runner_rejects_invalid_surrounding_radius_before_environment_creation() -> None:
    factory_calls = []

    for radius in (-1.0, float("nan"), float("inf"), "invalid"):
        try:
            run_single_agent(
                max_steps=0,
                surrounding_radius_m=radius,  # type: ignore[arg-type]
                env_factory=lambda config: factory_calls.append(config),
            )
        except ValueError as exc:
            assert "surrounding_radius_m" in str(exc)
        else:
            raise AssertionError("expected invalid radius rejection")

    assert factory_calls == []


def test_runner_keeps_final_scene_until_the_next_valid_invocation_starts() -> None:
    config = build_env_config(headless=True)
    first_env = FakeEnv(config)

    run_single_agent(
        env_config=config,
        max_steps=0,
        env_factory=lambda received: first_env,
        realtime=False,
    )
    retained = get_scene_snapshot()
    assert retained is not None
    assert first_env.close_calls == 1

    try:
        run_single_agent(
            env_config=config,
            max_steps=-1,
            env_factory=lambda received: None,
        )
    except ValueError:
        pass
    else:
        raise AssertionError("expected invalid invocation to fail")
    assert get_scene_snapshot() is retained

    def fail_after_clear(received: dict[str, Any]) -> object:
        assert get_scene_snapshot() is None
        raise RuntimeError("environment construction failed")

    try:
        run_single_agent(
            env_config=config,
            max_steps=0,
            env_factory=fail_after_clear,
            realtime=False,
        )
    except RuntimeError as exc:
        assert str(exc) == "environment construction failed"
    else:
        raise AssertionError("expected environment construction failure")
    assert get_scene_snapshot() is None
