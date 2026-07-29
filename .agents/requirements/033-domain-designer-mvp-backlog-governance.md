# Requirement 033 - Domain Designer MVP Backlog Governance

## Context
Domain Designer is now an active product surface inside the repository and must follow explicit backlog governance.

## Rules
1. Every new Domain Designer MVP idea must be registered as a Linear Issue in its focused Linear
   Project.
2. `.agents/project-todos.md` may mirror the `Open` and `Done` views for historical or local
   reference, but it is not authoritative.
3. Completed MVP items move to `Done` in Linear only after delivery gates and the final Project
   Update are complete; any local mirror is synchronized in the same change when applicable.
4. When implementation is paused by explicit user instruction, Linear backlog capture remains
   mandatory.
5. Documentation updates remain mandatory for each delivered Domain Designer feature.

## Implementation Notes
- Backlog tracking is part of delivery quality, not optional project metadata.
- Linear is the source of truth for sequencing MVP work before larger feature phases.
