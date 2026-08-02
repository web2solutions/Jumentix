# Agent Operating Requirements 114–118

Canonical constraints added 2026-08-01 under Linear [JUM-595](https://linear.app/jumentix/issue/JUM-595).

| ID | Title | One-line rule |
| --- | --- | --- |
| `114` | Agent worktree layout | Confirm filesystem root with the human operator, then work only in `<root>/XpertMinds/<agent-identifier>/Jumentix`. |
| `115` | Functional value tests | Tests are mandatory; no fake/vacuous suites; do not test third-party implementation APIs; assert Jumentix behavior. |
| `116` | Dual-branch requirements reread | Before every task, re-read all `.agents/requirements/*` and the NFR registry on both `origin/dev` and `origin/main`; avoid rework. |
| `117` | Feature documentation | Every new feature updates software docs and adds feature documentation (EN/PT) in the same delivery. |
| `118` | Docker smoke/integration | Smoke and integration suites start real services with Docker and exercise their declared surface; silent skips are not green. |

## Requirement files

- `.agents/requirements/114-agent-worktree-layout-and-onboard-clone.md`
- `.agents/requirements/115-functional-value-tests-no-fakes-no-third-party-api.md`
- `.agents/requirements/116-dual-branch-requirements-reread-before-task.md`
- `.agents/requirements/117-feature-documentation-on-new-features.md`
- `.agents/requirements/118-smoke-integration-docker-real-services.md`

## Related existing requirements

- `099` (strengthened by `116`), `025`/`076` (strengthened by `117`), `046`/`047` (strengthened by `118`), `109`/`112` (aligned with `115`), `078`/`081`/`089` (aligned with `114`).

## Operator note for Requirement 114

The filesystem root is **not** hard-coded. At onboard, the agent must ask the human operator which root to use (for example `$HOME/XpertMinds` or `$HOME/apps/XpertMinds`) before creating `XpertMinds/<agent-identifier>/Jumentix`.
