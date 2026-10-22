"""Thread-safe simulated ECU and fallback ego state for the Dashboard."""

from __future__ import annotations

from threading import Lock


MODE_LABELS = {
    "low_beam_no_swivel": "Low beam",
    "low_beam_swivel": "Low beam + swivel",
    "high_beam_no_dimming": "High beam",
    "high_beam_dimming": "High beam + ADB",
}


class DemoDashboardState:
    """Holds operator requests and clearly simulated vehicle/ECU values."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._request_number = 1
        self._requested_power = True
        self._requested_mode = "high_beam_dimming"
        self._last_result = {
            "id": "demo-preset",
            "kind": "demo_preset",
            "accepted": False,
            "message": "Preset state is shown; no user request has been sent.",
        }
        self._last_action = {
            "id": "demo-0000",
            "kind": "clear_fault",
            "accepted": False,
            "message": "No clear-fault request sent yet.",
        }
        self._fault_present = True

    def set_command(self, power_on: object, mode: object) -> dict[str, object]:
        if not isinstance(power_on, bool):
            raise ValueError("power_on must be a boolean")
        if not isinstance(mode, str) or mode not in MODE_LABELS:
            raise ValueError("mode must be one of the four supported headlight modes")

        with self._lock:
            self._request_number += 1
            request_id = f"demo-{self._request_number:04d}"
            self._requested_power = power_on
            self._requested_mode = mode
            self._last_result = {
                "id": request_id,
                "kind": "headlight_request",
                "accepted": True,
                "message": "Request accepted by the local demo controller.",
            }
            return dict(self._last_result)

    def clear_fault(self) -> dict[str, object]:
        with self._lock:
            self._request_number += 1
            request_id = f"demo-{self._request_number:04d}"
            self._fault_present = False
            self._last_action = {
                "id": request_id,
                "kind": "clear_fault",
                "accepted": True,
                "message": "Clear-fault request accepted by the local demo controller.",
            }
            return dict(self._last_action)

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            executed_mode = (
                "off" if not self._requested_power else self._requested_mode
            )
            dim_sectors = [3, 4] if executed_mode == "high_beam_dimming" else []
            dim_mask = sum(1 << sector for sector in dim_sectors)
            return {
                "demo": True,
                "bridge": {
                    "connected": False,
                    "label": "Bridge not connected",
                    "detail": "Dashboard command and status IPC is not implemented yet.",
                },
                "request": {
                    "power_on": self._requested_power,
                    "mode": self._requested_mode,
                    "mode_label": MODE_LABELS[self._requested_mode],
                    "result": dict(self._last_result),
                    "last_action": dict(self._last_action),
                },
                "ecu": {
                    "source": "Simulated ECU status",
                    "executed_mode": executed_mode,
                    "executed_mode_label": (
                        "Off" if executed_mode == "off" else MODE_LABELS[executed_mode]
                    ),
                    "health": "degraded" if self._fault_present else "ok",
                    "health_label": "Degraded" if self._fault_present else "OK",
                    "required_inputs_valid": True,
                    "safe_fallback": False,
                    "fault_present": self._fault_present,
                    "faults": (
                        [
                            {
                                "name": "CAN decode fault",
                                "detail": "Illustrative latched fault; clearable in demo mode.",
                            }
                        ]
                        if self._fault_present
                        else []
                    ),
                    "left_servo_feedback_deg": -1.5,
                    "right_servo_feedback_deg": 0.5,
                    "applied_dim_sector_mask": dim_mask,
                    "applied_dim_sectors": dim_sectors,
                },
                "ego": {
                    "source": "Simulated runner sample",
                    "speed_kmh": 52.4,
                    "steering_deg": -8.5,
                    "heading_deg": 2.1,
                    "position_x_m": 128.6,
                    "position_y_m": 44.2,
                    "objects_valid": True,
                    "objects_degraded": False,
                    "sector_masks": [0, 0, 3, 7, 15, 7, 1, 0, 0, 0],
                    "surrounding_objects": [
                        {"label": "CAR 01", "x_forward_m": 58.0, "y_left_m": 3.6},
                        {"label": "CAR 02", "x_forward_m": 39.0, "y_left_m": 0.2},
                        {"label": "CAR 03", "x_forward_m": 24.0, "y_left_m": -3.6},
                    ],
                },
            }
