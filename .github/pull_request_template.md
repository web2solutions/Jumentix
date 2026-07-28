## Summary

<!--
Describe the change in 3-8 lines:
- what changed
- why it changed
- expected business/technical outcome
-->

## Problem Statement

<!--
What issue does this PR solve?
Include links to issue(s), incident(s), backlog items, or Sonar/Codecov check URLs.
-->

- Related issue(s):
- Related PR(s):
- Related check run(s):

## Project Tracking (Required)

- Linear Project: `Jumentix` (`https://linear.app/jumentix`)
- Focused epic link:
- Epic milestone:
- Primary task nature:
- Epic-delegated agent ID:
- Child task issue link:
- Project Update:
- Project item link(s):
- Issue link(s):
- Issue ID list (comma separated):
- Item status at PR creation:
- Target cycle (`Start date` -> `End date`):
- Priority group for this PR (`P0` / `P1` / `P2`):
- [ ] This PR contains tasks from only one priority group.

## Branch Promotion Path (Required)

- Source branch:
- Target branch:
- [ ] This task PR targets `dev`.
- [ ] If this PR targets `main`, it is a release promotion sourced from `dev`, references the task PRs/issues already merged into `dev`, and introduces no unreviewed changes.
- [ ] This PR is not a direct task/topic branch promotion to `main`.

## Bidirectional Traceability (Required)

- [ ] Every linked issue already contains this PR URL.
- [ ] Every linked issue already contains commit hash/range evidence.
- [ ] PR description includes mapping of task -> commit(s).
- Task -> commit(s) mapping:
  - `#issue`:

## Scope of Change

<!--
List concrete modifications by area.
Prefer objective statements (files/modules/contracts), not generic descriptions.
-->

### Domain / Business Rules

- 

### Application / Use Cases

- 

### Adapters / Infrastructure

- 

### API / Contracts (OpenAPI, DTOs, handlers, controllers)

- 

## Detailed Technical Changes

<!--
Explain implementation choices and tradeoffs.
If relevant, include:
- architecture decisions
- dependency changes
- migration strategy
- backward compatibility notes
-->

1. 
2. 
3. 

## Architecture and Design Alignment

<!--
Confirm alignment with project requirements:
- DDD
- Event-Driven Design
- Hexagonal Architecture
- SOLID
-->

- [ ] Domain logic remains inside domain/application layers.
- [ ] Controllers/handlers do not instantiate repositories/services directly.
- [ ] Ports/adapters boundaries are respected.
- [ ] No new circular dependencies introduced.
- [ ] Event publishing/listening flow remains consistent.

## Security Impact

<!--
Document security considerations clearly.
If none, explicitly state "No security impact".
-->

- Security impact: 
- Secrets handling reviewed: [ ] Yes [ ] No [ ] N/A
- Input/output sanitization reviewed: [ ] Yes [ ] No [ ] N/A
- AuthN/AuthZ impact: [ ] Yes [ ] No
- Data exposure risk (password/salt/token/PII): [ ] Yes [ ] No
- Sonar security findings addressed or unaffected: [ ] Yes [ ] No

## Data and Migration Impact

<!--
If persistence/schema behavior changed, describe migration and rollback.
If no data impact, state it explicitly.
-->

- Data model impact:
- Migration required: [ ] Yes [ ] No
- Rollback strategy:

## Breaking Changes

<!--
List any breaking behavior, API contract change, or runtime prerequisite.
If none, write "None".
-->

## Acceptance Criteria

<!--
Use verifiable, testable criteria.
-->

- [ ] Feature/bug behavior matches expected functional outcome.
- [ ] Error paths and edge cases are covered.
- [ ] API contract changes (if any) are documented and validated.
- [ ] Architecture boundaries remain enforced.
- [ ] No regression in existing workflows.

## Test Plan (Evidence)

<!--
Paste exact commands and summarized results.
Do not mark items as done unless actually executed.
-->

- [ ] `pnpm run lint`
- [ ] `pnpm run deps:check-cycles`
- [ ] `pnpm run arch:check-boundaries`
- [ ] `pnpm run arch:check-users-legacy-imports`
- [ ] `pnpm run test:unit`
- [ ] `pnpm run oas:check-routes`
- [ ] `pnpm run build:dev`
- [ ] `pnpm run ci:smoke`
- [ ] `pnpm run ci:gate`

### Coverage

- Project coverage >= 95%: [ ] Yes [ ] No
- Patch coverage >= 95%: [ ] Yes [ ] No
- Codecov status passing: [ ] Yes [ ] No

### SonarQube Cloud

- Quality Gate passing: [ ] Yes [ ] No
- New vulnerabilities introduced: [ ] Yes [ ] No
- New security hotspots reviewed: [ ] Yes [ ] No [ ] N/A

## Performance / Reliability Impact

<!--
State impact on latency, throughput, memory, startup, locking, retries, etc.
If not applicable, write "No measurable impact".
-->

## Observability

<!--
Describe logging, metrics, tracing, alerting changes.
-->

- Logs updated: [ ] Yes [ ] No
- Metrics/Tracing updated: [ ] Yes [ ] No [ ] N/A

## Deployment and Rollout

<!--
Explain how this should be released safely.
-->

- Deployment notes:
- Feature flag needed: [ ] Yes [ ] No
- Rollout strategy:
- Rollback steps:

## Risks and Mitigations

<!--
List top risks and how each is mitigated.
-->

1. Risk:
   Mitigation:
2. Risk:
   Mitigation:

## Documentation Updates

- [ ] README updated (if needed)
- [ ] Additional docs updated (if needed)
- [ ] Changelog updated/synced (`pnpm run changelog:update`)

## Reviewer Checklist

- [ ] Changes are clear and scoped.
- [ ] Acceptance criteria are testable and satisfied.
- [ ] Tests are sufficient for risk level.
- [ ] Security and data impacts are addressed.
- [ ] CI checks pass fully.
