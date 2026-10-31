# Test And Verification Errors

No test-runner infrastructure failure with a confirmed resolution is recorded
here yet. When a test fails, retain the complete failing command and output,
test selector, runtime/toolchain versions, and whether the failure is a software
assertion or a missing external prerequisite.

Start with the narrowest component test documented in the
[central test guide](../../tests/README.md). The all-component command is
`bash tests/test_all.sh`; adapter, physical CAN, ST-Link, and actuator checks
remain hardware procedures and are not replaced by host tests.
