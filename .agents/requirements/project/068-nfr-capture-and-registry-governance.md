# Requirement 068 - NFR Capture and Registry Governance

## Context
- User-defined non-functional requirements (NFRs) are mandatory governance artifacts.
- Jumentix requires all requested NFRs to be persisted in `.agents` and kept auditable.

## Mandatory Rules
1. Every user-requested NFR must be stored in `.agents/requirements/` as a dedicated requirement file or explicitly mapped to an existing requirement file.
2. Every stored NFR must be indexed in `.agents/README.md`.
3. A consolidated NFR registry document must be maintained with category-to-requirement mapping.
4. When a new NFR is requested, agents files must be updated in the same delivery cycle (no deferred capture).
5. PRs that introduce or change NFR behavior must reference the affected NFR requirement IDs.

## Acceptance Criteria
- No known user-requested NFR remains undocumented in `.agents`.
- `.agents/README.md` and NFR registry are synchronized with current requirement set.
- NFR traceability is visible from requirement file -> implementation/PR context.
