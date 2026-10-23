# Dashboard Tests

`test_gateway_status.py` covers live/stale `0x500` status mapping, fault and
applied-sector presentation data, simulated fallback before the first ECU
sample, and clear-fault acceptance without claiming ECU execution. CMake
registers it as `dashboard_gateway_status` when Python 3 is available.
