# Spec Delivery Gates and Evidence

This document converts Spec Development Driven rules into executable gates and audit evidence.

## Gate Model

All Jumentix deliveries pass through five gate types.

## Gate 1 - Spec Completeness

Pass criteria:

1. Affected contracts are updated (`OpenAPI`, `AsyncAPI`, messages/errors as applicable).
2. Affected domain/data docs are updated.
3. Affected runtime/governance docs are updated.

Evidence:

1. PR file list references spec/doc files.
2. Traceability section maps change scope to updated spec resources.

## Gate 2 - Architecture Conformance

Pass criteria:

1. DDD, Event-Driven, and Hexagonal boundaries are preserved.
2. Layer call order remains compliant.
3. No prohibited coupling/circular imports introduced.

Evidence:

1. Architecture checks in CI (boundary/cycle/workspace scripts).
2. Review notes for boundary-sensitive changes.

## Gate 3 - Behavioral Verification

Pass criteria:

1. Unit tests cover changed logic.
2. Integration tests cover changed interface behavior.
3. Smoke tests validate runtime paths when adapters/infra change.

Evidence:

1. Green test suites in CI.
2. Added tests for new behavior included in PR scope.

Execution policy:

1. `ci:gate` remains the fast baseline defined by requirement `011`, including the representative integration smoke.
2. `ci:gate:branch` is the canonical boundary selector: task branches run changed/related
   tests, `dev` runs all unit tests, and `main` runs the full matrix.
3. `ci:gate:strict` remains the canonical release-promotion full-matrix gate.
4. Its manifest covers lint, architecture, contracts, governance, unit, security, smoke, builds, every workspace, the complete 15-target HTTP/Lambda/realtime/Service Management integration matrix, and patch coverage.
5. Every matrix runner must reject an empty, duplicate, malformed, or missing-script manifest.
6. Execution continues after an individual cell fails and returns one aggregate non-zero result listing every failed cell.
7. Docs-only task changes may record `not-applicable`; no scope-aware plan may omit all
   unit tests for `dev` or the canonical matrix for `main`.
8. Integration targets run with coverage disabled so they cannot overwrite the unit-test coverage artifact governed by requirement `014`.
9. Remote CI publishes the selected-gate JSON evidence and the main-matrix JSON evidence when applicable.

## Gate 4 - Quality and Security

Pass criteria:

1. Coverage thresholds meet policy.
2. Security/compliance checks are green.
3. Error/secret handling remains policy-compliant.

Evidence:

1. Coverage reports and gate logs.
2. Security scan/check outputs.

## Gate 5 - Governance Traceability

Pass criteria:

1. Linear Issue, focused Project, milestone, Project Update, and GitHub PR are linked.
1. Issue, project item, and PR are linked.
2. Priority/size/estimation lifecycle fields are populated.
3. Requirement/NFR references are included when applicable.
4. Every Linear Project used as an epic has a dedicated documentation Issue.
5. The epic documentation Issue is completed before the Project is set to `Completed`.
6. Every executing agent publishes the required task-specific Linear Project Updates.
7. Every completed task has a final Project Update with no unresolved blocker or incomplete
   required gate.

Evidence:

1. Linear Issue/Project/milestone/Project Update links plus GitHub branch/commit/PR evidence.
1. GitHub issue/project/PR cross-links.
2. Updated `.agents` registry when governance or NFR changed.
3. Linear Project link plus the completed documentation Issue, PR/commit links, changed-document
   inventory, bilingual parity evidence when applicable, and documentation integrity results.
4. Linear Project Updates feed with task, agent, status, outcome, delivery artifacts, exact gate
   states, blockers or risks, and next action.

## Evidence Packaging Standard for PRs

Each PR should include:

1. Scope summary
2. Requirement IDs impacted
3. Spec files updated
4. Test/coverage/security evidence summary
5. Risk and rollback notes (for infra/runtime/data changes)

## Blocking Policy

A PR is not merge-ready when any of these is missing:

1. Spec updates for changed behavior.
2. Required checks or coverage threshold.
3. Governance traceability links.
4. Required `.agents` updates for NFR/governance impact.
5. A missing or incomplete dedicated documentation Issue for an epic being completed.
6. A missing, stale, misleading, or incomplete required Project Update for an active or completed
   task.
