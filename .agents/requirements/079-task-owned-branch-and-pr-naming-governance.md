# Requirement 079 - Task-Owned Branch and PR Naming Governance

## Context

Jumentix delivery must keep each tracked task independently reviewable, auditable, and reversible.
Sharing a branch or pull request across unrelated tasks obscures ownership, evidence, and rollback boundaries.
Branch names and pull request titles must also identify the nature of the change at a glance.

## Mandatory Rules

1. Every GitHub Issue executed as a task must have its own branch and its own pull request.
2. A branch or pull request must not contain work for more than one task, even when tasks share a priority.
3. Codex-created branches must use `codex/<nature>/<issue-id>-<short-slug>`.
4. Other automation or human workflows may replace `codex` with their approved actor prefix, but the `<nature>/<issue-id>-<short-slug>` portion remains mandatory.
5. Pull request titles must use `[<Nature>] <concise outcome>`.
6. Allowed nature values are `feature`, `fix`, `security`, `governance`, `docs`, `refactor`, `test`, `ci`, `release`, and `chore`.
7. The branch nature and pull request title nature must describe the same change category.
8. Exceptions require explicit approval recorded in the linked issue and pull request.

## Examples

- Branch: `codex/governance/133-task-branch-pr-naming`
- Pull request: `[Governance] Enforce task-owned branches and pull requests`
- Branch: `codex/ci/134-prevent-false-green-integration-tests`
- Pull request: `[CI] Prevent false-green integration test results`

## Acceptance Criteria

1. Governance specs define the one-task/one-branch/one-PR rule and naming contract.
2. Pull request templates require the branch name, PR nature, and one-task isolation attestation.
3. Gate 5 treats missing task isolation or invalid naming as a merge blocker.
4. Requirement registry, NFR registry, traceability ledger, coverage status, and bilingual documentation remain synchronized.

## Evidence and Scope

- Applies to human and AI delivery across the monorepo.
- Evidence includes the linked issue, task-owned branch, task-owned pull request, naming fields, and validation results.
- Complements requirements `056`, `057`, `064`, `067`, `068`, `071`, `072`, `073`, and `076`.
