## Feature Summary

<!-- What capability is being added and for whom -->

## Business / Product Context

- Problem solved:
- Expected outcome:
- Related issue/roadmap:

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
- Branch nature (`feature`):
- PR title prefix (`[Feature]`):
- [ ] This branch and PR contain work for exactly one GitHub Issue.
- [ ] Branch format follows `<approved-actor>/feature/<issue-id>-<short-slug>`.
- [ ] PR title follows `[Feature] <concise outcome>`.

## Scope

- Affected modules/files:
- New contracts/endpoints/events:
- Out of scope:

## Architecture Alignment

- [ ] DDD boundaries preserved.
- [ ] Hexagonal ports/adapters respected.
- [ ] Controller -> use case flow maintained.
- [ ] No circular dependencies introduced.

## Acceptance Criteria

- [ ] Functional behavior implemented as specified.
- [ ] Error/validation scenarios covered.
- [ ] Observability/logging is sufficient.
- [ ] Documentation updated if API behavior changed.

## Test Evidence

- [ ] `pnpm run lint`
- [ ] `pnpm run deps:check-cycles`
- [ ] `pnpm run arch:check-boundaries`
- [ ] `pnpm run arch:check-users-legacy-imports`
- [ ] `pnpm run test:unit`
- [ ] `pnpm run oas:check-routes`
- [ ] `pnpm run build:dev`
- [ ] `pnpm run ci:smoke`
- [ ] `pnpm run ci:gate`

## Coverage and Quality Gates

- [ ] Project coverage >= 95%
- [ ] Patch coverage >= 95%
- [ ] Codecov passing
- [ ] Sonar Quality Gate passing

## Rollout

- Feature flag: Yes / No
- Release plan:
- Rollback plan:
