"""Checks mapping of bridge ECU status into Dashboard display snapshots."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from afs_dashboard.gateway_client.client import GatewayDashboardState


def status_reply(*, fresh: bool = True, available: bool = True) -> dict[str, object]:
    ecu: dict[str, object] = {"available": available, "fresh": fresh, "age_ms": 18 if fresh else 301}
    if available:
        ecu.update({
            "alive_counter": 7,
            "required_inputs_valid": True,
            "fault_present": True,
            "safe_fallback": False,
            "executed_mode": 5,
            "health_state": 1,
            "steering_stale": False,
            "speed_stale": False,
            "object_stale": False,
            "dashboard_stale": False,
            "servo_control_lost": False,
            "servo_mismatch": True,
            "beam_control_lost": False,
            "can_decode_fault": False,
            "left_servo_feedback_deg": -1.5,
            "right_servo_feedback_deg": 0.5,
            "applied_dim_sector_mask": 0x18,
        })
    return {
        "protocol_version": 1,
        "type": "status",
        "runner": {
            "connected": True, "fresh": True, "age_ms": 20,
            "speed_kmh": 36.0, "steering_deg": 7.5,
            "heading_deg": 0.0, "position_x_m": 12.0, "position_y_m": -1.0,
            "objects_valid": True, "objects_limited": False,
            "objects": [{"x_forward_m": 24.0, "y_left_m": 1.0}],
        },
        "request": {
            "present": True, "valid": True, "request_id": "mode-1",
            "power_on": True, "mode": "high_beam_dimming",
        },
        "can": {"enabled": True},
        "ecu": ecu,
    }


class GatewayStatusTests(unittest.TestCase):
    def make_state(self) -> GatewayDashboardState:
        with patch("afs_dashboard.gateway_client.client.Thread.start"):
            return GatewayDashboardState("/tmp/afs-test-no-dashboard-socket")

    def test_live_status_keeps_requested_and_executed_modes_distinct(self) -> None:
        state = self.make_state()
        reply = status_reply()
        reply["request"]["mode"] = "low_beam_no_swivel"
        state._apply_status(reply)
        snapshot = state.snapshot()

        self.assertEqual(snapshot["request"]["mode_label"], "Low beam")
        self.assertEqual(snapshot["ecu"]["executed_mode_label"], "High beam + ADB")
        self.assertEqual(snapshot["ecu"]["health_label"], "Degraded")
        self.assertEqual(snapshot["ecu"]["left_servo_feedback_deg"], -1.5)
        self.assertEqual(snapshot["ecu"]["applied_dim_sector_mask"], 0x18)
        self.assertEqual(snapshot["ecu"]["applied_dim_sectors"], [3, 4])
        self.assertEqual(snapshot["ecu"]["faults"][0]["name"], "Servo feedback mismatch")
        self.assertEqual(snapshot["ecu"]["source"], "Live ECU status · Fresh")

    def test_retained_status_is_labeled_stale(self) -> None:
        state = self.make_state()
        state._apply_status(status_reply(fresh=False))
        snapshot = state.snapshot()

        self.assertFalse(snapshot["ecu"]["status_fresh"])
        self.assertEqual(snapshot["ecu"]["source"], "Live ECU status · Stale")
        self.assertEqual(snapshot["ecu"]["status_age_ms"], 301)

    def test_unavailable_ecu_keeps_simulated_fallback(self) -> None:
        state = self.make_state()
        state._apply_status(status_reply(available=False))
        snapshot = state.snapshot()

        self.assertFalse(snapshot["ecu"].get("status_available", False))
        self.assertIn("waiting for CAN 0x500", snapshot["ecu"]["source"])

    def test_clear_fault_acceptance_does_not_claim_ecu_cleared(self) -> None:
        state = self.make_state()
        state._apply_status(status_reply())
        state._last_action = {
            "id": "clear-1", "kind": "clear_fault", "accepted": False,
            "message": "Waiting for bridge response.",
        }
        state._apply_result(
            {"type": "clear_fault", "request_id": "clear-1"},
            {"type": "command_result", "request_id": "clear-1",
             "accepted": True, "reason": "queued_for_can"},
        )
        snapshot = state.snapshot()

        self.assertTrue(snapshot["ecu"]["fault_present"])
        self.assertIn("ECU result is unconfirmed", snapshot["request"]["last_action"]["message"])


if __name__ == "__main__":
    unittest.main()
