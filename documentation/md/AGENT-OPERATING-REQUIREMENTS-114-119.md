# Agent Operating Requirements 114–119

Canonical constraints added 2026-08-01 under Linear [JUM-595](https://linear.app/jumentix/issue/JUM-595).

| ID | Title | One-line rule |
| --- | --- | --- |
| `114` | Agent worktree layout | Confirm filesystem root with the human operator, then work only in `<root>/<agent-identifier>/Jumentix`. |
| `115` | Functional value tests | Tests are mandatory; no fake/vacuous suites; do not test third-party implementation APIs; assert Jumentix behavior. |
| `116` | Dual-branch requirements reread | Before every task, re-read all `.agents/requirements/*` and the NFR registry on both `origin/dev` and `origin/main`; avoid rework. |
| `117` | Feature documentation | Every new feature updates software docs and adds feature documentation (EN/PT) in the same delivery. |
| `118` | Docker smoke/integration | Smoke and integration suites start real services with Docker and exercise their declared surface; silent skips are not green. |
| `119` | API-first orchestration | Prefer APIs (or official CLIs) over browser/app automation for Linear, GitHub, and other services; GitHub must always use `gh`. |

## Requirement files

- `.agents/requirements/114-agent-worktree-layout-and-onboard-clone.md`
- `.agents/requirements/115-functional-value-tests-no-fakes-no-third-party-api.md`
- `.agents/requirements/116-dual-branch-requirements-reread-before-task.md`
- `.agents/requirements/117-feature-documentation-on-new-features.md`
- `.agents/requirements/118-smoke-integration-docker-real-services.md`
- `.agents/requirements/119-api-first-service-orchestration-github-gh.md`

## Related existing requirements

- `099` (strengthened by `116`), `025`/`076` (strengthened by `117`), `046`/`047` (strengthened by `118`), `109`/`112` (aligned with `115`), `078`/`081`/`089` (aligned with `114`), `081`/`095` (strengthened by `119`).

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
