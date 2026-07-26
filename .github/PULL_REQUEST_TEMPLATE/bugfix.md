## Bugfix Summary

<!-- What was broken and what was fixed -->

## Root Cause

<!-- Explain the real technical cause -->

## Scope

- Affected modules/files:
- In scope:
- Out of scope:

## Project Tracking (Required)

- GitHub Project: `Jumentix` (`https://github.com/users/web2solutions/projects/1`)
- Project item link:
- Issue link:
- Current status in project:
- Target cycle (`Start date` -> `End date`):
- Priority group for this PR (`P0` / `P1` / `P2`):
- [ ] This PR contains only one priority group.

## Task Isolation and Naming (Required)

- Task-owned branch:
- Source branch:
- Target branch:
- Branch nature (`fix`):
- PR title prefix (`[Fix]`):
- [ ] This branch and PR contain work for exactly one GitHub Issue.
- [ ] Branch format follows `<approved-actor>/fix/<issue-id>-<short-slug>`.
- [ ] PR title follows `[Fix] <concise outcome>`.
- [ ] This task PR targets `dev`.
- [ ] If this PR targets `main`, it is a release promotion sourced from `dev` and introduces no unreviewed changes.

## Behavior Before vs After

### Before

<!-- User/system behavior before fix -->

### After

<!-- User/system behavior after fix -->

## Acceptance Criteria

- [ ] Reproducible bug scenario now passes.
- [ ] Related edge cases are covered.
- [ ] No regression in adjacent flows.
- [ ] API/contract behavior remains valid (or documented if changed).

## Test Evidence

- [ ] Full matrix ran for every commit.
- [ ] Full matrix ran for the push.
- [ ] PR CI reports every required matrix cell.
- [ ] No required cell is missing, skipped, empty, cancelled, timed out, aborted, or unreported.
- [ ] Failure-propagation evidence proves no false green.
- [ ] `pnpm run lint`
- [ ] `pnpm run test:unit`
- [ ] `pnpm run oas:check-routes`
- [ ] `pnpm run build:dev`
- [ ] `pnpm run ci:smoke`
- [ ] `pnpm run ci:gate`

## Security and Data Impact

- Security impact:
- Data/persistence impact:
- Breaking changes: None / Describe

## Risk and Rollback

- Main risk:
- Mitigation:
- Rollback plan:
