# Jumentix Project Governance

This project uses Linear as the single source of truth for execution tracking. GitHub issues,
projects, and pull requests provide delivery evidence but do not replace current Linear data.

## Single Source of Truth Rules

1. Every bug, feature, refactor, and technical task executed by humans or AI must exist as a Linear Issue.
2. Every epic must exist as a Linear Project and every task must be linked to its focused Project.
3. Project fields are mandatory for active items:
   - `Status`
   - `Priority`
   - `Size`
   - `Estimate`
   - `Start date`
   - `End date`
   - `Milestone`
4. No work starts without a linked Linear Issue and focused Linear Project.
5. Task progress must be reflected in current Issue metadata and the parent Project's mandatory
   Project Updates, not only in local notes or GitHub activity.
6. All executed tasks must keep governance metadata updated (status, priority, estimates, cycle/iteration, start/end dates, labels, assignee, PR/commit links).

## Planning Metadata Lifecycle

1. Every Linear Issue used as a task and every Linear Project used as an epic/project must carry
   explicit status, priority, start date, target/end date, labels, milestone, and accountable owner.
2. Native Linear fields are authoritative. When a native field is unavailable, record a structured
   fallback in Linear and repeat it in the initial Project Update.
3. Each item has exactly one primary nature label; supplemental labels may not conflict with it.
4. Start dates must not follow target dates. Task and Project dates must fit their parent Project
   and shared milestone delivery windows.
5. Agents revalidate metadata before acceptance/delegation, branch creation, review readiness,
   handoff, merge, and completion.
6. Material status, priority, date, or label changes are recorded in Project Updates with old and
   new values, reason, and delivery impact.
7. Missing, stale, contradictory, invalid, placeholder, or unauditable metadata blocks execution,
   review, merge, handoff, and completion.
8. A Project cannot be completed until every child task has terminal, consistent metadata and its
   documentation and final Project Update obligations are satisfied.

## Focused Epics and Task Nature

1. Every active Linear Project epic belongs to exactly one open Linear milestone.
2. Every executable task belongs to exactly one focused epic through structured Linear parentage
   and uses the same milestone as that epic.
3. Milestones define a delivery target and due date. Epic and task dates remain within that date.
4. Each epic represents one cohesive outcome and must not serve as a catch-all backlog.
5. Every child task has exactly one primary nature: `feature`, `bug`, `security`, `governance`,
   `docs`, `refactor`, `test`, `ci`, `release`, or `chore`.
6. Tasks are grouped by nature within the epic. Different supporting natures use separate child
   tasks while remaining tied to the same outcome.
7. Work that crosses unrelated outcomes is split across focused epics.
8. The milestone is validated before agent delegation is established at epic level.
9. Only agents delegated to an epic may execute its child tasks, with one accountable agent and
   non-overlapping scope per task.
10. Linear Issues and Projects/Epics identify the active `agent_identifier` for each executable
    scope, and that assignment stays synchronized with the canonical Agent Registry.
11. The canonical Agent Registry records each executing agent's `active_epic`, `assigned_task`,
    and any sibling-agent coordination context needed to avoid overlapping delivery.
12. Agents refresh sibling-agent progress, blockers, branches, PRs, and Project Updates before
    starting or resuming work inside the same epic, milestone, or component.
13. A milestone closes only when its epics are complete or remaining work has an auditable
    carry-over to another milestone.

## PR Governance

Each PR must include:

- Linear Issue link
- Focused Linear Project link
- Associated milestone
- Required Project Update link
- Acceptance criteria and validation evidence
- Coverage and quality-gate evidence
- Task-owned branch name and PR title prefixed by the matching Linear Issue and nature
- Source and target branches, proving the task PR targets `dev`
- Destination-aware gate results for commit, push, merge, and PR boundaries; full-matrix results for `main` promotion
- False-green prevention evidence, including real failure propagation

If a PR is not linked to project work items, it is out of process.

### Task-owned branch and PR policy (mandatory)

1. Every task must have its own branch and its own PR.
2. A branch or PR must not combine separately tracked tasks.
3. Codex branches use `codex/<nature>/<issue-id>-<short-slug>`.
4. PR titles use `[JUM-XXXX][<Nature>] <concise outcome>`.
5. Allowed nature values are `feature`, `fix`, `security`, `governance`, `docs`, `refactor`, `test`, `ci`, `release`, and `chore`.
6. The Linear identifier declared by the branch, PR title, and linked Issue must match; the
   nature declared by the branch and PR title must also match.
7. Any exception must be explicitly approved and recorded in the linked issue and PR.
8. Every task PR must target `dev`.
9. Only a release-promotion PR whose source branch is `dev` may target `main`.
10. A `dev` to `main` promotion PR introduces no changes outside the task PRs already merged
    into `dev` and references their Linear Issues.
11. Direct pushes, merges, or task/topic PRs to `main` are prohibited.
12. Task-branch commits and pushes run changed/related tests; `dev` and PRs targeting `dev` run
    the complete unit gate; `main` and promotions targeting `main` run the complete matrix.
13. Missing, skipped, empty, cancelled, timed-out, aborted, or unreported required tests or
    matrix cells fail the selected gate.
14. Test failures and discovery failures must propagate a non-zero status; false-green fallbacks are prohibited.
15. PR review is optional. Branch protection and rulesets require no approval count, while every
    destination-appropriate check remains mandatory and terminally successful.

### Canonical agent registry evidence

1. The independent Agent Registry repository and its `main` branch remain the coordination
   source of truth.
2. A consumer mirror records the immutable canonical commit revision used to produce it.
3. Agent registration, heartbeat, assignment, and completion are written directly to Firestore
   through the `agent-registry` CLI commands.
4. A local snapshot `.agents/registry-snapshot.json` may be generated with
   `bun run agent-registry:sync` for offline consultation; it is regenerable and ignored by Git.
5. Commit, push, and PR gates validate the local snapshot against Firestore when the snapshot
   exists. A missing snapshot does not fail the gate; a stale snapshot fails with guidance to run
   `bun run agent-registry:sync`.
6. Firestore access requires the service account JSON in `FIREBASE_SERVICE_ACCOUNT_KEY` (CI:
   `secrets.FIREBASE_SERVICE_ACCOUNT_KEY`). Credentials must never be committed.
7. Transport failures, Firestore unavailability, or snapshot mismatches fail closed without
   falling back to local files. Diagnostics distinguish missing credentials from out-of-sync
   state.
8. The Firestore project is private under XpertMinds. Only identities explicitly authorized in
   Linear may write agent records.

## Documentation Governance

1. Every executed task must update software docs, product docs, and spec docs when affected.
2. Documentation must be maintained in sync with implementation and governance changes.
3. Documentation must provide English and Portuguese versions.
4. Jumentix website content and navigation must provide English and Portuguese versions.
5. In Linear, an epic is a Project and an executable task is an Issue.
6. Every epic Project must contain a dedicated documentation Issue whose exclusive accountable
   outcome is synchronizing all affected documentation.
7. An epic Project must not be set to `Completed` until its dedicated documentation Issue is
   completed and links its PR, commits, changed documentation, and validation evidence.
8. A missing, cancelled, unowned, or incomplete documentation Issue blocks epic completion.

### Priority-based PR grouping (mandatory)

PRs must be created by priority group:

1. `P0` tasks in dedicated PR(s) containing only `P0` items.
2. `P1` tasks in dedicated PR(s) containing only `P1` items.
3. `P2` tasks in dedicated PR(s) containing only `P2` items.

Mixing `P0`, `P1`, and `P2` work in the same PR is not allowed.

## Backlog and Delivery Flow

1. Create/triage issue.
2. Create or select an open milestone.
3. Create or select the focused parent epic, associate it with the milestone, and establish
   structured parentage.
4. Link the Linear Issue to its focused Project and assign the shared milestone.
5. Set nature, field values, and cycle dates within the milestone due date.
6. Validate task and Project status, priority, dates, labels, and ownership.
7. Delegate available agents to the epic, then assign its non-overlapping child tasks.
8. Create the task-owned, nature-prefixed branch.
9. Implement with a dedicated PR targeting `dev` and linked to the Linear milestone, Project,
   Issue, and required Project Update.
10. Promote `dev` to `main` only through a release-promotion PR after the complete matrix passes.
11. Verify the dedicated documentation Issue and its evidence are complete.
12. Move project status (`Backlog` -> `Ready` -> `In progress` -> `In review` -> `Done`) only
    when actual lifecycle state and all required metadata agree.

## Cycle and Estimation Policy

1. Cycle window standard: 14 days (`Start date` / `End date` in project fields).
2. Every active task must have:
   - `Priority`
   - `Estimate` (story points)
   - cycle dates
3. Maximum story points per task item: **8**.
4. Any item above 8 points must be split into subtasks.
5. Subtasks inherit parent priority and cycle.
