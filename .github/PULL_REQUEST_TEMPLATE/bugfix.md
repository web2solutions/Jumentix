## Bugfix Summary

<!-- What was broken and what was fixed -->

## Root Cause

<!-- Explain the real technical cause -->

## Scope

- Affected modules/files:
- In scope:
- Out of scope:

## Project Tracking (Required)

- Linear Project: `Jumentix` (`https://linear.app/jumentix`)
- Focused epic link:
- Epic milestone:
- Primary task nature:
- Epic-delegated agent ID:
- Child task issue link:
- Project Update:
- Linear Project link:
- Linear Issue link:
- Current status in project:
- Target cycle (`Start date` -> `End date`):
- Priority group for this PR (`P0` / `P1` / `P2`):
- [ ] This PR contains only one priority group.

## Task Isolation and Naming (Required)

- Task-owned branch:
- Branch nature (`fix`):
- Required PR title format: `[JUM-XXXX][Nature] <concise outcome>`
- [ ] This branch and PR contain work for exactly one Linear Issue.
- [ ] Branch format follows `<approved-actor>/fix/<issue-id>-<short-slug>`.
- [ ] PR title follows `[JUM-XXXX][Fix] <concise outcome>` and the identifier matches the Linear Issue.

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

- [ ] `bun run lint`
- [ ] `bun run test:unit`
- [ ] `bun run oas:check-routes`
- [ ] `bun run build:dev`
- [ ] `bun run ci:smoke`
- [ ] `bun run ci:gate`

## Security and Data Impact

- Security impact:
- Data/persistence impact:
- Breaking changes: None / Describe

## Risk and Rollback

- Main risk:
- Mitigation:
- Rollback plan:
