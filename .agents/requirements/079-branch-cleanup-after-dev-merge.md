# Requirement 079 - Branch Cleanup After Merge to Dev

## Context

Long-lived feature and bug branches create noise, increase maintenance overhead, and make branch discovery harder.

## Requirement

1. Feature branches and bugfix branches must be deleted after they are merged into `dev`.
2. This applies to both local and remote branches.
3. Exceptions must be explicitly documented in the related issue/PR when a branch must be kept.

## Acceptance Criteria

1. Governance docs reference branch cleanup after merge to `dev`.
2. Completed feature/bug PR flow includes branch deletion step.
3. Kept branches always include documented rationale.
