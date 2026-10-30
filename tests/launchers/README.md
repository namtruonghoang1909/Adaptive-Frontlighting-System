# Launcher Tests

These tests check command-line behavior without opening the Dashboard,
starting MetaDrive, or accessing hardware.

| File | What it tests |
|---|---|
| [`test_launchers.py`](test_launchers.py) | Root host launchers' help output, option validation, and system start/stop dispatch rules. |
| [`test_test_scripts.py`](test_test_scripts.py) | Focused test-script help and selector handling, plus the rule that root `scripts/` has only one all-tests entrypoint. |

Run them with `bash tests/scripts/test_launchers.sh` from the repository root.
