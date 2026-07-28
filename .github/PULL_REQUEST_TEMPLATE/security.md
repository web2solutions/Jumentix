## Security Change Summary

<!-- Describe the vulnerability/risk addressed -->

## Vulnerability Context

- Source: Sonar / SAST / Dependency alert / Incident / Manual review
- Rule/CVE/Reference:
- Severity:
- Affected components:

## Project Tracking (Required)

- Linear Project: `Jumentix` (`https://linear.app/jumentix`)
- Focused epic link:
- Epic milestone:
- Primary task nature:
- Epic-delegated agent ID:
- Child task issue link:
- Project Update:
- Project item link:
- Issue link:
- Current status in project:
- Target cycle (`Start date` -> `End date`):
- Priority group for this PR (`P0` / `P1` / `P2`):
- [ ] This PR contains only one priority group.

## Task Isolation and Naming (Required)

- Task-owned branch:
- Branch nature (`security`):
- PR title prefix (`[Security]`):
- [ ] This branch and PR contain work for exactly one GitHub Issue.
- [ ] Branch format follows `<approved-actor>/security/<issue-id>-<short-slug>`.
- [ ] PR title follows `[Security] <concise outcome>`.

## Remediation Details

1. 
2. 
3. 

## Security Acceptance Criteria

- [ ] Vulnerability is no longer reproducible.
- [ ] No sensitive data leakage in responses/logs.
- [ ] Secrets are not hardcoded.
- [ ] Auth/AuthZ behavior remains correct.
- [ ] Static analysis findings are resolved or justified.

## Validation Evidence

- [ ] `pnpm run lint`
- [ ] `pnpm run test:unit`
- [ ] `pnpm run ci:gate`
- [ ] Sonar check passing
- [ ] Codecov passing

## Regression and Compatibility

- Backward compatibility:
- Data migration impact:
- Operational impact:

## Risk and Contingency

- Residual risk:
- Monitoring/alert updates:
- Rollback plan:
