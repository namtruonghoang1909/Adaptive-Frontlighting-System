from __future__ import annotations

from collections import deque

from object_extraction.ego import extract_ego


class FakeEgo:
    speed = 12.5
    speed_km_h = 45.0
    steering = 0.25
    max_steering = 60.0
    throttle_brake = 0.4
    position = (1.0, 2.0)
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
        self.last_current_action = deque([(0.0, 0.0), (0.25, 0.4)], maxlen=2)

    def get_state(self) -> dict[str, object]:
        return {
            "position": self.position,
            "velocity": self.velocity,
            "nested": {"lane_index": self.lane_index},
        }


class FakeEnv:
    config = {
        "physics_world_step_size": 0.02,
        "decision_repeat": 5,
    }
    current_seed = 21
    episode_step = 3

    def __init__(self) -> None:
        self.agent = FakeEgo()


class MissingAgentEnv:
    @property
    def agent(self) -> object:
        raise AssertionError("Please initialize the environment first")


def test_extract_ego_reads_core_attributes() -> None:
    snapshot = extract_ego(
        FakeEnv(),
        step_info={"raw_action": (0.25, 0.4)},
        timestamp_monotonic_s=123.0,
    )

    assert snapshot.valid is True
    assert snapshot.errors == ()
    assert snapshot.timestamp_monotonic_s == 123.0
    assert snapshot.seed == 21
    assert snapshot.episode_step == 3
    assert snapshot.sim_time_s == 0.3
    assert snapshot.kinematics.speed_mps == 12.5
    assert snapshot.kinematics.speed_kph == 45.0
    assert snapshot.kinematics.position_m == (1.0, 2.0)
    assert snapshot.kinematics.velocity_mps == (3.0, 4.0)
    assert snapshot.kinematics.heading_rad == 1.2
    assert snapshot.action.steering_normalized == 0.25
    assert snapshot.action.steering_deg == 15.0
    assert snapshot.action.max_steering_deg == 60.0
    assert snapshot.action.throttle_brake == 0.4
    assert snapshot.action.latest_applied_action == (0.25, 0.4)
    assert snapshot.diagnostics.on_lane is True
    assert snapshot.diagnostics.lane_index == ("N1", "N2", 0)


def test_extract_ego_returns_plain_display_dict() -> None:
    snapshot = extract_ego(FakeEnv(), step_info={"raw_action": (0.25, 0.4)})

    display = snapshot.to_dict()

    assert display["step_info"] == {"raw_action": [0.25, 0.4]}
    assert display["raw_state"]["position"] == [1.0, 2.0]
    assert display["raw_state"]["nested"]["lane_index"] == ["N1", "N2", 0]
    assert display["action"]["latest_applied_action"] == [0.25, 0.4]


def test_extract_ego_missing_agent_is_invalid() -> None:
    snapshot = extract_ego(MissingAgentEnv(), timestamp_monotonic_s=5.0)

    assert snapshot.valid is False
    assert snapshot.timestamp_monotonic_s == 5.0
    assert snapshot.kinematics.speed_mps is None
    assert snapshot.action.steering_normalized is None
    assert snapshot.errors
    assert "env.agent unavailable" in snapshot.errors[0]
