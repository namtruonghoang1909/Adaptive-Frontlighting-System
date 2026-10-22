# Application

`runner_bridge_main.cpp` configures the runner and Dashboard socket paths,
starts `DashboardIpcServer` on a worker thread, runs `RunnerIpcServer` on the
main thread, and coordinates their shutdown. CAN worker composition remains
future work.
