# Dashboard Errors

No project-specific Dashboard failure with a confirmed cause and fix is
recorded here yet. When reporting a new issue, capture the launcher command,
Python interpreter, full terminal output, whether the native window appeared,
and the bridge connection/status shown in the UI.

Use the [Dashboard component guide](../../dashboard/README.md) for startup and
data ownership. Run the focused regression suite with:

```bash
bash tests/scripts/test_dashboard.sh
```

If the window opens but bridge state is missing, check
[Unix-socket IPC troubleshooting](ipc_errors.md).
