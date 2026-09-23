# Public Open Source Free CI Strategy

## Decision

`web2solutions/Jumentix` is the public canonical repository. CircleCI is
the canonical CI orchestrator for the full matrix, GitHub Actions is retained
as a fallback that is disabled by default behind the repository Actions
variable `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI` (three always-on exceptions
remain: `pr-feedback.yml`, the `sync-changelog`/`pr-feedback` jobs in
`ci.yml`, and `npm-publish.yml`), and both providers use free open-source
execution paths. Codecov and
SonarQube Cloud remain active because the repository is public; they are
published by the full coverage gate on CircleCI and must not replace
repository-owned threshold checks.

Required checks fail closed. A skipped, neutral, missing, timed-out, cancelled,
or pending result is not green.

## Provider map

| Provider | Role | Required evidence |
| --- | --- | --- |
| CircleCI | Canonical branch-aware CI/CD gate for the full matrix | `branch-gate`, full-matrix jobs, JSON/LCOV/SARIF evidence |
| GitHub Actions | Retained fallback, disabled by default behind `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI`; always-on exceptions: `pr-feedback.yml`, `sync-changelog`/`pr-feedback` jobs, `npm-publish.yml` | Same context classifier, same job names when the flag is `true`, artifacts retained |
| Codecov | Public file-by-file coverage map | LCOV upload from the full `coverage` job |
| SonarQube Cloud | Public quality, reliability, security and coverage dashboard | Scanner run after repository coverage passes |
| OSV.dev, Gitleaks, Semgrep | Repository-owned security checks | Terminal dependency/security results and SARIF artifacts |

## Pull-request gate plan

Task PRs target `dev`; only release promotion from `dev` targets `main`.

| Gate | `dev` task PR | `dev` push | `dev -> main` promotion |
| --- | --- | --- | --- |
| Branch-aware build/test | required, layer-affected tests | required, unit health gate | required, strict matrix |
| Third-party review | required | not required | required |
| Repository coverage | deferred | deferred | required |
| Codecov upload | deferred | deferred | required |
| Sonar scan | deferred | deferred | required |
| Website quality | only when selected by `test-map.json` | deferred | required |
| Database matrix | deferred | deferred | required |

Task PRs to `dev` have a ten-minute-or-less operating target. On CircleCI the
`branch-gate` job classifies the context, reads `test-map.json`, and runs only
affected/related suites plus lightweight governance and security checks; the
`browser-matrix` and `third-party-review` jobs run alongside it. The
full matrix runs for `dev -> main` release promotions, `main` pushes, and the
CircleCI nightly scheduled trigger or manual full runs.

## Coverage contract

- Statements, lines and functions: 99%.
- Branches: 90%.
- Changed lines: 99%.
- CircleCI retains JSON and LCOV evidence and uploads LCOV to
  Codecov when the full `coverage` job runs; the GitHub Actions fallback does
  the same when `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI` is `true`.
- SonarQube Cloud reads the same LCOV paths declared in
  `sonar-project.properties`.
- Local gates and PRs up to `dev` stay fast by deferring full coverage and
  patch coverage to release promotion.

## Branch protection

`dev` requires the cheap destination checks: the CircleCI contexts
`ci/circleci: branch-gate`, `ci/circleci: third-party-review`, and
`ci/circleci: browser-matrix`, plus the always-on GitHub Actions `pr-feedback`
checks, verified signatures, pull requests, non-fast-forward
protection, deletion protection, and resolved review threads. The SonarCloud
reliability-A check is subsumed by the CircleCI `coverage` job.

`main` requires the full destination checks: `ci/circleci: branch-gate`,
`ci/circleci: third-party-review`, `ci/circleci: browser-matrix`,
`ci/circleci: workspace-builds`, `ci/circleci: workspace-tests`,
`ci/circleci: integration`, `ci/circleci: coverage`, `ci/circleci: website`,
and `ci/circleci: database-matrix`, plus the always-on `pr-feedback` checks,
verified signatures, pull
requests, non-fast-forward protection, deletion protection, and resolved review
threads.

## Definition of green

A PR is green only when every destination-required check is terminally
successful, valid review threads are resolved, traceability evidence is current,
and the protected merge succeeds without `--no-verify`, admin, force, or
equivalent bypass.
