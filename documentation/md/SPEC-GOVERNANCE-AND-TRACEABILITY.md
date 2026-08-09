# Spec Governance and Traceability

Spec Development Driven in Jumentix is enforced through project governance and auditable links.

## Single Source of Truth

Governance source of truth:

- Linear Issues and Projects (`https://linear.app/jumentix`)
- The Linear API key is stored at `../.linear`, one level above the project root. Agents may read
  it for authentication but must never expose, log, share, or commit it.

Mandatory governance records:

1. Linear Issue (work item)
2. Linear Project (focused epic) with planning fields
3. PR with linked issue and evidence
4. Spec and documentation artifacts
5. Agent Registry canonical record in Firestore Database (collection `agents`, requirement `089`) with regenerable local snapshot `.agents/registry-snapshot.json`

## Mandatory Traceability Links

Every delivery item must expose:

1. `Milestone -> focused epic`
2. `Focused epic -> child task`
3. `Focused epic -> delegated agent`
4. `Linear Issue -> Linear Project`
5. `Linear Issue -> Spec files changed`
6. `PR -> Linear Issue`
7. `PR -> Evidence (tests/coverage/checks)`
8. `PR -> Requirement IDs` (when NFR or governance behavior is touched)
9. `Task -> dedicated branch -> dedicated PR`
10. `Task/Project -> current planning metadata -> Project Update history`
11. `Linear epic Project -> dedicated documentation Issue -> PR/commit/documentation evidence`

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
- accountable agent or Project lead

Required fields remain current throughout delivery. If Linear does not expose a native required
field for an entity, its structured Linear fallback record and initial Project Update are
authoritative until a native or custom field is available.

## Planning Metadata Lifecycle

1. Agents validate task and Project status, priority, dates, labels, milestone, and ownership
   before acceptance or delegation.
2. Start dates cannot follow target/end dates; task dates fit the parent Project and shared
   milestone, and Project dates fit the milestone.
3. Status reflects actual lifecycle state. Priority reflects current impact, urgency, risk,
   dependencies, and sequencing.
4. Each item has exactly one primary nature label. Supplemental labels cannot contradict it.
5. Material metadata changes are included in the next Project Update with previous and new
   values, reason, and delivery impact.
6. Agents revalidate metadata at branch creation, review readiness, handoff, merge, and
   completion.
7. Missing, stale, contradictory, invalid, placeholder, or unauditable metadata fails governance
   closed and blocks work progression.

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
9. Linear Issues and Projects/Epics identify the active `agent_identifier`, synchronized with the
   canonical Agent Registry.
10. The canonical Agent Registry records `active_epic`, `assigned_task`, and coordination context
    when sibling-agent work can overlap.
11. Agents refresh sibling-agent progress, blockers, branches, PRs, and Project Updates before
    starting or resuming work.
12. A milestone closes only after its epics complete or remaining work is formally carried over.

## PR Governance Requirements

Each PR must contain:

1. Scope summary tied to issue intent
2. Linear milestone, focused parent Project, child Issue, and Project Update linkage
3. Spec file list changed
4. Acceptance criteria and evidence
5. Coverage and gate outcomes
6. Risk/rollback notes when needed
7. Task-owned branch name and PR title prefixed by the matching Linear Issue and nature
8. Source and target branch evidence
9. Clean markdown formatting with real breaklines; do not use literal `\n` tokens in PR body text.

Task isolation and naming policy:

- One task maps to exactly one delivery branch and one PR.
- Codex branch format: `codex/<nature>/<issue-id>-<short-slug>`.
- PR title format: `[JUM-XXXX][<Nature>] <concise outcome>`; the identifier must match the
  branch and the single linked Linear Issue.
- Allowed nature values: `feature`, `fix`, `security`, `governance`, `docs`, `refactor`, `test`, `ci`, `release`, `chore`.
- Sharing a branch or PR across separately tracked tasks requires an explicit exception recorded in the issue and PR.
- Every task PR targets `dev`.
- Only a release-promotion PR sourced from `dev` may target `main`.
- A `dev` to `main` promotion references the task PRs and Linear Issues already represented in
  `dev` and introduces no additional task changes.
- Direct task/topic PRs, pushes, and merges to `main` are prohibited.
- Commit and push gates are destination-aware: feature, docs, fix, and other task
  branches run only specialized changed/related tests, `dev` runs the cheap
  unit health gate, and `main` runs the complete local non-coverage matrix.
- Pull requests targeting `dev` run the layer-aware specialized gate selected by
  `test-map.json`, plus lightweight mandatory review. Release-promotion PRs to
  `main` run the complete matrix, plus the required CircleCI coverage job.
- Main-matrix evidence must list every required cell and its terminal result.
- An incomplete `main` matrix is failed evidence; it must never be interpreted as green.
- PR review is optional. Branch protection and rulesets must not require an approval count.
- Task isolation, `dev`-first promotion, conversation resolution, and every destination-aware CI,
  coverage, security, governance, and full-matrix requirement remain mandatory and terminal
  green.

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

Branch-aware execution contract:

1. Task branches execute `ci:gate:task` against the task-owned diff.
2. `dev` pushes execute `test:unit`; pull requests targeting `dev` execute `ci:gate:task`.
3. `main` and release-promotion pull requests targeting `main` execute `ci:gate:strict`.
4. CircleCI is the repository-owned hosted executor while GitHub Actions billing is blocked by
   Requirement `113`.
5. `.circleci/config.yml` owns Storybook checks, database smoke, and full coverage for
   release promotions, `main`, and scheduled full runs; the local full matrix does not
   execute Storybook or coverage production.
6. Every selected gate emits auditable evidence and fails closed for missing, crashed, or
   non-zero command outcomes.

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
4. OpenCode (`OPENCODE.md`)

Agent guidance must remain behaviorally equivalent for governance, traceability, documentation sync, and CI/coverage gates.

## Agent Registry and Branch Synchronization

Before any task execution:

1. Acting agent must be registered in Firestore via `bun run agent-registry:register` (Requirement `089`).
2. Planning must assign tasks to agents marked `available`.
3. Agent must check latest `main` and `dev` branch refs and update them via `bun run agent-registry:heartbeat --main-ref --dev-ref`.
4. Agent registry entries must include machine identity (`machine_id`, `machine_name`, `machine_os`) and runtime identity (`agent_runtime`, `agent_version`) so multiple agents can run on the same host with full traceability.
5. Agents must follow the registration and operating playbook (Requirement `081`) covering registration, branch-sync, governed execution, and closure evidence.
6. Canonical registry updates must be written directly to Firestore Database through the `agent-registry` CLI under Requirement `089`; `.agents/registry-snapshot.json` is a regenerable local snapshot.
7. Epic-level delegation and child-task assignment must be recorded under Requirement `090`.
8. The epic and task milestone must be validated before planning or execution under Requirement
   `090`.
9. Agents must verify the dedicated documentation Issue before completing a Linear epic Project
   under Requirement `094`.
10. Legacy mirror checks (deprecated by Requirement `089`) must fetch immutable content by full commit SHA and an encoded safe
    path. The private canonical registry uses authenticated Contents API access. A diagnostic raw
    fallback is not private access and must fail closed without exposing credentials.
11. Only explicit legacy registry synchronization may resolve a mutable branch through the GitHub API,
    optionally authenticated by `GITHUB_TOKEN` or `GH_TOKEN`.
12. For the legacy mirror, invalid revisions or paths, HTTP and transport failures, malformed responses, unauthorized
    access, and local mirror drift must fail closed with actionable diagnostics that never expose
    credentials (raw 404 after Contents 401/403 → token-access guidance; other 404 → pin/path
    drift; bare 401/403 → token-backed private access).
13. The Agent Registry single source of truth is Firestore Database (project
    `jumentix-service-registry`, collection `agents`, Requirement `089`). Only the owner account
    `web2solutions` (`web2solucoes@gmail.com`) and identities explicitly authorized in Linear may
    write agent records. The legacy GitHub registry repository remains private under `XpertMinds`
    as a frozen audit mirror.
14. Requirement `103` makes `XpertMinds/Jumentix` canonical; agent-coordination canonicity moved to
    Firestore Database under Requirement `089`. Both former `web2solutions` origins — and the
    legacy GitHub registry mirror — are deprecated, read-only, accept no new modifications, and
    remain archived.
15. Requirement `104` requires every applicable application integration from the deprecated
    origin to be inventoried and rebound to `XpertMinds/Jumentix`, with incomplete provider
    installs recorded as owner-auth blockers and validated by `integration-migration:check`.

## Audit Evidence Expectations

Minimum evidence set:

1. Linked Linear milestone + focused Project + child Issue + required Project Update
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
12. Current task/Project status, priority, dates, labels, ownership, milestone alignment, and
    Project Update change history
13. Agent Registry transport tests covering immutable raw URL construction, safe path encoding,
    optional branch-resolution authentication, transport failures, and mirror mismatch
