# Requirement 094 - Epic Documentation Completion Gate

## Context

In Linear, a Jumentix epic is represented by a Project and its executable tasks are represented
by Issues. Documentation accountability must remain visible and independently reviewable instead
of being implicitly distributed across implementation tasks.

## Mandatory Rules

1. Every Linear Project used as an epic must contain at least one dedicated documentation Issue.
2. The documentation Issue must have documentation synchronization as its exclusive accountable
   outcome and must not be replaced by an unchecked note in another task.
3. The documentation Issue must cover every affected product, software, API/contract, architecture,
   operational, governance, and Spec Development Driven resource.
4. English and Portuguese artifacts must be updated together whenever the governed documentation
   is bilingual.
5. The documentation Issue follows the same task-owned worktree, branch, pull request, `dev`-first,
   traceability, and quality-gate rules as every other executable task.
6. A Linear Project must not be set to `Completed` while its dedicated documentation Issue is
   missing, cancelled, duplicated without clear ownership, or in any state other than completed.
7. Project completion evidence must link the completed documentation Issue, its pull request and
   commit evidence, and the validation results for documentation integrity.
8. Before changing a Project to `Completed`, the project owner must explicitly verify this gate.

## Acceptance Criteria

1. Project governance defines `epic = Linear Project`, `task = Linear Issue`, and the dedicated
   documentation-task completion gate.
2. Delivery Gate 5 treats a missing or incomplete epic documentation Issue as a merge and project
   completion blocker.
3. Agent instructions consistently prohibit completing an epic before its documentation Issue.
4. Requirement index, NFR registry, traceability ledger, coverage attestation, and bilingual
   governance documentation reference this requirement.
5. Existing active Linear Projects are auditable for a dedicated documentation Issue before
   completion.

## Evidence and Scope

- Applies to every current and future Linear Project used as a Jumentix epic.
- Evidence includes the Linear Project, dedicated documentation Issue, task-owned branch and PR,
  commit links, changed documentation files, bilingual parity evidence, and green integrity gates.
- Complements requirements `018`, `025`, `053`, `066`, `071`, `072`, `076`, `084`, `086`, `090`,
  and `093`.
