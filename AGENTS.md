# AGENTS.md (Codex)

Primary Codex runtime instructions for this repository:

1. Use `rtk` prefix for shell commands.
2. Follow `.agents/requirements/*` and `.agents/NFR-REGISTRY.md` as mandatory constraints.
3. Treat Linear as the single source of truth for task and Project tracking. The Linear API key is at `../.linear` — read it for API authentication but never expose, log, commit, or share it.
4. Keep specs/docs/agents in sync when requirements or behavior change.
5. Do not bypass quality gates; CI and coverage rules are mandatory.
6. Register in `.agents/AGENT-REGISTRY.md` before task execution.
7. Before starting work, check `main` and `dev` branch refs and update registry check fields.
8. Do not implement new changes directly on local `main`; use dedicated feature/fix/chore branches per requirement `079`.
9. Follow the agent operating playbook defined in requirement `081` for registration, execution, and closure flow.
10. Treat `web2solutions/jumentix-agent-registry` as canonical source; local `.agents/AGENT-REGISTRY.md` is a mirror.
11. Work only on tasks with one focused parent epic and one primary nature; agent delegation is
    established at epic level before child-task assignment under requirement `090`.
12. Confirm the epic and its child task share one open milestone whose due date covers the work
    before planning or execution.
13. Treat an epic as a Linear Project and never set it to `Completed` until its dedicated
    documentation Issue is completed under requirement `094`.
14. Administrators may use a recorded project-owner approval to bypass only the required-review
    count; they must never bypass `dev`-first promotion or failed, missing, or incomplete quality,
    coverage, or security gates.
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
    `pnpm run test:unit` to pass. PRs targeting `main` require the full matrix
    (`pnpm run ci:gate:strict`) (Requirements `087`, `088`).
20. **Obtain at least one approving review** before merging any PR (Requirement `098`,
    branch protection).
21. **Branch naming**: `codex/<nature>/<issue-id>-<short-slug>` for Codex agents.
    Allowed natures: `feature`, `fix`, `security`, `governance`, `docs`, `refactor`,
    `test`, `ci`, `release`, `chore` (Requirement `086`).
22. **Delete branches after merge**: both local and remote branches must be deleted
    immediately after the PR is merged to `dev`. Exceptions must be documented
    (Requirement `083`).
23. **Task PRs target `dev` first**. Only release-promotion PRs from `dev` to `main`
    may target `main`. Direct task/feature/fix PRs to `main` are prohibited
    (Requirement `086`).

Canonical governance/spec references:

- `documentation/md/SPEC-GOVERNANCE-AND-TRACEABILITY.md`
- `documentation/md/SPEC-REQUIREMENTS-TRACEABILITY-LEDGER.md`
- `documentation/md/SPEC-DEVELOPMENT-DRIVEN-INDEX.md`
