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
5. Agent Registry canonical record in `web2solutions/jumentix-agent-registry` with mirrored copy in `.agents/AGENT-REGISTRY.md`

## Mandatory Traceability Links

Every delivery item must expose:

1. `Milestone -> focused epic`
2. `Focused epic -> child task`
3. `Focused epic -> delegated agent`
4. `Issue -> Project item`
5. `Issue -> Spec files changed`
6. `PR -> Issue`
7. `PR -> Evidence (tests/coverage/checks)`
8. `PR -> Requirement IDs` (when NFR or governance behavior is touched)
9. `Task -> dedicated branch -> dedicated PR`
10. `Linear epic Project -> dedicated documentation Issue -> PR/commit/documentation evidence`

## Epic Documentation Completion Gate

1. In Linear, an epic is a Project and its executable tasks are Issues.
2. Every epic Project must contain a dedicated documentation Issue.
3. The Project must not be set to `Completed` before that Issue is completed.
4. Completion evidence must link the documentation Issue, its task-owned PR and commits, the
   changed documentation inventory, bilingual parity when applicable, and integrity validation.
5. Missing, cancelled, unowned, or incomplete documentation work blocks epic completion.

## Required Project Fields

- `Status`
- `Priority`
- `Size`
- `Estimate`
- `Start date`
- `End date`
- `Parent issue`
- `Milestone`
- one primary nature label

## Epic-First Planning and Delegation

1. Every active epic has exactly one open milestone with a delivery target and due date.
2. Every executable task has exactly one focused parent epic and inherits its milestone.
3. Epic and task end dates remain within the milestone due date.
4. Each task has one primary nature and is grouped with tasks of the same nature inside its epic.
5. Supporting work with a different nature is represented by a separate child task under the
   same cohesive epic.
6. Milestone validity is checked before agent delegation is recorded at epic level.
7. Only agents delegated to an epic may execute its tasks.
8. One accountable agent owns each task and parallel agents use non-overlapping scopes.
9. The canonical Agent Registry records `active_epic` and `assigned_task`.
10. A milestone closes only after its epics complete or remaining work is formally carried over.

## PR Governance Requirements

Each PR must contain:

1. Scope summary tied to issue intent
2. Milestone, focused parent epic, and project item linkage
3. Spec file list changed
4. Acceptance criteria and evidence
5. Coverage and gate outcomes
6. Risk/rollback notes when needed
7. Task-owned branch name and matching nature-prefixed PR title
8. Source and target branch evidence
9. Clean markdown formatting with real breaklines; do not use literal `\n` tokens in PR body text.

Task isolation and naming policy:

- One task maps to exactly one delivery branch and one PR.
- Codex branch format: `codex/<nature>/<issue-id>-<short-slug>`.
- PR title format: `[<Nature>] <concise outcome>`.
- Allowed nature values: `feature`, `fix`, `security`, `governance`, `docs`, `refactor`, `test`, `ci`, `release`, `chore`.
- Sharing a branch or PR across separately tracked tasks requires an explicit exception recorded in the issue and PR.
- Every task PR targets `dev`.
- Only a release-promotion PR sourced from `dev` may target `main`.
- A `dev` to `main` promotion references the task PRs/issues already merged into `dev` and introduces no unreviewed changes.
- Direct task/topic PRs, pushes, and merges to `main` are prohibited.
- Commit and push gates are destination-aware: task branches run only changed or related
  unit tests, `dev` runs the complete unit suite, and `main` runs the complete matrix.
- Pull requests targeting `dev` run the complete unit suite; release-promotion PRs to
  `main` run the complete matrix.
- Main-matrix evidence must list every required cell and its terminal result.
- An incomplete `main` matrix is failed evidence; it must never be interpreted as green.

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

## Official AI Agent Support

Jumentix officially supports these engineering agents:

1. Codex (`AGENTS.md`)
2. Claude Code (`CLAUDE.md`)
3. Grok (`GROK.md`)

Agent guidance must remain behaviorally equivalent for governance, traceability, documentation sync, and CI/coverage gates.

## Agent Registry and Branch Synchronization

Before any task execution:

1. Acting agent must be registered in `.agents/AGENT-REGISTRY.md`.
2. Planning must assign tasks to agents marked `available`.
3. Agent must check latest `main` and `dev` branch refs and update the registry check fields.
4. Agent registry entries must include machine identity (`machine_id`, `machine_name`, `machine_os`) and runtime identity (`agent_runtime`, `agent_version`) so multiple agents can run on the same host with full traceability.
5. Agents must follow the registration and operating playbook (Requirement `081`) covering registration, branch-sync, governed execution, and closure evidence.
6. Canonical registry updates must be written to the external registry repository first, then mirrored locally under Requirement `089`.
7. Epic-level delegation and child-task assignment must be recorded under Requirement `090`.
8. The epic and task milestone must be validated before planning or execution under Requirement
   `090`.
9. Agents must verify the dedicated documentation Issue before completing a Linear epic Project
   under Requirement `094`.

## Audit Evidence Expectations

Minimum evidence set:

1. Linked milestone + focused epic + child issue + project item
2. Epic-level agent delegation and task-level assignment
3. Changed spec files and docs
4. Green CI output for required gates
5. Coverage evidence meeting threshold
6. Requirement registry updates (if NFR impacted)
7. Task-owned branch/PR naming and isolation evidence
8. Task PR to `dev`, or release promotion from `dev` to `main`, provenance
9. Branch-quality-gate evidence for commit, push, merge, and PR
10. Full-matrix manifest and results for `main` promotion work
11. Failure-propagation proof showing a required failing or missing test cannot produce green
