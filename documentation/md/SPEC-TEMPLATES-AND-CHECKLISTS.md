# Spec Templates and Checklists

Use these templates for all spec-first changes.

## Template A - Feature Spec

```md
# Feature Spec - <title>

## Context
- Business objective:
- User impact:
- Scope:

## Contracts
- OpenAPI operations affected:
- AsyncAPI channels/events affected:
- Message/Event contracts affected:
- Error contracts affected:

## Architecture Impact
- Domains:
- Use cases:
- Ports/adapters:
- Boundary risks:

## Data Impact
- Entities/models/value objects changed:
- Validation/type/format updates:
- Migration/compatibility notes:

## Runtime/Deployment Impact
- Env vars:
- PM2/runtime changes:
- Cloud/deploy implications:

## Security and Compliance
- RBAC/tenant scope impact:
- Secret/sensitive data handling:
- Error exposure behavior:

## Test Strategy
- Unit:
- Integration:
- Smoke:
- Coverage target confirmation:

## Governance
- Linear Issue:
- Focused Linear Project:
- Project Update:
- Priority/Estimate:
- Acceptance criteria:
```

## Template B - Contract Change Spec

```md
# Contract Change Spec - <title>

## Contract Type
- OpenAPI / AsyncAPI / Message Contract / Error Contract

## Previous Behavior
- ...

## New Behavior
- ...

## Compatibility
- Backward compatible? yes/no
- Consumer impact:
- SDK impact:

## Validation
- Route/channel resolution evidence:
- Contract test evidence:
```

## Template C - NFR / Governance Spec

```md
# NFR Spec - <title>

## NFR Category
- performance / security / compliance / reliability / governance / operability

## Requirement Statement
- ...

## Enforcement
- CI/CD checks:
- Runtime controls:
- Process controls:

## Evidence
- Metrics/logs/tests:
- Required docs updates:
- Required registry updates:
```

## Delivery Checklist (Mandatory)

Before PR:

1. Linear Issue exists and is linked to its focused Project and shared milestone.
2. Issue and Project planning fields are complete.
3. Spec files updated for all changed contracts/behaviors.
4. Architecture and boundary impact reviewed.
5. Tests implemented per risk profile.
6. Coverage thresholds satisfied.
7. Documentation updated (including index links).
8. `.agents` requirement/NFR files updated when applicable.
9. PR description includes traceability and evidence.

Before merge:

1. CI gates green.
2. Patch coverage gate green.
3. Security/compliance checks green.
4. Linear Issue is truthfully in `In Review` (or the equivalent active review state), and the
   latest Project Update reports exact gate results.

After merge:

1. Linear Issue moves to `Done`.
2. Final Project Update links the merge commit and contains no unresolved blocker or incomplete
   required gate.

## Template D - Linear Project Update (per task)

Publish in the focused Linear Project's `Project Updates` feed (Requirement `102`). Issue comments
and status changes alone are insufficient. Use one clearly separated section per task when an
update covers multiple tasks or agents.

```md
### Task: JUM-XXXX — <short title>
- Task: https://linear.app/jumentix/issue/JUM-XXXX/...
- Agent: <agent_id or human name>
- Status: <Backlog | Todo | In Progress | In Review | Done | Blocked>
- Completed: <concrete outcomes since the previous update>
- Delivery: worktree `<path or n/a>` · branch `<name or not yet created>` · commit `<sha or n/a>` · PR `<url or not yet created>`
- Gates: <each required gate with exact terminal or pending state; never call pending/failed/missing checks green>
- Blockers/Risks: <current blockers/risks, or none>
- Next: <next concrete action>
```

### Multi-task update envelope

```md
## <epic or wave label> — <date or checkpoint>

**Agent(s):** <list>

### Task: JUM-AAAA — ...
- ...

### Task: JUM-BBBB — ...
- ...
```

### Cadence (mandatory)

1. Task accepted / work started
2. Material progress that changes delivery confidence
3. Blocker or material risk change
4. PR ready for review
5. Final handoff / Done (link merge commit; no unresolved blocker or incomplete required gate)
