# Coding Rules

Rules in this file apply to source code, configuration, and tests.

## Style And Language

<!-- Add language-specific formatting, naming, and compatibility rules here. -->

## Architecture And Ownership

- Every implementation, bug fix, refactor, and removal must follow the
  [Code graph maintenance workflow](../code_visualize.md) in the same task.
  Review both class interactions and ordered functionality paths, including
  behavior-only changes that do not alter file layout or architecture.

## Error Handling And Diagnostics

<!-- Add validation, failure-reporting, and logging rules here. -->

## Testing And Verification

- Treat tests as a required part of implementation. When changing behavior,
  add or update a focused regression case under the matching module in root
  `tests/`; then run the matching `tests/scripts/test_<component>.sh MODULE` and
  the containing component suite. Run `bash tests/test_all.sh` for
  cross-component changes and integration handoffs. Report the exact commands
  and results, including any suite that could not run. Do not describe an
  implementation as validated if its applicable tests were not run.
- Software suites cover host behavior and the ECU build. Verify physical CAN,
  SWD/RTT, and actuators on the rig when changes affect those interfaces.
- Do not consider a code change ready for handoff until the source inventory is
  regenerated, its freshness check and graph validator pass, and affected
  viewer behavior has been checked as described in
  [code_visualize.md](../code_visualize.md).

## Prohibited Changes

<!-- Add patterns or dependencies that must not be introduced here. -->
