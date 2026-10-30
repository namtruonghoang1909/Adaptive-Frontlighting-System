# Test-Runner Tests

[`test_test_tree.py`](test_test_tree.py) protects the central test layout and
the focused-suite interface. It checks that component tests stay under root
`tests/`, the shared dispatcher lists valid selectors, invalid selectors fail
before a suite starts, and only the root full-suite command can request every
component.

Run it with `bash tests/scripts/test_test_runner.sh` from the repository root.
