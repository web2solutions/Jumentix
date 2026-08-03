# Requirement 097 - Linear Planning Metadata Lifecycle

## Status

Accepted

## Objective

Keep every Jumentix task and epic operationally truthful in Linear by requiring agents to
maintain status, priority, dates, and labels throughout the complete planning and delivery
lifecycle.

## Scope and authority

1. This requirement applies to every Linear Issue used as a Jumentix task and every Linear
   Project used as a Jumentix epic or project.
2. Linear is the project-management source of truth. Repository documents and pull requests
   provide evidence and synchronization, but do not replace the current Linear fields.
3. Agents must use native Linear fields where they exist. If an entity has no native field for a
   required value, the value must be recorded in a structured issue description, issue comment,
   project description, or Project Update until a native or custom field becomes available.
4. An agent accountable for a task owns its Issue metadata. The Project lead or explicitly
   delegated agent owns the epic/Project metadata.

## Required planning metadata

Before planning, delegation, or execution, every task and epic/Project must have:

1. an explicit lifecycle `Status`;
2. an explicit `Priority` rather than an unset or placeholder value;
3. an explicit start date;
4. an explicit target, end, or due date;
5. labels that classify the work, including exactly one primary nature;
6. a milestone association whose delivery window contains the task and Project dates; and
7. an accountable agent or Project lead.

Allowed primary natures are `feature`, `bug`, `security`, `governance`, `docs`, `refactor`,
`test`, `ci`, `release`, and `chore`. Additional domain, component, risk, or governance labels
may be used, but conflicting primary natures are prohibited.

## Lifecycle rules

1. Required metadata is validated before an agent accepts or delegates work.
2. Status is updated when work changes lifecycle stage; it must reflect actual execution rather
   than anticipated or desired progress.
3. Priority is reassessed when impact, urgency, risk, dependencies, or sequencing changes.
4. Dates use unambiguous ISO calendar dates in recorded fallback text. The start date must not be
   later than the target/end date.
5. Active work whose target date has passed must be replanned immediately with the reason and
   delivery impact recorded.
6. Task dates must fit within both the parent Project delivery window and the shared milestone.
   Project dates must fit within the milestone.
7. Labels are updated when nature, domain, component, risk, or governance classification changes.
8. Metadata is revalidated at branch creation, review readiness, handoff, merge, and completion.
9. A task cannot become `Done`, and a Project cannot become `Completed`, while required gates,
   documentation, final Project Updates, dependencies, or blockers remain incomplete.
10. A Project cannot complete until its child tasks have terminal, mutually consistent metadata
    and the documentation and final-update obligations in Requirements `094` and `095` are met.

## Change records and Project Updates

1. A material metadata change must be auditable; historical records must not be rewritten to
   conceal the previous value or reason for change.
2. Every material status, priority, date, or label change is included in the next Project Update
   with the old value, new value, reason, and delivery impact.
3. The initial Project Update records the planning baseline for the Project and its accepted
   tasks, including any fallback value used because a native field is unavailable.
4. The final Project Update confirms that task and Project metadata is terminal, consistent, and
   complete.

## Fail-closed enforcement

Missing, stale, contradictory, invalid, placeholder, or unauditable required metadata blocks:

1. task acceptance and delegation;
2. branch creation and execution;
3. review-ready and merge-ready declarations;
4. handoff and merge; and
5. task or Project completion.

No local note, PR statement, successful test result, or green CI check may convert invalid Linear
metadata into passing governance evidence.

## Required evidence

Delivery evidence must include:

1. links to the Linear Issue and parent Linear Project;
2. the current status, priority, dates, labels, milestone, and accountable owner;
3. the native Linear fields or structured fallback record used for each required value;
4. Project Updates that capture the baseline and every material metadata change;
5. branch, commit, pull request, gate, documentation, and dependency links; and
6. a final consistency check before completion.

## Relationship to other requirements

This requirement complements Requirements `056`, `057`, `064`, `067`, `076`, `078`, `081`,
`084`, `086`, `090`, `094`, and `095`. Domain files remain the software-contract source of truth;
OpenAPI and project-management metadata do not supersede domain contracts.
