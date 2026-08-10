# AGENTS.md (Codex)

Primary Codex runtime instructions for this repository:

1. Execute repository commands using `rtk`, and compress your own prose with Caveman (Requirement `127`). Never compress code, commands, paths, identifiers, error messages, test counts, timings, or CI states — reproduce those verbatim. Bun scripts run as `rtk proxy bun run <script>`; where an agent lacks either tool, a declared replacement pattern is mandatory. How to do it: `documentation/md/AGENT-RTK-AND-CAVEMAN-GUIDE.md` (PT-BR: `documentation/md/AGENT-RTK-AND-CAVEMAN-GUIDE.pt-BR.md`).
2. Follow `.agents/requirements/*` and `.agents/NFR-REGISTRY.md` as mandatory constraints.
3. Treat Linear as the single source of truth for task and Project tracking. The Linear API key is at `../.linear` — read it for API authentication but never expose, log, commit, or share it.
4. Keep specs/docs/agents in sync when requirements or behavior change.
5. Do not bypass quality gates; CI and coverage rules are mandatory.
6. Register via `bun run agent-registry:register` (Firestore, requirement `089`) before task execution.
7. Before starting work, check `main` and `dev` branch refs and update them via `bun run agent-registry:heartbeat --main-ref --dev-ref`.
8. Do not implement new changes directly on local `main`; use a dedicated task branch with an
   allowed primary nature per requirements `086` and `090`.
9. Follow the agent operating playbook defined in requirement `081` for registration, execution, and closure flow.
10. Treat Firestore Database (project `jumentix-service-registry`, collection `agents`) as the canonical agent registry per requirement `089`; local `.agents/AGENT-REGISTRY.md` is a frozen historical mirror.
11. Work only on tasks with one focused parent epic and one primary nature; agent delegation is
    established at epic level before child-task assignment under requirement `090`.
12. Confirm the epic and its child task share one open milestone whose due date covers the work
    before planning or execution.
13. Treat an epic as a Linear Project and never set it to `Completed` until its dedicated
    documentation Issue is completed under requirement `094`.
14. Pull-request review is optional. Branch protection and rulesets must not require an approval
    count; every required quality, coverage, security, and governance check remains mandatory.
15. Maintain valid status, priority, start/target dates, and labels for every assigned Linear
    Issue and Project; record material changes in Project Updates and fail closed on missing,
    stale, contradictory, or placeholder metadata under requirement `097`.
16. **Never use `--no-verify`** in any git workflow. Husky hooks run required quality gates
    and must not be skipped (Requirement `065`).
17. **Never use `--admin` or `--force` merge flags** unless an emergency is explicitly
    documented in the linked issue/PR with project-owner approval. Admin bypass never waives
    required CI/coverage/security checks (Requirement `079`).
18. **PR descriptions must use the full PR template** (`.github/pull_request_template.md`)
    with all required sections filled — no placeholders or empty sections (Requirement `085`).
19. **Wait for all required CI checks to pass** before merging. PRs targeting `dev` require
    `bun run test:unit` to pass. PRs targeting `main` require the full matrix
    (`bun run ci:gate:strict`) (Requirements `087`, `088`).
20. **PR review is optional**; every other required CI, quality, coverage, security, and
    governance check must be terminally successful and cannot be bypassed.
21. **Branch naming**: `codex/<nature>/<issue-id>-<short-slug>` for Codex agents.
    Allowed natures: `feature`, `fix`, `security`, `governance`, `docs`, `refactor`,
    `test`, `ci`, `release`, `chore`. PR titles must start with the matching Linear identifier:
    `[JUM-XXXX][Nature] <concise outcome>` (Requirement `086`).
22. **Delete branches after merge**: both local and remote branches must be deleted
    immediately after the PR is merged to `dev`. Exceptions must be documented
    (Requirement `083`).
23. **Task PRs target `dev` first**. Only release-promotion PRs from `dev` to `main`
    may target `main`. Direct task/feature/fix PRs to `main` are prohibited
    (Requirement `086`).
24. **Before every task**, fetch/read current `main` and `dev`, re-read the **full**
    `.agents/requirements/` set and `.agents/NFR-REGISTRY.md` on **both** tips, record drift,
    avoid rework, refresh registry branch-check evidence, and do not execute until
    Requirements `099` and `116` are satisfied.
24a. **Onboard worktree layout (Requirement `114`):** confirm the filesystem root with the
    human operator (this host: `/Users/eduardoalmeida/apps/XpertMinds`), then work only under
    `<root>/<agent-identifier>/Jumentix` (clone of the canonical repo).
24b. **Tests (Requirement `115`):** mandatory, functional, Jumentix-valued — no fake/vacuous
    suites and no suites that primarily test third-party implementation APIs.
24c. **New features (Requirement `117`):** update software docs and add feature documentation
    (EN/PT) in the same delivery.
24d. **Smoke/integration (Requirement `118`):** use Docker to start real services and exercise
    the declared surface; silent skips are not green.
24e. **Service orchestration (Requirement `119`):** prefer APIs over browser/app automation
    for Linear, GitHub, and other services; GitHub must always use `gh`.
24f. **Linear agent visibility (Requirement `120`):** every executable Linear Issue and
    Project/Epic must identify the active `agent_identifier`, synchronized with the canonical
    Agent Registry and local mirror before implementation begins.
24g. **Coordinated agent delivery (Requirement `121`):** registered agents must refresh
    sibling-agent progress, blockers, branches, PRs, and Linear Project Updates before starting
    or resuming work, and coordinate any overlapping scope before editing files.
24h. **Firebase RTDB agent bus (Requirement `129`):** publish material progress with
    `bun run agent-bus:publish` and consume sibling progress with `agent-bus:status` /
    `agent-bus:watch` before start/resume and while waiting on remote checks. Requires
    `FIREBASE_DATABASE_URL`. Firestore remains ownership SSOT (`089`).
25. **Resolve valid PR comments before merge**: every valid human, security, or automated
    finding blocks merge until corrected, validated, and evidenced. No bypass is allowed
    (Requirement `100`).
26. Publish every task's start, material progress, blocker changes, review readiness, and final
    handoff in the Linear epic Project's `Project Updates` feed under requirement `102`; Issue
    comments and status changes alone are insufficient.
27. Report exact gate states in Project Updates and never describe pending, missing, cancelled,
    timed-out, skipped, or failed required checks as passing.
28. Before planning or executing any task, locate, read, and understand the complete current
    documentation inventory, every file in `.agents/requirements/`, `.agents/NFR-REGISTRY.md`,
    and the canonical specification index. All requirements are mandatory; uncertainty or an
    unread applicable source blocks execution until resolved.

Canonical governance/spec references:

- `documentation/md/SPEC-GOVERNANCE-AND-TRACEABILITY.md`
- `documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
- `documentation/md/SPEC-DEVELOPMENT-DRIVEN-INDEX.md`
