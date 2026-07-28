## Security Change Summary

<!-- Describe the vulnerability/risk addressed -->

## Vulnerability Context

- Source: Sonar / SAST / Dependency alert / Incident / Manual review
- Rule/CVE/Reference:
- Severity:
- Affected components:

## Project Tracking (Required)

- GitHub Project: `Jumentix` (`https://github.com/users/web2solutions/projects/1`)
- Focused epic link:
- Epic milestone:
- Primary task nature: `security`
- Epic-delegated agent ID:
- Child task issue link:
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
- Branch nature (`security`):
- PR title prefix (`[Security]`):
- [ ] This branch and PR contain work for exactly one GitHub Issue.
- [ ] Branch format follows `<approved-actor>/security/<issue-id>-<short-slug>`.
- [ ] PR title follows `[Security] <concise outcome>`.
- [ ] This task PR targets `dev`.
- [ ] If this PR targets `main`, it is a release promotion sourced from `dev` and introduces no unreviewed changes.

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

- [ ] Full matrix ran for every commit.
- [ ] Full matrix ran for the push.
- [ ] PR CI reports every required matrix cell.
- [ ] No required cell is missing, skipped, empty, cancelled, timed out, aborted, or unreported.
- [ ] Failure-propagation evidence proves no false green.
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
