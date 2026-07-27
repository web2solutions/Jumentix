# Spec Engineering Practices and Git Policy

This specification defines mandatory engineering execution rules for Jumentix delivery.

These rules are part of Spec Development Driven governance and apply to all components in the monorepo.

## 1) Git Usage Policy

1. All work must be traceable to GitHub Issue + GitHub Project item before implementation.
2. Development must happen on tracked branches and produce auditable commits.
3. `--no-verify` is prohibited for normal delivery flow.
4. Push is blocked when local quality gates fail.
5. Task/PR traceability must be bidirectional:
   - issue references PR(s)/commit(s)
   - PR references issue(s), project item context, and evidence

## 2) Commit Message Policy

1. Conventional Commit format is mandatory.
2. Commit scopes should reflect change nature (for example: `feat(domain)`, `fix(runtime)`, `docs(spec)`, `chore(ci)`).
3. Mixed-scope changes must be split by nature when possible.
4. Commit history must remain meaningful for changelog and release governance automation.

## 3) Lint and Static Quality Policy

1. Lint must pass for merge readiness.
2. Architecture checks (boundaries, cycles, workspace constraints) must pass.
3. OpenAPI route resolution checks must pass when API contracts are in scope.
4. Coverage thresholds are mandatory and enforce merge/push policy.
5. Task-branch commits and pushes execute only changed/related unit tests. Pull requests
   to `dev` execute all unit tests, and `main` executes the full matrix. Smoke-only,
   missing, empty, skipped, or unreported results are not delivery evidence; docs-only
   task changes must explicitly record `not-applicable` evidence.

## 4) Coding Best Practices Policy

1. Follow DDD + Event-Driven + Hexagonal architecture constraints.
2. Keep layer boundaries strict (`Handler -> Controller -> Use Case -> Domain -> Repository Port -> Adapter`).
3. Prefer existing project patterns and shared package abstractions over ad-hoc divergence.
4. Keep changes scoped to requested behavior and related boundaries.
5. Use contract-first design for API/realtime/event/error behavior.
6. Any model/entity/value-object change must synchronize OpenAPI/AsyncAPI/docs.

## 5) Package and Tooling Policy

1. `pnpm` is the package manager standard for the monorepo.
2. New dependencies must respect workspace boundaries and package ownership.
3. Shared generic adapters should be delivered as reusable packages.

## 6) PR Readiness Policy

A PR is merge-ready only when all are true:

1. Linked issue + project context exists.
2. Spec updates are included for changed behavior/policies.
3. Lint/tests/coverage/security gates are green.
4. Commit messages and change grouping follow governance rules.
5. Docs and `.agents` registries are synchronized when required.
6. A repository administrator may bypass only the review-count requirement when explicit
   project-owner approval is recorded. Required delivery topology and every selected quality,
   coverage, and security gate remain terminal-green blockers.

## 7) Enforcement Anchors

Primary enforcement sources:

1. `.husky/*`
2. `ci-cd/*` quality and governance scripts
3. `documentation/md/TESTING-CI-AND-QUALITY.md`
4. `documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md`
5. `.agents/requirements/065-commit-push-integrity-and-real-ci-enforcement.md`
6. `.agents/requirements/067-bidirectional-task-pr-traceability-governance.md`
