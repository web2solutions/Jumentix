# Requirement 067 - Bidirectional Task/PR Traceability Governance

## Context
- Jumentix requires strict project governance with GitHub Project as source of truth.
- Delivery evidence must be auditable from both directions: task to PR, and PR to task.

## Mandatory Rules
1. Every tracked task/issue must include:
   - related PR URL/number
   - commit hash or commit range
2. Every PR must include:
   - related issue IDs/links
   - related GitHub Project item links
   - explicit mapping of task -> commit(s)
3. Before a task is closed:
   - issue body/comment must contain PR + commit evidence
4. Before PR review:
   - all linked issues must already contain back-reference to the PR and commit evidence

## Acceptance Criteria
- Traceability is bidirectional (`issue -> PR/commit` and `PR -> issue/task mapping`).
- Project board items and PR descriptions provide complete linkage for audit and governance.
