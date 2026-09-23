# CI Provider Governance

This document summarizes which CI provider runs what in `web2solutions/Jumentix`
and how to change it. Requirement `113`
(`.agents/requirements/project/113-private-free-repository-owned-ci.md`), as
amended on 2026-09-23, is the normative source; this page is the human-readable
orientation. (PT-BR: `documentation/md/CI-PROVIDER-GOVERNANCE.pt-BR.md`.)

## Which provider runs what

| Provider | Role | Surface |
| --- | --- | --- |
| CircleCI (`.circleci/config.yml`) | **Canonical orchestrator** for the full matrix | Jobs `branch-gate`, `third-party-review`, `browser-matrix`, `workspace-builds`, `workspace-tests`, `integration`, `coverage` (includes Codecov upload via checksum-verified CLI, SonarQube Cloud scan, and `bun run sonar:check-reliability`), `website`, `database-matrix`; nightly scheduled trigger on `main`/`dev` |
| GitHub Actions (`.github/workflows/ci.yml`, `browser-matrix.yml`, `sonar-reliability.yml`) | **Retained, disabled by default** — reversible fallback | The 8 matrix jobs in `ci.yml` plus both extra workflows are gated behind `if: vars.JUMENTIX_ENABLE_GITHUB_ACTIONS_CI == 'true'`; no file was deleted |
| GitHub Actions (always-on exceptions) | GitHub-only surfaces that cannot move | `pr-feedback.yml`, the `sync-changelog` and `pr-feedback` jobs inside `ci.yml`, and `npm-publish.yml` — see below |
| Codecov / SonarQube Cloud | Public coverage and quality dashboards | Fed by the CircleCI `coverage` job; they run uninterrupted and remain dashboards, never threshold authorities |

Manual full run (Requirement 113): `curl -X POST https://circleci.com/api/v2/project/gh/web2solutions/Jumentix/pipeline -H "Circle-Token: ..." -d '{"branch":"dev","parameters":{"force_full":true}}'` — the `force_full` pipeline parameter maps to the `scheduled-full` context and runs the full job matrix on demand.

## How to re-enable GitHub Actions

Set the repository Actions variable `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI` to
`true` (repo settings: **Settings → Secrets and variables → Actions →
Variables**). One flag, fully reversible: unsetting it or setting any other
value disables the matrix again. The CircleCI pipeline is unaffected and stays
canonical either way.

## Always-on GitHub Actions exceptions

Three surfaces stay enabled regardless of the flag because they have no
CircleCI equivalent:

1. `.github/workflows/pr-feedback.yml` — uses `pull_request_target`
   trusted-fork execution, a GitHub-only security model that CircleCI cannot
   replicate.
2. The `sync-changelog` and `pr-feedback` jobs inside
   `.github/workflows/ci.yml` — cheap, event-scoped automation with no
   CircleCI job to receive them.
3. `.github/workflows/npm-publish.yml` — publishes through the protected
   GitHub Environment required by requirement `070`.

## Branch protection required checks

- `dev` requires `ci/circleci: branch-gate`, `ci/circleci: third-party-review`,
  `ci/circleci: browser-matrix`, plus the always-on GitHub `pr-feedback`
  checks.
- `main` additionally requires `ci/circleci: workspace-builds`,
  `ci/circleci: workspace-tests`, `ci/circleci: integration`,
  `ci/circleci: coverage`, `ci/circleci: website`, and
  `ci/circleci: database-matrix`.
- The standalone `sonar-reliability` check is subsumed by the CircleCI
  `coverage` job (`bun run sonar:check-reliability` runs inside it).

Codecov and SonarQube Cloud keep running without interruption through the
CircleCI `coverage` job. Required checks fail closed: a skipped, pending,
missing, timed-out, cancelled, or provider-inaccessible result is never green.
