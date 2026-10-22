# Committing Rules

Rules in this file apply whenever changes are staged, committed, or pushed.

## Commit Planning

- Before staging, present a plan that lists each proposed commit in order, its
  intended commit message, the capability or change it contains, and every
  repository-relative file included in that commit. Show the total file count
  for each commit and annotate every path with exactly one change marker:
  `-add`, `-mod`, or `-del`.
- Organize commits around the functionality or cohesive mechanical change they
  deliver, not around the actions used to produce them. Keep implementation,
  its direct tests, and necessary capability-specific documentation together;
  do not split one feature into separate "implementation", "tests", and
  "documentation" commits just to group by work type. Keep independent
  capabilities separate.
- Keep commits small enough to review independently without splitting a
  capability across arbitrary microcommits. If a set of changes is too large,
  split it along meaningful behavior or component boundaries while keeping
  each resulting commit coherent.
- For work spanning several components, default to separate commits by
  component responsibility and dependency order when each can be reviewed on
  its own (for example, bridge protocol/server, client/state, then UI/launcher).
  Do not combine all layers into one end-to-end umbrella commit just because
  they deliver one overall feature. Keep each layer's direct documentation and
  tests with the change they describe.
- Treat a commit approaching 20 files as a prompt to look for a narrower
  component or behavior split, not as a hard limit. If a larger commit is still
  the clearest coherent unit, explain why its pieces cannot be reviewed
  independently.
- Assign every changed repository-relative path to exactly one commit in the
  plan. Never list the same path under multiple commits or divide edits to one
  file across commits. If one file touches multiple planned capabilities, put
  it in the commit that owns its primary change; if that cannot keep the result
  coherent, combine the closely related capabilities or revise the scope
  before presenting the plan.
- Use a `Files in commit (N)` heading for each file list. A path in that list
  means a repository file included in that commit; it is not a separate
  commit. For a rename, list the old path as `-del` and the new path as `-add`
  under the same commit, and count both path entries there.
- Define `-add` as a new file introduced by the commit, `-mod` as an existing
  file changed by the commit, and `-del` as an existing repository file removed
  by the commit. For a rename, list the old path with `-del` and the new path
  with `-add`.
- Make the per-commit total match the number of listed paths and show the
  add/modify/delete counts when useful. Before presenting the plan, check that
  all changed paths are accounted for once, no path is duplicated across
  commits, and the counts match the listings.
- Keep each commit focused on one cohesive behavior or mechanical change, with
  a suitable amount of implementation and its direct tests. Split large sets
  into smaller, independently reviewable commits instead of combining several
  capabilities in one commit.
- Avoid arbitrary microcommits that have no independent review value.
- When the user asks for a commit plan, provide the plan only. Do not stage,
  commit, or push until the user explicitly approves that plan.

## Commit Scope

- Include tests that directly verify the capability in the same commit.
- Separate mechanical refactors from behavioral changes unless separating them
  would leave the repository broken.
- Keep broad, unrelated documentation updates in a separate commit. Include
  required Code graph inventory, class-interaction, and functionality-path
  updates with the implementation or fix they describe, following
  [code_visualize.md](../code_visualize.md).
- Do not combine unrelated functionality merely to reduce the number of commits.

## Staging And Safety

- Implement and verify the requested work before planning or creating commits.
- Present the completed implementation and verification results for user review.
- Do not stage or commit until the user has reviewed the work and explicitly
  approved the proposed commit plan.
- Preserve unrelated user changes and generated artifacts unless the user
  explicitly includes them.
- Inspect `git diff --cached` and `git diff --cached --check` before every
  commit.
- Run verification appropriate to the staged capability before committing.
- Push only when the user has explicitly requested it.
- Keep the working tree and deferred work understandable after the commit
  sequence.

## Commit Messages

- Use `<type>(<scope>): concise summary`.
- Describe the behavior or repository change delivered by the commit.
- Do not describe future work as if it were included.
