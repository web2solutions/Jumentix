# Requirement 055 - Bidirectional Task/PR Traceability (Commit + PR Association)

## Context

To keep GitHub Project tasks auditable and reduce execution ambiguity, every task (issue) and every PR must include explicit, bidirectional traceability metadata.

## Requirement

For **all project tasks** (open or closed), maintain:

1. `PR` reference (URL or `#number`)
2. `Commit` reference (single commit hash or commit range)

At minimum, each task update must include:

- PR linkage to the delivery stream
- commit linkage to implementation evidence

For **all PRs**, maintain:

1. Explicit list of related issue links/IDs.
2. GitHub Project item links/IDs for all related tasks.
3. Clear mapping of which commits/deliverables close which tasks.
4. Back-reference update in each linked issue (comment or issue body update) containing:
   - PR URL
   - commit hash/range
   - task status transition rationale

## Operational Rule

- Before closing a task, verify commit + PR references are present in issue comments or issue body.
- Before marking a PR ready for review, verify all related issues contain back-references to that PR and commit evidence.
- For active tasks not yet implemented, maintain a placeholder traceability update pointing to the active delivery PR and current commit baseline.

## Acceptance Criteria

- All issues under project tracking label (`todo-mvp`) have commit + PR linkage visible.
- All PRs include explicit issue + project item linkage.
- Evidence is bidirectional: issue -> PR and PR -> issue.
- New task/PR updates follow the same traceability format.
