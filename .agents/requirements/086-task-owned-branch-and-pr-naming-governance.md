# Requirement 086 - Task-Owned Branch, PR Naming, and Promotion Governance

## Context

Jumentix delivery must keep each tracked task independently reviewable, auditable, and reversible.
Sharing a branch or pull request across unrelated tasks obscures ownership, evidence, and rollback boundaries.
Branch names and pull request titles must also identify the nature of the change at a glance.
Every delivery boundary must execute its destination-appropriate quality gate and must fail
closed when the selected required suite is missing, skipped, empty, aborted, or unsuccessful.

## Mandatory Rules

1. Every GitHub Issue executed as a task must have its own branch and its own pull request.
2. A branch or pull request must not contain work for more than one task, even when tasks share a priority.
3. Codex-created branches must use `codex/<nature>/<issue-id>-<short-slug>`.
4. Other automation or human workflows may replace `codex` with their approved actor prefix, but the `<nature>/<issue-id>-<short-slug>` portion remains mandatory.
5. Pull request titles must use `[<Nature>] <concise outcome>`.
6. Allowed nature values are `feature`, `fix`, `security`, `governance`, `docs`, `refactor`, `test`, `ci`, `release`, and `chore`.
7. The branch nature and pull request title nature must describe the same change category.
8. Every task-owned pull request must target the `dev` branch first.
9. A pull request targeting `main` is allowed only when its source branch is `dev`.
10. Direct task, feature, fix, or topic branches must never target or merge into `main`.
11. A `dev` to `main` pull request is a release-promotion boundary, not a replacement for task-owned pull requests. It must introduce no unreviewed changes and must reference the task PRs and issues already merged into `dev`.
12. Direct pushes or merges to `main` outside the `dev` release-promotion pull request are prohibited.
13. Commits and pushes on task-owned branches must run only changed/related unit tests;
    merges and PRs targeting `dev` must run the canonical unit-test gate.
14. Commits, pushes, and merges targeting `main` must run the canonical full test matrix.
15. CI must run the unit-test gate for PRs to `dev`; release-promotion PRs from `dev` to
    `main` must run the full matrix and expose every required cell as auditable evidence.
16. A full matrix includes every required unit, integration, adapter/framework, realtime, workspace, contract, architecture, security, smoke, build, and coverage suite declared by the repository.
17. Required suites must propagate their real non-zero exit status. Masked failures, unconditional success fallbacks, `--passWithNoTests`, swallowed errors, and success after missing/empty discovery are prohibited.
18. A required matrix cell that is skipped, cancelled, timed out, not reported, or unable to start is a failure, not a green result.
19. Scope-aware optimization is permitted only for task-branch commit/push validation;
    it must not omit all unit tests for `dev` PRs or required matrix cells for `main`.
20. Exceptions require explicit approval recorded in the linked issue and pull request; exceptions may not bypass the `dev`-first promotion path or convert a failed or incomplete matrix into success.
21. PR review is not a merge prerequisite. All required non-review checks remain mandatory and cannot be bypassed for any merge.

## Examples

- Branch: `codex/governance/133-task-branch-pr-naming`
- Pull request: `[Governance] Enforce task-owned branches and pull requests`
- Branch: `codex/ci/134-prevent-false-green-integration-tests`
- Pull request: `[CI] Prevent false-green integration test results`

## Acceptance Criteria

1. Governance specs define the one-task/one-branch/one-PR rule and naming contract.
2. Pull request templates require the source branch, target branch, PR nature, and one-task isolation attestation.
3. Task PRs target `dev`, while only release-promotion PRs sourced from `dev` may target `main`.
4. Branch protection or CI rejects any PR to `main` whose source branch is not `dev`.
5. Gate 5 treats missing task isolation, invalid naming, or an invalid source/target branch path as a merge blocker.
6. Commit and push hooks select changed/related tests for task branches, full unit tests
   for `dev`, or the full matrix for `main`.
7. Main promotion CI requires the full-matrix contract and reports incomplete, missing, or failed cells as failure.
8. A deliberate failing test proves that commit, push, and PR gates cannot produce a false green.
9. Requirement registry, NFR registry, traceability ledger, coverage status, and bilingual documentation remain synchronized.

## Evidence and Scope

- Applies to human and AI delivery across the monorepo.
- Evidence includes the linked issue, task-owned branch, task-owned pull request to `dev`, `dev` to `main` promotion provenance when applicable, naming fields, selected-gate evidence, full-matrix manifest/per-cell results for `main`, and validation logs.
- Complements requirements `011`, `056`, `057`, `064`, `065`, `067`, `068`, `071`, `072`, `073`, and `076`.
