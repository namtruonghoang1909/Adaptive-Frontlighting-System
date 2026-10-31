from __future__ import annotations

import os
from pathlib import Path
import subprocess
import tempfile
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
        result = self.run_script("start.sh", "system", "--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("C++ bridge, native Dashboard, and MetaDrive runner", result.stdout)
        self.assertIn("--can-interface NAME", result.stdout)
        self.assertIn("flashes firmware.", result.stdout)

    def test_system_rejects_missing_can_interface_before_starting_processes(self) -> None:
        result = self.run_script("start.sh", "system", "--can-interface")
        self.assertEqual(result.returncode, 2)
        self.assertIn("requires an interface name", result.stderr)

    def test_system_rejects_unknown_system_option(self) -> None:
        result = self.run_script("start.sh", "system", "--unknown")
        self.assertEqual(result.returncode, 2)
        self.assertIn("unknown system option", result.stderr)

    def test_public_start_dispatcher_lists_components(self) -> None:
        result = self.run_script("start.sh", "--help")
        self.assertEqual(result.returncode, 0)
        for component in ("system", "runner", "bridge", "dashboard", "savvycan", "visualization"):
            with self.subTest(component=component):
                self.assertIn(component, result.stdout)

    def test_setup_and_readiness_helpers_have_side_effect_free_help(self) -> None:
        for script, arguments in (
            ("setup_system.sh", ("--help",)),
            ("check.sh", ("--help",)),
            ("check.sh", ("system", "--help")),
            ("check.sh", ("can", "--help")),
        ):
            with self.subTest(script=script):
                result = self.run_script(script, *arguments)
                self.assertEqual(result.returncode, 0)
                self.assertIn("Usage:", result.stdout)

    def test_dispatchers_reject_unknown_selectors(self) -> None:
        missing_start = self.run_script("start.sh")
        self.assertEqual(missing_start.returncode, 2)
        self.assertIn("choose a component", missing_start.stderr)

        start = self.run_script("start.sh", "unknown")
        self.assertEqual(start.returncode, 2)
        self.assertIn("unknown component", start.stderr)

        missing_check = self.run_script("check.sh")
        self.assertEqual(missing_check.returncode, 2)
        self.assertIn("choose a check", missing_check.stderr)

        check = self.run_script("check.sh", "unknown")
        self.assertEqual(check.returncode, 2)
        self.assertIn("unknown check", check.stderr)

    def test_public_dispatchers_forward_component_arguments(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scripts = root / "scripts"
            boot_dir = scripts / "boot_scripts"
            check_dir = scripts / "check_scripts"
            log_file = root / "dispatch.log"
            scripts.mkdir()
            boot_dir.mkdir()
            check_dir.mkdir()
            (scripts / "start.sh").write_text(
                (REPO_ROOT / "scripts" / "start.sh").read_text(encoding="utf-8"),
                encoding="utf-8",
            )
            (scripts / "check.sh").write_text(
                (REPO_ROOT / "scripts" / "check.sh").read_text(encoding="utf-8"),
                encoding="utf-8",
            )

            helpers = {
                boot_dir / "start_system.sh": "start_system",
                boot_dir / "start_bridge.sh": "start_bridge",
                boot_dir / "start_runner.sh": "start_runner",
                boot_dir / "start_dashboard.sh": "start_dashboard",
                boot_dir / "start_savvycan.sh": "start_savvycan",
                boot_dir / "start_visualization.sh": "start_visualization",
                check_dir / "check_system.sh": "check_system",
                check_dir / "check_can.sh": "check_can",
                check_dir / "can_interface_check.sh": "can_up",
                root / "firmware" / "scripts" / "check_stlink.sh": "check_stlink",
            }
            for helper, name in helpers.items():
                helper.parent.mkdir(parents=True, exist_ok=True)
                helper.write_text(
                    "#!/usr/bin/env bash\n"
                    f"printf '%s\\n' '{name}' > \"$DISPATCH_LOG\"\n"
                    "if (($#)); then printf '<%s>\\n' \"$@\" >> \"$DISPATCH_LOG\"; fi\n",
                    encoding="utf-8",
                )

            environment = os.environ.copy()
            environment["DISPATCH_LOG"] = str(log_file)
            cases = (
                ("start.sh", "system", "start_system", ["--can-interface", "can0"]),
                ("start.sh", "runner", "start_runner", ["--headless"]),
                ("start.sh", "dashboard", "start_dashboard", ["--socket", "/tmp/dash.sock"]),
                ("start.sh", "savvycan", "start_savvycan", []),
                ("start.sh", "visualization", "start_visualization", ["8123"]),
                ("check.sh", "system", "check_system", ["--headless"]),
                ("check.sh", "can", "check_can", ["can1"]),
                ("check.sh", "can-up", "can_up", ["can0"]),
                ("check.sh", "ecu", "check_stlink", []),
            )
            for script, selector, expected_name, expected_args in cases:
                with self.subTest(script=script, selector=selector):
                    result = subprocess.run(
                        ["bash", str(scripts / script), selector, *expected_args],
                        cwd=root,
                        env=environment,
                        capture_output=True,
                        check=False,
                        text=True,
                        timeout=5,
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(
                        log_file.read_text(encoding="utf-8").splitlines(),
                        [expected_name, *(f"<{argument}>" for argument in expected_args)],
                    )

    def test_ecu_check_rejects_arguments_before_openocd(self) -> None:
        result = self.run_script("check.sh", "ecu", "--hardware")
        self.assertEqual(result.returncode, 2)
        self.assertIn("does not accept arguments", result.stderr)

    def test_setup_script_rejects_unknown_component_before_setup(self) -> None:
        result = self.run_script("setup_system.sh", "--component", "unknown")
        self.assertEqual(result.returncode, 2)
        self.assertIn("select a component", result.stderr)

    def test_savvycan_launcher_uses_override_without_cli_arguments(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            executable = Path(directory) / "SavvyCAN-test-stub"
            argument_count = Path(directory) / "argument-count.txt"
            executable.write_text(
                "#!/usr/bin/env bash\n"
                "printf '%s\\n' \"$#\" > \"$SAVVYCAN_TEST_ARGUMENT_COUNT\"\n",
                encoding="utf-8",
            )
            executable.chmod(0o755)
            environment = os.environ.copy()
            environment["SAVVYCAN_BIN"] = str(executable)
            environment["SAVVYCAN_TEST_ARGUMENT_COUNT"] = str(argument_count)
            result = subprocess.run(
                ["bash", str(REPO_ROOT / "scripts/start.sh"), "savvycan"],
                cwd=REPO_ROOT,
                env=environment,
                capture_output=True,
                check=False,
                text=True,
                timeout=5,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn(str(REPO_ROOT / "bridge/can/afs.dbc"), result.stdout)
            self.assertEqual(argument_count.read_text(encoding="utf-8"), "0\n")

    def test_savvycan_launcher_finds_default_command_on_path(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            executable = Path(directory) / "SavvyCAN"
            executable.write_text("#!/usr/bin/env bash\nexit 0\n", encoding="utf-8")
            executable.chmod(0o755)
            environment = os.environ.copy()
            environment.pop("SAVVYCAN_BIN", None)
            environment["PATH"] = f"{directory}{os.pathsep}{environment['PATH']}"
            result = subprocess.run(
                ["bash", str(REPO_ROOT / "scripts/start.sh"), "savvycan"],
                cwd=REPO_ROOT,
                env=environment,
                capture_output=True,
                check=False,
                text=True,
                timeout=5,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn(f"Starting SavvyCAN: {executable}", result.stdout)

    def test_savvycan_launcher_finds_project_local_appimage(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            project_root = Path(directory)
            dispatcher = project_root / "scripts" / "start.sh"
            launcher = project_root / "scripts" / "boot_scripts" / "start_savvycan.sh"
            dbc_file = project_root / "bridge" / "can" / "afs.dbc"
            executable = (
                project_root / ".tools" / "savvycan" / "squashfs-root" / "AppRun"
            )
            started_marker = project_root / "savvycan-started.txt"
            argument_count = project_root / "argument-count.txt"

            dispatcher.parent.mkdir(parents=True)
            dispatcher.write_text(
                (REPO_ROOT / "scripts" / "start.sh").read_text(
                    encoding="utf-8"
                ),
                encoding="utf-8",
            )
            launcher.parent.mkdir(parents=True)
            launcher.write_text(
                (REPO_ROOT / "scripts" / "boot_scripts" / "start_savvycan.sh").read_text(
                    encoding="utf-8"
                ),
                encoding="utf-8",
            )
            dbc_file.parent.mkdir(parents=True)
            dbc_file.write_text("VERSION \"\"\n", encoding="utf-8")
            executable.parent.mkdir(parents=True)
            executable.write_text(
                "#!/bin/sh\n"
                "printf started > \"$SAVVYCAN_TEST_STARTED_MARKER\"\n"
                "printf '%s\\n' \"$#\" > \"$SAVVYCAN_TEST_ARGUMENT_COUNT\"\n",
                encoding="utf-8",
            )
            executable.chmod(0o755)

            environment = os.environ.copy()
            environment.pop("SAVVYCAN_BIN", None)
            environment["PATH"] = "/usr/bin:/bin"
            environment["SAVVYCAN_TEST_STARTED_MARKER"] = str(started_marker)
            environment["SAVVYCAN_TEST_ARGUMENT_COUNT"] = str(argument_count)
            result = subprocess.run(
                ["bash", str(dispatcher), "savvycan"],
                cwd=project_root,
                env=environment,
                capture_output=True,
                check=False,
                text=True,
                timeout=5,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn(f"Starting SavvyCAN: {executable}", result.stdout)
            self.assertEqual(started_marker.read_text(encoding="utf-8"), "started")
            self.assertEqual(argument_count.read_text(encoding="utf-8"), "0\n")

    def test_savvycan_launcher_reports_missing_executable(self) -> None:
        environment = os.environ.copy()
        environment["SAVVYCAN_BIN"] = str(REPO_ROOT / "missing-SavvyCAN-executable")
        result = subprocess.run(
            ["bash", str(REPO_ROOT / "scripts/start.sh"), "savvycan"],
            cwd=REPO_ROOT,
            env=environment,
            capture_output=True,
            check=False,
            text=True,
            timeout=5,
        )

        self.assertEqual(result.returncode, 127)
        self.assertIn("SavvyCAN was not found", result.stderr)


class CanInterfaceCheckTests(unittest.TestCase):
    def run_can_check(
        self,
        *,
        exists: bool = True,
        is_can: bool = True,
        up: bool = False,
        bitrate: str = "",
        arguments: tuple[str, ...] = (),
    ) -> tuple[subprocess.CompletedProcess[str], str]:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fake_bin = root / "bin"
            fake_bin.mkdir()
            state_file = root / "can-state.sh"
            call_log = root / "calls.txt"
            state_file.write_text(
                f"CAN_TEST_EXISTS={'1' if exists else '0'}\n"
                f"CAN_TEST_IS_CAN={'1' if is_can else '0'}\n"
                f"CAN_TEST_UP={'1' if up else '0'}\n"
                f"CAN_TEST_BITRATE={bitrate}\n",
                encoding="utf-8",
            )
            ip_stub = fake_bin / "ip"
            ip_stub.write_text(
                r'''#!/usr/bin/env bash
set -euo pipefail
state_file="$CAN_TEST_STATE_FILE"
interface="$CAN_TEST_INTERFACE"
source "$state_file"
flags=NOARP
[[ "$CAN_TEST_UP" == 1 ]] && flags=NOARP,UP
if [[ "$1" == "-o" && "$2" == "link" ]]; then
  [[ "$CAN_TEST_EXISTS" == 1 ]] || exit 1
  printf '4: %s: <%s> mtu 16 qdisc noop state UNKNOWN mode DEFAULT group default qlen 10\n' "$interface" "$flags"
elif [[ "$1" == "-details" ]]; then
  [[ "$CAN_TEST_EXISTS" == 1 ]] || exit 1
  printf '4: %s: <%s> mtu 16 qdisc noop\n' "$interface" "$flags"
  if [[ "$CAN_TEST_IS_CAN" == 1 ]]; then printf '    link/can\n'; else printf '    link/ether\n'; fi
  if [[ -n "$CAN_TEST_BITRATE" ]]; then printf '    bitrate %s sample-point 0.875\n' "$CAN_TEST_BITRATE"; fi
  printf '    can state ERROR-ACTIVE restart-ms 0\n'
elif [[ "$1" == "link" && "$2" == "set" ]]; then
  shift 2
  printf 'ip %s\n' "$*" >> "$CAN_TEST_CALL_LOG"
  command_line=" $* "
  if [[ "$command_line" == *' type can bitrate 500000 loopback off '* ]]; then CAN_TEST_BITRATE=500000; fi
  if [[ "$command_line" == *" dev $interface up "* ]]; then CAN_TEST_UP=1; fi
  printf 'CAN_TEST_EXISTS=%s\nCAN_TEST_IS_CAN=%s\nCAN_TEST_UP=%s\nCAN_TEST_BITRATE=%s\n' \
    "$CAN_TEST_EXISTS" "$CAN_TEST_IS_CAN" "$CAN_TEST_UP" "$CAN_TEST_BITRATE" > "${state_file}.tmp"
  mv "${state_file}.tmp" "$state_file"
else
  printf 'Unexpected fake ip invocation: %s\n' "$*" >&2
  exit 2
fi
''',
                encoding="utf-8",
            )
            ip_stub.chmod(0o755)
            sudo_stub = fake_bin / "sudo"
            sudo_stub.write_text(
                r'''#!/usr/bin/env bash
set -euo pipefail
printf 'sudo %s\n' "$*" >> "$CAN_TEST_CALL_LOG"
[[ "${1:-}" == -- ]] && shift
exec "$@"
''',
                encoding="utf-8",
            )
            sudo_stub.chmod(0o755)

            environment = os.environ.copy()
            environment["PATH"] = f"{fake_bin}{os.pathsep}/usr/bin:/bin"
            environment["CAN_TEST_STATE_FILE"] = str(state_file)
            environment["CAN_TEST_CALL_LOG"] = str(call_log)
            if arguments and not arguments[0].startswith("-"):
                environment["CAN_TEST_INTERFACE"] = arguments[0]
            else:
                environment["CAN_TEST_INTERFACE"] = "can0"
            result = subprocess.run(
                ["bash", str(REPO_ROOT / "scripts/check.sh"), "can-up", *arguments],
                cwd=REPO_ROOT,
                env=environment,
                capture_output=True,
                check=False,
                text=True,
                timeout=5,
            )
            calls = call_log.read_text(encoding="utf-8") if call_log.exists() else ""
            return result, calls

    def test_down_interface_is_configured_at_project_rate_and_started(self) -> None:
        result, calls = self.run_can_check(up=False, bitrate="")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Configuring can0 for 500000 bit/s", result.stdout)
        self.assertIn("ip dev can0 type can bitrate 500000 loopback off", calls)
        self.assertIn("ip dev can0 up", calls)
        self.assertIn("Final interface status", result.stdout)

    def test_active_interface_with_project_rate_is_left_unchanged(self) -> None:
        result, calls = self.run_can_check(up=True, bitrate="500000")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("already UP at 500000 bit/s", result.stdout)
        self.assertEqual(calls, "")

    def test_active_interface_with_wrong_rate_is_not_disrupted(self) -> None:
        result, calls = self.run_can_check(up=True, bitrate="250000")
        self.assertEqual(result.returncode, 1)
        self.assertIn("will not interrupt it", result.stderr)
        self.assertEqual(calls, "")

    def test_missing_interface_reports_adapter_detection_issue(self) -> None:
        result, calls = self.run_can_check(exists=False)
        self.assertEqual(result.returncode, 1)
        self.assertIn("CAN interface can0 does not exist", result.stderr)
        self.assertEqual(calls, "")

    def test_existing_non_can_interface_is_rejected(self) -> None:
        result, calls = self.run_can_check(is_can=False)
        self.assertEqual(result.returncode, 1)
        self.assertIn("is not a SocketCAN interface", result.stderr)
        self.assertEqual(calls, "")

    def test_invalid_interface_name_is_rejected_before_system_commands(self) -> None:
        result, calls = self.run_can_check(arguments=("can0; touch /tmp/not-allowed",))
        self.assertEqual(result.returncode, 2)
        self.assertIn("invalid network interface name", result.stderr)
        self.assertEqual(calls, "")

    def test_named_interface_argument_is_used_for_configuration(self) -> None:
        result, calls = self.run_can_check(arguments=("can1",))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Configuring can1 for 500000 bit/s", result.stdout)
        self.assertIn("ip dev can1 type can bitrate 500000 loopback off", calls)
        self.assertIn("ip dev can1 up", calls)

    def test_help_does_not_access_network_interfaces(self) -> None:
        result, calls = self.run_can_check(arguments=("--help",))
        self.assertEqual(result.returncode, 0)
        self.assertIn("Usage: bash scripts/check.sh can-up", result.stdout)
        self.assertEqual(calls, "")


class CanReadinessCheckTests(unittest.TestCase):
    def run_can_check(
        self,
        *,
        exists: bool = True,
        is_can: bool = True,
        up: bool = True,
        bitrate: str = "500000",
        state: str = "ERROR-ACTIVE",
        usb_parent: bool = True,
        arguments: tuple[str, ...] = (),
    ) -> tuple[subprocess.CompletedProcess[str], str]:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fake_bin = root / "bin"
            fake_bin.mkdir()
            state_file = root / "can-state.sh"
            call_log = root / "calls.txt"
            state_file.write_text(
                f"CAN_TEST_EXISTS={'1' if exists else '0'}\n"
                f"CAN_TEST_IS_CAN={'1' if is_can else '0'}\n"
                f"CAN_TEST_UP={'1' if up else '0'}\n"
                f"CAN_TEST_BITRATE={bitrate}\n"
                f"CAN_TEST_STATE={state}\n",
                encoding="utf-8",
            )
            ip_stub = fake_bin / "ip"
            ip_stub.write_text(
                r'''#!/usr/bin/env bash
set -euo pipefail
source "$CAN_TEST_STATE_FILE"
printf 'ip %s\\n' "$*" >> "$CAN_TEST_CALL_LOG"
flags=NOARP,ECHO
[[ "$CAN_TEST_UP" == 1 ]] && flags=NOARP,UP,ECHO
if [[ "$1" == "-o" && "$2" == "link" ]]; then
  [[ "$CAN_TEST_EXISTS" == 1 ]] || exit 1
  printf '4: can0: <%s> mtu 16 qdisc pfifo_fast state UP mode DEFAULT group default qlen 10\\n' "$flags"
elif [[ "$1" == "-details" ]]; then
  [[ "$CAN_TEST_EXISTS" == 1 ]] || exit 1
  printf '4: can0: <%s> mtu 16 qdisc pfifo_fast\\n' "$flags"
  if [[ "$CAN_TEST_IS_CAN" == 1 ]]; then printf '    link/can\\n'; else printf '    link/ether\\n'; fi
  [[ -n "$CAN_TEST_BITRATE" ]] && printf '          bitrate %s sample-point 0.875\\n' "$CAN_TEST_BITRATE"
  printf '          can state %s restart-ms 0\\n' "$CAN_TEST_STATE"
  if [[ "$CAN_TEST_USB_PARENT" == 1 ]]; then
    printf '          gs_usb: tseg1 1..16 parentbus usb parentdev 2-2.1:1.0\\n'
  else
    printf '          can controller details\\n'
  fi
else
  printf 'Unexpected fake ip call: %s\\n' "$*" >&2
  exit 2
fi
''',
                encoding="utf-8",
            )
            ip_stub.chmod(0o755)
            ethtool_stub = fake_bin / "ethtool"
            ethtool_stub.write_text(
                "#!/usr/bin/env bash\n"
                "printf 'driver: gs_usb\\n'\n",
                encoding="utf-8",
            )
            ethtool_stub.chmod(0o755)

            environment = os.environ.copy()
            environment["PATH"] = f"{fake_bin}{os.pathsep}/usr/bin:/bin"
            environment["CAN_TEST_STATE_FILE"] = str(state_file)
            environment["CAN_TEST_CALL_LOG"] = str(call_log)
            environment["CAN_TEST_USB_PARENT"] = "1" if usb_parent else "0"
            result = subprocess.run(
                ["bash", str(REPO_ROOT / "scripts/check.sh"), "can", *arguments],
                cwd=REPO_ROOT,
                env=environment,
                capture_output=True,
                check=False,
                text=True,
                timeout=5,
            )
            calls = call_log.read_text(encoding="utf-8") if call_log.exists() else ""
            return result, calls

    def test_recognized_online_usb_can_interface_passes(self) -> None:
        result, _ = self.run_can_check()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("present, UP, and ERROR-ACTIVE at 500000 bit/s", result.stdout)
        self.assertIn("recognized as a USB-backed SocketCAN adapter", result.stdout)
        self.assertIn("CAN driver: gs_usb", result.stdout)

    def test_missing_interface_fails(self) -> None:
        result, _ = self.run_can_check(exists=False)
        self.assertEqual(result.returncode, 1)
        self.assertIn("is not present", result.stderr)

    def test_non_can_interface_fails(self) -> None:
        result, _ = self.run_can_check(is_can=False)
        self.assertEqual(result.returncode, 1)
        self.assertIn("not a SocketCAN interface", result.stderr)

    def test_non_usb_can_interface_does_not_pass_adapter_check(self) -> None:
        result, _ = self.run_can_check(usb_parent=False)
        self.assertEqual(result.returncode, 1)
        self.assertIn("USB adapter parent was not confirmed", result.stderr)

    def test_down_interface_fails_without_configuring_it(self) -> None:
        result, calls = self.run_can_check(up=False)
        self.assertEqual(result.returncode, 1)
        self.assertIn("is recognized as CAN but is DOWN", result.stderr)
        self.assertNotIn("link set", calls)

    def test_wrong_bitrate_fails(self) -> None:
        result, _ = self.run_can_check(bitrate="250000")
        self.assertEqual(result.returncode, 1)
        self.assertIn("expected 500000 bit/s", result.stderr)

    def test_non_active_controller_state_fails(self) -> None:
        result, _ = self.run_can_check(state="ERROR-PASSIVE")
        self.assertEqual(result.returncode, 1)
        self.assertIn("CAN state is ERROR-PASSIVE", result.stderr)

    def test_help_does_not_access_interface(self) -> None:
        result, calls = self.run_can_check(arguments=("--help",))
        self.assertEqual(result.returncode, 0)
        self.assertIn("Usage: bash scripts/check.sh can", result.stdout)
        self.assertEqual(calls, "")

if __name__ == "__main__":
    unittest.main()
