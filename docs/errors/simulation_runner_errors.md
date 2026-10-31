# Simulation Runner Errors

No project-specific MetaDrive or runner runtime failure with a confirmed fix
is recorded here yet. For a new issue, capture the exact command, selected
Python interpreter, full runner traceback/output, MetaDrive window state, and
whether the bridge was running.

Check prerequisites and invocation details in
[`simulation_runner/runner.md`](../../simulation_runner/runner.md). Run the
focused runner suite with:

```bash
bash tests/scripts/test_runner.sh
```

If the runner starts but scene data does not reach the bridge, check
[Unix-socket IPC troubleshooting](ipc_errors.md).
