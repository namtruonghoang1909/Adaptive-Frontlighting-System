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

- Do not consider a code change ready for handoff until the source inventory is
  regenerated, its freshness check and graph validator pass, and affected
  viewer behavior has been checked as described in
  [code_visualize.md](../code_visualize.md).

## Prohibited Changes

<!-- Add patterns or dependencies that must not be introduced here. -->
