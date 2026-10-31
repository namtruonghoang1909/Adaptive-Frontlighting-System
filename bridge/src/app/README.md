# Application

`runner_bridge_main.cpp` configures the runner and Dashboard socket paths,
starts `DashboardIpcServer` on a worker thread, runs `RunnerIpcServer` on the
main thread, and coordinates their shutdown. If `--can-interface NAME` is
provided, it constructs `CanRuntime` before starting the IPC services and runs
the CAN worker on a separate thread. Without that option the IPC services run
without opening a CAN socket. A requested interface must already be configured
and up; runtime I/O errors are logged and retried without stopping IPC.
