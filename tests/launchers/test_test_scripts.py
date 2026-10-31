from __future__ import annotations

from pathlib import Path
import subprocess
import unittest


REPOSITORY = Path(__file__).resolve().parents[2]
TEST_ENTRYPOINTS = (
    "test_component.sh",
    "test_runner.sh",
    "test_bridge.sh",
    "test_dashboard.sh",
    "test_firmware.sh",
    "test_visualization.sh",
    "test_unix_socket.sh",
    "test_can.sh",
    "test_launchers.sh",
    "test_test_runner.sh",
)


class TestScriptLauncherTests(unittest.TestCase):
    def test_each_test_entrypoint_has_help_without_running_a_suite(self) -> None:
        for name in TEST_ENTRYPOINTS:
            with self.subTest(script=name):
                result = subprocess.run(
                    ["bash", f"tests/scripts/{name}", "--help"],
                    cwd=REPOSITORY,
                    capture_output=True,
                    check=False,
                    text=True,
                    timeout=5,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("Usage:", result.stdout)
                self.assertNotIn("==>", result.stdout)

    def test_full_suite_runner_lives_in_tests(self) -> None:
        root_test_scripts = sorted(
            path.name
            for path in (REPOSITORY / "scripts").glob("test_*")
            if path.is_file()
        )
        self.assertEqual(root_test_scripts, [])
        self.assertTrue((REPOSITORY / "tests" / "test_all.sh").is_file())

    def test_root_script_guide_replaces_readme_and_selector_guides(self) -> None:
        scripts = REPOSITORY / "scripts"
        self.assertTrue((scripts / "dialogue.md").is_file())
        for obsolete in ("README.md", "start.md", "check.md"):
            with self.subTest(file=obsolete):
                self.assertFalse((scripts / obsolete).exists())

    def test_full_suite_entrypoint_has_help_without_running_a_suite(self) -> None:
        result = subprocess.run(
            ["bash", "tests/test_all.sh", "--help"],
            cwd=REPOSITORY,
            capture_output=True,
            check=False,
            text=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Usage: bash tests/test_all.sh", result.stdout)
        self.assertNotIn("==>", result.stdout)

    def test_component_entrypoints_route_unknown_modules_to_their_suite(self) -> None:
        cases = (
            ("test_runner.sh", ("not_a_module",), "unknown runner test module"),
            ("test_bridge.sh", ("can", "not_a_module"), "unknown bridge CAN test module"),
            ("test_dashboard.sh", ("not_a_module",), "unknown Dashboard test module"),
            ("test_firmware.sh", ("not_a_module",), "unknown test suite: ecu/not_a_module"),
            ("test_visualization.sh", ("not_a_module",), "unknown visualization test module"),
            ("test_unix_socket.sh", ("not_a_module",), "unknown Unix socket test module"),
            ("test_can.sh", ("not_a_module",), "expected 'bridge' or 'ecu'"),
        )
        for script, arguments, expected_error in cases:
            with self.subTest(script=script):
                result = subprocess.run(
                    ["bash", f"tests/scripts/{script}", *arguments],
                    cwd=REPOSITORY,
                    capture_output=True,
                    check=False,
                    text=True,
                    timeout=5,
                )
                self.assertEqual(result.returncode, 2, result.stdout)
                self.assertIn(expected_error, result.stderr)
                self.assertNotIn("==>", result.stdout)

    def test_shared_dispatcher_rejects_option_like_module_segments(self) -> None:
        result = subprocess.run(
            ["bash", "tests/scripts/test_component.sh", "runner", "--bad"],
            cwd=REPOSITORY,
            capture_output=True,
            check=False,
            text=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("invalid suite/module segment", result.stderr)


if __name__ == "__main__":
    unittest.main()
