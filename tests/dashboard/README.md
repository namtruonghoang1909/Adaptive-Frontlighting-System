# Dashboard Tests

Dashboard test cases are grouped by behavior:

| Folder | What it tests |
|---|---|
| [`commands/`](commands/) | Power and mode selection, command validation, offline behavior, and bridge command handling. |
| [`gateway_status/`](gateway_status/) | Mapping fresh, stale, or unavailable ECU status into the Dashboard presentation, including separation of requested and executed modes. |

Run all Dashboard tests with `bash tests/scripts/test_dashboard.sh`. To run one
area, use `bash tests/scripts/test_dashboard.sh commands` or
`bash tests/scripts/test_dashboard.sh gateway_status`. See the
[component test guide](../scripts/test_guide.md) for other test entrypoints.
