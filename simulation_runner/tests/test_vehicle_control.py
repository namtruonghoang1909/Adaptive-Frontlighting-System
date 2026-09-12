from __future__ import annotations

from metadrive_runner.controls import (
    ControlTuning,
    DriverInput,
    TargetSpeedController,
)


def test_speed_target_latches_and_steering_recenters_when_keys_are_released() -> None:
    controller = TargetSpeedController()
    controller.synchronize(
        speed_kph=20.0,
        steering_normalized=0.1,
        throttle_brake=0.2,
    )

    adjusted = controller.update(
        DriverInput(steer_left=True, increase_speed=True),
        speed_kph=20.0,
        dt_s=0.1,
    )
    released = controller.update(DriverInput(), speed_kph=20.5, dt_s=0.1)

    assert abs(adjusted.target_speed_kph - 21.0) < 1e-9
    assert abs(adjusted.target_steering_normalized - 0.15) < 1e-9
    assert released.target_speed_kph == adjusted.target_speed_kph
    assert abs(released.target_steering_normalized - 0.05) < 1e-9


def test_steering_center_rate_is_independent_of_step_size() -> None:
    fine = TargetSpeedController()
    coarse = TargetSpeedController()
    for controller in (fine, coarse):
        controller.synchronize(
            speed_kph=0.0,
            steering_normalized=0.8,
            throttle_brake=0.0,
        )

    for _ in range(4):
        fine.update(DriverInput(), speed_kph=0.0, dt_s=0.1)
    for _ in range(2):
        coarse.update(DriverInput(), speed_kph=0.0, dt_s=0.2)

    assert abs(fine.target_steering_normalized - 0.4) < 1e-9
    assert abs(
        fine.target_steering_normalized - coarse.target_steering_normalized
    ) < 1e-9


def test_target_adjustment_rates_are_independent_of_step_size() -> None:
    fine = TargetSpeedController()
    coarse = TargetSpeedController()
    driver_input = DriverInput(steer_right=True, increase_speed=True)

    for _ in range(10):
        fine.update(driver_input, speed_kph=0.0, dt_s=0.1)
    for _ in range(5):
        coarse.update(driver_input, speed_kph=0.0, dt_s=0.2)

    assert abs(fine.target_speed_kph - coarse.target_speed_kph) < 1e-9
    assert abs(
        fine.target_steering_normalized - coarse.target_steering_normalized
    ) < 1e-9


def test_targets_are_clamped_and_steering_can_be_centered() -> None:
    controller = TargetSpeedController()
    increase = DriverInput(steer_left=True, increase_speed=True)

    for _ in range(100):
        controller.update(increase, speed_kph=0.0, dt_s=0.1)

    centered = controller.update(
        DriverInput(center_steering=True),
        speed_kph=0.0,
        dt_s=0.1,
    )

    assert controller.target_speed_kph == 80.0
    assert centered.target_steering_normalized == 0.0


def test_pi_controller_holds_and_corrects_speed() -> None:
    tuning = ControlTuning(longitudinal_rate_per_s=100.0)
    controller = TargetSpeedController(tuning)
    controller.synchronize(
        speed_kph=20.0,
        steering_normalized=0.0,
        throttle_brake=0.2,
    )

    held = controller.update(DriverInput(), speed_kph=20.0, dt_s=0.1)
    below_target = controller.update(DriverInput(), speed_kph=18.0, dt_s=0.1)
    above_target = controller.update(DriverInput(), speed_kph=24.0, dt_s=0.1)

    assert abs(held.throttle_brake - 0.2) < 1e-9
    assert below_target.throttle_brake > held.throttle_brake
    assert above_target.throttle_brake < 0.0


def test_brake_input_reduces_target_and_command_quickly() -> None:
    controller = TargetSpeedController()
    controller.synchronize(
        speed_kph=30.0,
        steering_normalized=0.0,
        throttle_brake=0.3,
    )

    first = controller.update(
        DriverInput(decrease_speed=True),
        speed_kph=30.0,
        dt_s=0.1,
    )
    second = controller.update(
        DriverInput(decrease_speed=True),
        speed_kph=30.0,
        dt_s=0.1,
    )

    assert first.target_speed_kph == 27.0
    assert first.throttle_brake < 0.3
    assert second.target_speed_kph == 24.0
    assert second.throttle_brake < 0.0


def test_emergency_stop_clears_target_and_applies_full_brake() -> None:
    controller = TargetSpeedController()
    controller.synchronize(
        speed_kph=30.0,
        steering_normalized=0.2,
        throttle_brake=0.3,
    )

    moving = controller.update(
        DriverInput(emergency_stop=True),
        speed_kph=30.0,
        dt_s=0.1,
    )
    stopped = controller.update(
        DriverInput(emergency_stop=True),
        speed_kph=0.0,
        dt_s=0.1,
    )

    assert moving.target_speed_kph == 0.0
    assert moving.throttle_brake == -1.0
    assert stopped.throttle_brake == 0.0


def test_controller_rejects_non_positive_step_duration() -> None:
    controller = TargetSpeedController()

    try:
        controller.update(DriverInput(), speed_kph=0.0, dt_s=0.0)
    except ValueError as exc:
        assert str(exc) == "dt_s must be greater than zero"
    else:
        raise AssertionError("expected invalid step duration")
