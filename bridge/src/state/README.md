# State

The runner receiver stores its current validated `RunnerScene` as one complete
snapshot and exposes copies through `RunnerIpcServer::latest_scene()` guarded
by a short mutex. Other Dashboard, decoded ECU, and health snapshots remain
future work.
