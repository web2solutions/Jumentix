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
- Linear Project link:
- Linear Issue link:
- Current status in project:
- Target cycle (`Start date` -> `End date`):
- Priority group for this PR (`P0` / `P1` / `P2`):
- [ ] This PR contains only one priority group.

## Task Isolation and Naming (Required)

- Task-owned branch:
- Branch nature (`security`):
- Required PR title format: `[JUM-XXXX][Nature] <concise outcome>`
- [ ] This branch and PR contain work for exactly one Linear Issue.
- [ ] Branch format follows `<approved-actor>/security/<issue-id>-<short-slug>`.
- [ ] PR title follows `[JUM-XXXX][Security] <concise outcome>` and the identifier matches the Linear Issue.

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

- [ ] `bun run lint`
- [ ] `bun run test:unit`
- [ ] `bun run ci:gate`
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
