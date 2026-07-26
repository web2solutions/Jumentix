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

1. `Issue -> Project item`
2. `Issue -> Spec files changed`
3. `PR -> Issue`
4. `PR -> Evidence (tests/coverage/checks)`
5. `PR -> Requirement IDs` (when NFR or governance behavior is touched)
6. `Task -> dedicated branch -> dedicated PR`

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
6. Task-owned branch name and matching nature-prefixed PR title
7. Source and target branch evidence
8. Clean markdown formatting with real breaklines; do not use literal `\n` tokens in PR body text.

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

## Audit Evidence Expectations

Minimum evidence set:

1. Linked issue + project item
2. Changed spec files and docs
3. Green CI output for required gates
4. Coverage evidence meeting threshold
5. Requirement registry updates (if NFR impacted)
6. Task-owned branch/PR naming and isolation evidence
7. Task PR to `dev`, or release promotion from `dev` to `main`, provenance
8. Branch-quality-gate evidence for commit, push, merge, and PR
9. Full-matrix manifest and results for `main` promotion work
10. Failure-propagation proof showing a required failing or missing test cannot produce green
