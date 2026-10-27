from __future__ import annotations

from pathlib import Path
import subprocess
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]


class RootLauncherTests(unittest.TestCase):
    def run_script(self, script: str, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["bash", str(REPO_ROOT / "scripts" / script), *arguments],
            cwd=REPO_ROOT,
            capture_output=True,
            check=False,
            text=True,
            timeout=5,
        )

    def test_system_help_describes_host_processes_and_opt_in_can(self) -> None:
        result = self.run_script("start_system.sh", "--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("C++ bridge, native Dashboard, and MetaDrive runner", result.stdout)
        self.assertIn("--can-interface NAME", result.stdout)
        self.assertIn("flashes firmware.", result.stdout)

    def test_system_rejects_missing_can_interface_before_starting_processes(self) -> None:
        result = self.run_script("start_system.sh", "--can-interface")
        self.assertEqual(result.returncode, 2)
        self.assertIn("requires an interface name", result.stderr)

    def test_system_rejects_unknown_system_option(self) -> None:
        result = self.run_script("start_system.sh", "--unknown")
        self.assertEqual(result.returncode, 2)
        self.assertIn("unknown system option", result.stderr)

    def test_each_host_component_has_a_help_only_entrypoint(self) -> None:
        for script in (
            "start_runner.sh",
            "start_bridge.sh",
            "start_dashboard.sh",
            "start_visualization.sh",
        ):
            with self.subTest(script=script):
                result = self.run_script(script, "--help")
                self.assertEqual(result.returncode, 0)
                self.assertIn("Usage:", result.stdout)


if __name__ == "__main__":
    unittest.main()
