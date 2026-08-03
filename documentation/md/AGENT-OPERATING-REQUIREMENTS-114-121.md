# Agent Operating Requirements 114–121

Canonical constraints added 2026-08-01 under Linear [JUM-595](https://linear.app/jumentix/issue/JUM-595), with `120` and `121` added by project-owner decision on 2026-08-02.

| ID | Title | One-line rule |
| --- | --- | --- |
| `114` | Agent worktree layout | Confirm filesystem root with the human operator, then work only in `<root>/<agent-identifier>/Jumentix`. |
| `115` | Functional value tests | Tests are mandatory; no fake/vacuous suites; do not test third-party implementation APIs; assert Jumentix behavior. |
| `116` | Dual-branch requirements reread | Before every task, re-read all `.agents/requirements/project/*.md`, `.agents/requirements/software/*.md`, and the NFR registry on both `origin/dev` and `origin/main`; avoid rework. |
| `117` | Feature documentation | Every new feature updates software docs and adds feature documentation (EN/PT) in the same delivery. |
| `118` | Docker smoke/integration | Smoke and integration suites start real services with Docker and exercise their declared surface; silent skips are not green. |
| `119` | API-first orchestration | Prefer APIs (or official CLIs) over browser/app automation for Linear, GitHub, and other services; GitHub must always use `gh`. |
| `120` | Linear agent assignment visibility | Linear Issues and Projects/Epics must identify the active agent assignment and stay synchronized with the canonical Agent Registry. |
| `121` | Coordinated agent delivery awareness | Registered agents must refresh sibling-agent progress, blockers, branches, PRs, and Project Updates before starting or resuming work. |

## Requirement files

- `.agents/requirements/project/114-agent-worktree-layout-and-onboard-clone.md`
- `.agents/requirements/software/115-functional-value-tests-no-fakes-no-third-party-api.md`
- `.agents/requirements/project/116-dual-branch-requirements-reread-before-task.md`
- `.agents/requirements/project/117-feature-documentation-on-new-features.md`
- `.agents/requirements/software/118-smoke-integration-docker-real-services.md`
- `.agents/requirements/project/119-api-first-service-orchestration-github-gh.md`
- `.agents/requirements/project/120-linear-agent-assignment-visibility.md`
- `.agents/requirements/project/121-registered-agent-coordinated-delivery-awareness.md`

## Related existing requirements

- `099` (strengthened by `116`), `025`/`076` (strengthened by `117`), `046`/`047` (strengthened by `118`), `109`/`112` (aligned with `115`), `078`/`081`/`089` (aligned with `114`), `081`/`095` (strengthened by `119`), `078`/`089`/`090`/`095`/`097`/`102` (strengthened by `120`), and `077`/`078`/`089`/`090`/`101`/`102`/`116` (strengthened by `121`).

## Operator note for Requirement 114

At onboard, the agent must confirm the filesystem root with the human operator. The confirmed root **is** the org workspace directory (typically named `XpertMinds`). Layout:

```text
<root>/<agent-identifier>/Jumentix
```

**Confirmed on this host (2026-08-01):** `/Users/eduardoalmeida/apps/XpertMinds`  
Example: `/Users/eduardoalmeida/apps/XpertMinds/cursor-grok-4.5/Jumentix`

Other hosts still require a fresh in-band confirmation.

## Operator note for Requirement 119

Do not drive Linear or GitHub through the browser when the Linear GraphQL API or `gh` can complete the operation. Fall back to UI only when the API path is unavailable or the operator explicitly requires a human UI step, and record that blocker in the Linear Project Update.

## Operator note for Requirement 120

Before implementation starts, the Linear Issue and its Project/Epic must show which registered agent owns the task. The agent assignment in Linear, the canonical Agent Registry, and the local mirror must agree. Assignment changes are material progress and must be recorded through the API-first path.

## Operator note for Requirement 121

Agents are not isolated workers. Before starting or resuming work, read sibling-agent activity in the registry, Linear Project Updates, related Issues, active branches, and open PRs. If another registered agent owns overlapping scope, coordinate the handoff, dependency, or scope split before editing files.
