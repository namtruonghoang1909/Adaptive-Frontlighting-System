# Dashboard Models

`state.py` contains the thread-safe `DemoDashboardState` used for simulated ECU
execution, health, and fallback ego samples. `GatewayDashboardState` overlays
fresh runner speed and steering and bridge request status on these values.
Simulated values remain labeled until ECU reception is implemented.
