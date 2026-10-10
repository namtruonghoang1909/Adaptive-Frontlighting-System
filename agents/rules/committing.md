# Committing Rules

Rules in this file apply whenever changes are staged, committed, or pushed.

## Commit Planning

- Before staging, present a plan that lists each proposed commit in order, its
  intended commit message, the capability or change it contains, and every
  repository-relative file included in that commit. Show the total file count
  for each commit and annotate every path with exactly one change marker:
  `-add`, `-mod`, or `-del`.
- Define `-add` as a new file introduced by the commit, `-mod` as an existing
  file changed by the commit, and `-del` as an existing repository file removed
  by the commit. For a rename, list the old path with `-del` and the new path
  with `-add`.
- Make the per-commit total match the number of listed paths and show the
  add/modify/delete counts when useful.
- Keep each commit focused on one cohesive behavior or mechanical change, with
  a suitable amount of implementation and its direct tests. Split a large set
  of changes into smaller, independently reviewable commits instead of
  combining several capabilities in one commit.
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
