from __future__ import annotations

from pathlib import Path
import subprocess
import unittest


REPOSITORY = Path(__file__).resolve().parents[2]
OLD_COMPONENT_TEST_ROOTS = (
    "bridge/tests",
    "dashboard/tests",
    "firmware/tests",
    "scripts/tests",
    "simulation_runner/tests",
    "tools/system_visualization/tests",
)
TEST_SOURCE_SUFFIXES = {".c", ".cpp", ".cjs", ".js", ".py", ".sh"}


class CentralTestTreeTests(unittest.TestCase):
    def test_component_test_sources_live_under_root_tests(self) -> None:
        expected_modules = (
            "tests/unix_socket/runner_bridge",
            "tests/unix_socket/dashboard_bridge",
            "tests/can/bridge/encoder",
            "tests/can/bridge/status_decoder",
            "tests/can/bridge/socketcan",
            "tests/can/bridge/frame_smoke",
            "tests/can/ecu/can_service",
            "tests/runner/ego_extraction",
            "tests/runner/ipc_publisher",
            "tests/runner/lifecycle",
            "tests/runner/scene_display",
            "tests/runner/scene_snapshot",
            "tests/runner/snapshot_store",
            "tests/runner/surrounding_extraction",
            "tests/runner/vehicle_control",
            "tests/dashboard/commands",
            "tests/dashboard/gateway_status",
            "tests/visualization/beam_model",
            "tests/visualization/beam_segments",
            "tests/visualization/can_messages",
            "tests/visualization/code_timestamp",
            "tests/launchers",
        )
        for relative_dir in expected_modules:
            with self.subTest(module=relative_dir):
                self.assertTrue((REPOSITORY / relative_dir).is_dir())

        leftovers = []
        for relative_root in OLD_COMPONENT_TEST_ROOTS:
            old_root = REPOSITORY / relative_root
            if not old_root.exists():
                continue
            for path in old_root.rglob("*"):
                if "__pycache__" in path.parts or not path.is_file():
                    continue
                if path.suffix in TEST_SOURCE_SUFFIXES:
                    leftovers.append(path.relative_to(REPOSITORY).as_posix())
        self.assertEqual(leftovers, [], f"test code remains outside root tests/: {leftovers}")

    def test_test_runner_help_lists_component_module_selectors(self) -> None:
        result = subprocess.run(
            ["bash", "tests/scripts/test_components.sh", "--help"],
            cwd=REPOSITORY,
            capture_output=True,
            check=False,
            text=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("runner/ego_extraction", result.stdout)
        self.assertIn("unix_socket/runner_bridge", result.stdout)
        self.assertIn("bridge/unix_socket/MODULE", result.stdout)
        self.assertIn("bridge/can/<module>", result.stdout)
        self.assertIn("frame_smoke", result.stdout)
        self.assertIn("dashboard/<module>", result.stdout)
        self.assertIn("visualization/<module>", result.stdout)
        self.assertIn("ecu/can_service", result.stdout)

    def test_unknown_module_fails_before_starting_a_suite(self) -> None:
        result = subprocess.run(
            ["bash", "tests/scripts/test_components.sh", "runner/not_a_module"],
            cwd=REPOSITORY,
            capture_output=True,
            check=False,
            text=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("unknown runner test module", result.stderr)

    def test_all_suite_is_only_available_through_root_test_entrypoint(self) -> None:
        result = subprocess.run(
            ["bash", "tests/scripts/test_components.sh", "all"],
            cwd=REPOSITORY,
            capture_output=True,
            check=False,
            text=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("unknown test suite: all", result.stderr)
        self.assertNotIn("==>", result.stdout)

    def test_unknown_bridge_can_module_fails_before_building(self) -> None:
        result = subprocess.run(
            ["bash", "tests/scripts/test_components.sh", "bridge/can/not_a_module"],
            cwd=REPOSITORY,
            capture_output=True,
            check=False,
            text=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("unknown bridge CAN test module", result.stderr)


if __name__ == "__main__":
    unittest.main()
