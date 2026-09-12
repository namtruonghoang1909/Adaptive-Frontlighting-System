"""MetaDrive policy adapter for the project-owned keyboard controller."""

from __future__ import annotations

from typing import Any

from direct.controls.InputState import InputState
from metadrive.examples import expert
from metadrive.policy.base_policy import BasePolicy

from metadrive_runner.controls.controller import (
    ControlCommand,
    DriverInput,
    TargetSpeedController,
)


class TargetSpeedKeyboardPolicy(BasePolicy):
    """Provide expert/manual switching and persistent keyboard targets."""

    def __init__(self, obj: Any, seed: int) -> None:
        super().__init__(control_object=obj, random_seed=seed)
        self._keyboard = _PandaKeyboardInput()
        self._controller = TargetSpeedController()
        self._toggle_was_pressed = False
        self._dt_s = _simulation_step_duration_s(self.engine.global_config)
        self.control_object.expert_takeover = True
        self._synchronize_controller()

    def act(self, agent_id: str) -> list[float]:
        del agent_id
        driver_input = self._keyboard.read()
        self._toggle_mode_on_rising_edge(driver_input)

        if self.control_object.expert_takeover:
            self._synchronize_controller()
            try:
                raw_action = expert(self.control_object)
                action = [float(raw_action[0]), float(raw_action[1])]
                mode = "expert"
            except (AssertionError, ValueError):
                self.control_object.expert_takeover = False
                command = self._manual_command(driver_input)
                action = [command.steering_normalized, command.throttle_brake]
                mode = "target_speed"
        else:
            command = self._manual_command(driver_input)
            action = [command.steering_normalized, command.throttle_brake]
            mode = "target_speed"

        self.action_info.update(
            {
                "action": action,
                "manual_control": mode == "target_speed",
                "control_mode": mode,
                "target_speed_kph": self._controller.target_speed_kph,
                "target_steering_normalized": (
                    self._controller.target_steering_normalized
                ),
                "speed_error_kph": (
                    self._controller.target_speed_kph
                    - _vehicle_float(self.control_object, "speed_km_h")
                ),
            }
        )
        return action

    def reset(self) -> None:
        super().reset()
        self._toggle_was_pressed = False
        self.control_object.expert_takeover = True
        self._synchronize_controller()

    def destroy(self) -> None:
        self._keyboard.destroy()
        super().destroy()

    def _manual_command(self, driver_input: DriverInput) -> ControlCommand:
        return self._controller.update(
            driver_input,
            speed_kph=_vehicle_float(self.control_object, "speed_km_h"),
            dt_s=self._dt_s,
        )

    def _synchronize_controller(self) -> None:
        self._controller.synchronize(
            speed_kph=_vehicle_float(self.control_object, "speed_km_h"),
            steering_normalized=_vehicle_float(self.control_object, "steering"),
            throttle_brake=_vehicle_float(self.control_object, "throttle_brake"),
        )

    def _toggle_mode_on_rising_edge(self, driver_input: DriverInput) -> None:
        if driver_input.toggle_mode and not self._toggle_was_pressed:
            self.control_object.expert_takeover = (
                not self.control_object.expert_takeover
            )
            if not self.control_object.expert_takeover:
                self._synchronize_controller()
        self._toggle_was_pressed = driver_input.toggle_mode


class _PandaKeyboardInput:
    def __init__(self) -> None:
        self._inputs = InputState()
        self._tokens = [
            self._inputs.watchWithModifiers("afs_forward", "w"),
            self._inputs.watchWithModifiers("afs_reverse", "s"),
            self._inputs.watchWithModifiers("afs_left", "a"),
            self._inputs.watchWithModifiers("afs_right", "d"),
            self._inputs.watchWithModifiers("afs_center", "c"),
            self._inputs.watchWithModifiers("afs_stop", "space"),
            self._inputs.watchWithModifiers("afs_toggle", "t"),
        ]

    def read(self) -> DriverInput:
        return DriverInput(
            steer_left=self._inputs.isSet("afs_left"),
            steer_right=self._inputs.isSet("afs_right"),
            increase_speed=self._inputs.isSet("afs_forward"),
            decrease_speed=self._inputs.isSet("afs_reverse"),
            center_steering=self._inputs.isSet("afs_center"),
            emergency_stop=self._inputs.isSet("afs_stop"),
            toggle_mode=self._inputs.isSet("afs_toggle"),
        )

    def destroy(self) -> None:
        for token in self._tokens:
            token.release()
        self._tokens.clear()
        self._inputs.delete()


def _simulation_step_duration_s(config: dict[str, Any]) -> float:
    return float(config["physics_world_step_size"]) * int(config["decision_repeat"])


def _vehicle_float(vehicle: Any, attribute: str) -> float:
    try:
        return float(getattr(vehicle, attribute))
    except (AttributeError, TypeError, ValueError):
        return 0.0