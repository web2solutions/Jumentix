# Requirement 101 - Active-task Switching While Checks Run

When a task is waiting only for remote CI, review, or another external check, the accountable agent must progress another active, non-conflicting task instead of idling. Each task retains its own worktree, branch, PR, Linear status, and evidence. Agents must recheck the waiting task at material boundaries and must not merge until every required gate is terminally successful.
