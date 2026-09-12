"""Simulator-independent target-speed and steering controller."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class DriverInput:
    """Keyboard state sampled for one environment step."""

    steer_left: bool = False
    steer_right: bool = False
    increase_speed: bool = False
    decrease_speed: bool = False
    center_steering: bool = False
    emergency_stop: bool = False
    toggle_mode: bool = False


@dataclass(frozen=True, slots=True)
class ControlTuning:
    """Rates and PI gains expressed in wall-time-independent units."""

    steering_rate_per_s: float = 0.5
    steering_center_rate_per_s: float = 1.0
    target_speed_rate_kph_per_s: float = 10.0
    target_speed_decrease_rate_kph_per_s: float = 30.0
    max_target_speed_kph: float = 80.0
    speed_kp: float = 0.08
    speed_ki: float = 0.02
    speed_integral_limit: float = 50.0
    longitudinal_rate_per_s: float = 1.5
    braking_rate_per_s: float = 4.0
    stopped_speed_kph: float = 0.5

    def __post_init__(self) -> None:
        positive_values = {
            "steering_rate_per_s": self.steering_rate_per_s,
            "steering_center_rate_per_s": self.steering_center_rate_per_s,
            "target_speed_rate_kph_per_s": self.target_speed_rate_kph_per_s,
            "target_speed_decrease_rate_kph_per_s": (
                self.target_speed_decrease_rate_kph_per_s
            ),
            "max_target_speed_kph": self.max_target_speed_kph,
            "speed_integral_limit": self.speed_integral_limit,
            "longitudinal_rate_per_s": self.longitudinal_rate_per_s,
            "braking_rate_per_s": self.braking_rate_per_s,
            "stopped_speed_kph": self.stopped_speed_kph,
        }
        for name, value in positive_values.items():
            if value <= 0:
                raise ValueError(f"{name} must be greater than zero")
        if self.speed_kp < 0 or self.speed_ki <= 0:
            raise ValueError("speed_kp must be non-negative and speed_ki must be positive")


@dataclass(frozen=True, slots=True)
class ControlCommand:
    """Applied action and persistent targets for one environment step."""

    steering_normalized: float
    throttle_brake: float
    target_steering_normalized: float
    target_speed_kph: float
    speed_error_kph: float
    emergency_stop: bool = False


class TargetSpeedController:
    """Latch speed, auto-center steering, and regulate speed with a PI loop."""

    def __init__(self, tuning: ControlTuning | None = None) -> None:
        self.tuning = tuning or ControlTuning()
        self.target_steering_normalized = 0.0
        self.target_speed_kph = 0.0
        self._speed_integral = 0.0
        self._longitudinal_command = 0.0

    def synchronize(
        self,
        *,
        speed_kph: float,
        steering_normalized: float,
        throttle_brake: float,
    ) -> None:
        """Match current vehicle state before switching from expert to manual mode."""
        self.target_speed_kph = _clamp(
            speed_kph,
            0.0,
            self.tuning.max_target_speed_kph,
        )
        self.target_steering_normalized = _clamp(steering_normalized, -1.0, 1.0)
        self._longitudinal_command = _clamp(throttle_brake, -1.0, 1.0)
        self._speed_integral = _clamp(
            self._longitudinal_command / self.tuning.speed_ki,
            -self.tuning.speed_integral_limit,
            self.tuning.speed_integral_limit,
        )

    def update(
        self,
        driver_input: DriverInput,
        *,
        speed_kph: float,
        dt_s: float,
    ) -> ControlCommand:
        """Advance persistent targets and return the next vehicle action."""
        if dt_s <= 0:
            raise ValueError("dt_s must be greater than zero")

        steering_direction = int(driver_input.steer_left) - int(driver_input.steer_right)
        if driver_input.center_steering:
            self.target_steering_normalized = 0.0
        elif steering_direction:
            self.target_steering_normalized = _clamp(
                self.target_steering_normalized
                + steering_direction * self.tuning.steering_rate_per_s * dt_s,
                -1.0,
                1.0,
            )
        else:
            self.target_steering_normalized = _move_toward(
                self.target_steering_normalized,
                0.0,
                self.tuning.steering_center_rate_per_s * dt_s,
            )

        speed_direction = int(driver_input.increase_speed) - int(driver_input.decrease_speed)
        if speed_direction:
            target_rate = (
                self.tuning.target_speed_rate_kph_per_s
                if speed_direction > 0
                else self.tuning.target_speed_decrease_rate_kph_per_s
            )
            self.target_speed_kph = _clamp(
                self.target_speed_kph
                + speed_direction * target_rate * dt_s,
                0.0,
                self.tuning.max_target_speed_kph,
            )
            self._speed_integral = 0.0

        measured_speed_kph = max(0.0, speed_kph)
        speed_error_kph = self.target_speed_kph - measured_speed_kph

        if driver_input.emergency_stop:
            self.target_speed_kph = 0.0
            self._speed_integral = 0.0
            self._longitudinal_command = (
                -1.0 if measured_speed_kph > self.tuning.stopped_speed_kph else 0.0
            )
            speed_error_kph = -measured_speed_kph
        elif (
            self.target_speed_kph == 0.0
            and measured_speed_kph <= self.tuning.stopped_speed_kph
        ):
            self._speed_integral = 0.0
            self._longitudinal_command = _move_toward(
                self._longitudinal_command,
                0.0,
                self.tuning.longitudinal_rate_per_s * dt_s,
            )
        else:
            desired_command = self._pi_command(speed_error_kph, dt_s)
            command_rate = (
                self.tuning.braking_rate_per_s
                if desired_command < self._longitudinal_command
                else self.tuning.longitudinal_rate_per_s
            )
            self._longitudinal_command = _move_toward(
                self._longitudinal_command,
                desired_command,
                command_rate * dt_s,
            )

        return ControlCommand(
            steering_normalized=self.target_steering_normalized,
            throttle_brake=self._longitudinal_command,
            target_steering_normalized=self.target_steering_normalized,
            target_speed_kph=self.target_speed_kph,
            speed_error_kph=speed_error_kph,
            emergency_stop=driver_input.emergency_stop,
        )

    def _pi_command(self, speed_error_kph: float, dt_s: float) -> float:
        candidate_integral = _clamp(
            self._speed_integral + speed_error_kph * dt_s,
            -self.tuning.speed_integral_limit,
            self.tuning.speed_integral_limit,
        )
        candidate_command = (
            self.tuning.speed_kp * speed_error_kph
            + self.tuning.speed_ki * candidate_integral
        )
        saturated_command = _clamp(candidate_command, -1.0, 1.0)

        saturation_drives_further = (
            candidate_command > 1.0 and speed_error_kph > 0.0
        ) or (candidate_command < -1.0 and speed_error_kph < 0.0)
        if not saturation_drives_further:
            self._speed_integral = candidate_integral

        return saturated_command


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return min(max(float(value), minimum), maximum)


def _move_toward(current: float, target: float, maximum_delta: float) -> float:
    if target > current:
        return min(current + maximum_delta, target)
    return max(current - maximum_delta, target)
