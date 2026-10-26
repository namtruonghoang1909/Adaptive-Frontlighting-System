# Dashboard Tests

`test_gateway_status.py` covers live/stale `0x500` status mapping, fault and
applied-sector presentation data, simulated fallback before the first ECU
sample, and clear-fault acceptance without claiming ECU execution. CMake
registers it as `dashboard_gateway_status` when Python 3 is available.

`test_commands.py` covers mode and power selection, the disabled mode control
when headlights are off, simulated fault clearing, disconnected commands,
queued bridge requests, and input validation without opening a Tk window.

Run all Dashboard tests with `bash tools/test_components.sh dashboard` from the
repository root.
