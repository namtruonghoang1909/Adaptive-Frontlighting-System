# Launcher Tests

These tests check command-line behavior without opening the Dashboard,
starting MetaDrive, or accessing hardware.

| File | What it tests |
|---|---|
| [`test_launchers.py`](test_launchers.py) | Shared start/check dispatchers, option forwarding and validation, system start/stop rules, SavvyCAN executable selection, mocked CAN setup/check behavior, and side-effect-free help. |
| [`test_test_scripts.py`](test_test_scripts.py) | Focused test-script help and selector handling, plus the rule that the full-suite runner lives under root `tests/`. |

Run them with `bash tests/scripts/test_launchers.sh` from the repository root.
