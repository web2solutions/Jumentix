# Spec Governance and Traceability

Spec Development Driven in Jumentix is enforced through project governance and auditable links.

## Single Source of Truth

Governance source of truth:

- GitHub Project Jumentix: `https://github.com/users/web2solutions/projects/1`

Mandatory governance records:

1. GitHub Issue (work item)
2. Project item with planning fields
3. PR with linked issue and evidence
4. Spec and documentation artifacts

## Mandatory Traceability Links

Every delivery item must expose:

1. `Issue -> Project item`
2. `Issue -> Spec files changed`
3. `PR -> Issue`
4. `PR -> Evidence (tests/coverage/checks)`
5. `PR -> Requirement IDs` (when NFR or governance behavior is touched)

## Required Project Fields

- `Status`
- `Priority`
- `Size`
- `Estimate`
- `Start date`
- `End date`

## PR Governance Requirements

Each PR must contain:

1. Scope summary tied to issue intent
2. Spec file list changed
3. Acceptance criteria and evidence
4. Coverage and gate outcomes
5. Risk/rollback notes when needed

Priority grouping policy:

- `P0`, `P1`, and `P2` work should not be mixed in the same PR unless explicitly approved as an exception.

## CI and Quality Enforcement as Governance

Spec conformance is enforced by executable policy:

- Architecture boundary checks
- Import cycle checks
- Contract route resolution checks
- Coverage threshold checks
- Security/compliance smoke checks

If any gate fails, spec conformance is considered unproven and the change is not merge-ready.

## NFR and Requirement Traceability

When behavior affects non-functional requirements:

1. Add or update requirement file in `.agents/requirements/`
2. Update `.agents/README.md` index
3. Update `.agents/NFR-REGISTRY.md`
4. Reference requirement ID(s) in PR context

## Audit Evidence Expectations

Minimum evidence set:

1. Linked issue + project item
2. Changed spec files and docs
3. Green CI output for required gates
4. Coverage evidence meeting threshold
5. Requirement registry updates (if NFR impacted)

