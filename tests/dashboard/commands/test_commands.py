"""Dashboard command and preview behavior without a graphical display."""

from __future__ import annotations

import unittest
from unittest.mock import Mock, call, patch

from afs_dashboard.app.window import DashboardWindow
from afs_dashboard.gateway_client.client import GatewayDashboardState
from afs_dashboard.models.state import DemoDashboardState


class DashboardCommandTests(unittest.TestCase):
    def make_gateway(self) -> GatewayDashboardState:
        with patch("afs_dashboard.gateway_client.client.Thread.start"):
            return GatewayDashboardState("/tmp/afs-test-no-dashboard-socket")

    def make_window(self, *, power_on: bool) -> DashboardWindow:
        window = object.__new__(DashboardWindow)
        window.selected_power = power_on
        window.selected_mode = "low_beam_no_swivel"
        window._selection_touched = False
        window.state = Mock()
        window._refresh = Mock()
        return window

    def test_demo_state_tracks_power_mode_and_fault_clear(self) -> None:
        state = DemoDashboardState()
        state.set_command(True, "high_beam_dimming")
        snapshot = state.snapshot()
        self.assertEqual(snapshot["ecu"]["applied_dim_sectors"], [3, 4])
        self.assertEqual(snapshot["ecu"]["applied_dim_sector_mask"], 0x18)

        state.set_command(False, "high_beam_dimming")
        snapshot = state.snapshot()
        self.assertEqual(snapshot["ecu"]["executed_mode"], "off")
        self.assertEqual(snapshot["ecu"]["applied_dim_sectors"], [])
        self.assertTrue(snapshot["ecu"]["fault_present"])
        state.clear_fault()
        self.assertFalse(state.snapshot()["ecu"]["fault_present"])

    def test_window_blocks_mode_changes_while_power_is_off(self) -> None:
        window = self.make_window(power_on=False)
        window._select_mode("high_beam_dimming")
        self.assertEqual(window.selected_mode, "low_beam_no_swivel")
        window.state.set_command.assert_not_called()
        window._refresh.assert_not_called()

    def test_window_restores_selected_mode_after_power_cycle(self) -> None:
        window = self.make_window(power_on=True)
        window._select_mode("high_beam_dimming")
        window._toggle_power()
        window._select_mode("low_beam_swivel")
        window._toggle_power()

        self.assertTrue(window.selected_power)
        self.assertEqual(window.selected_mode, "high_beam_dimming")
        self.assertEqual(window.state.set_command.call_args_list, [
            call(True, "high_beam_dimming"),
            call(False, "high_beam_dimming"),
            call(True, "high_beam_dimming"),
        ])

    def test_offline_command_is_not_queued_then_connected_command_is(self) -> None:
        state = self.make_gateway()
        offline = state.set_command(True, "low_beam_swivel")
        self.assertFalse(offline["accepted"])
        self.assertIn("offline", offline["message"])
        self.assertTrue(state._outgoing.empty())

        with state._lock:
            state._connected = True
        pending = state.set_command(True, "high_beam_dimming")
        request = state._outgoing.get_nowait()
        self.assertEqual(request["type"], "command")
        self.assertEqual(request["request_id"], pending["id"])
        self.assertTrue(request["power_on"])
        self.assertEqual(request["mode"], "high_beam_dimming")

        clear = state.clear_fault()
        self.assertEqual(state._outgoing.get_nowait(), {
            "protocol_version": 1, "type": "clear_fault", "request_id": clear["id"],
        })
        state._mark_disconnected()
        self.assertIn("disconnected", state.snapshot()["request"]["last_action"]["message"])

    def test_command_validation_rejects_bad_values(self) -> None:
        state = self.make_gateway()
        with self.assertRaises(ValueError):
            state.set_command(1, "low_beam_swivel")
        with self.assertRaises(ValueError):
            state.set_command(True, "unknown_mode")
        self.assertTrue(state._outgoing.empty())


if __name__ == "__main__":
    unittest.main()
