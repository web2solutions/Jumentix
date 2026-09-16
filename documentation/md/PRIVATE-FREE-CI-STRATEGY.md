# Public Open Source Free CI Strategy

## Decision

`web2solutions/Jumentix` is the public canonical repository. GitHub Actions is
the canonical CI orchestrator, CircleCI is enabled as the secondary public
provider, and both providers use free open-source execution paths. Codecov and
SonarQube Cloud remain active because the repository is public; they are
published by the full coverage gate and must not replace repository-owned
threshold checks.

Required checks fail closed. A skipped, neutral, missing, timed-out, cancelled,
or pending result is not green.

## Provider map

| Provider | Role | Required evidence |
| --- | --- | --- |
| GitHub Actions | Canonical branch-aware CI/CD gate on `ubuntu-latest` | `branch-gate`, full-matrix jobs, JSON/LCOV/SARIF evidence |
| CircleCI | Secondary CI mirror for public open-source runs | Same context classifier, same job names, artifacts retained |
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

Task PRs to `dev` have a ten-minute-or-less operating target. The
`branch-gate` classifies the context, reads `test-map.json`, and runs only
affected/related suites plus lightweight governance and security checks. The
full matrix runs for `dev -> main` release promotions, `main` pushes, and
scheduled or manual full runs.

## Coverage contract

- Statements, lines and functions: 99%.
- Branches: 90%.
- Changed lines: 99%.
- GitHub Actions and CircleCI retain JSON and LCOV evidence and upload LCOV to
  Codecov when the full coverage job runs.
- SonarQube Cloud reads the same LCOV paths declared in
  `sonar-project.properties`.
- Local gates and PRs up to `dev` stay fast by deferring full coverage and
  patch coverage to release promotion.

## Branch protection

`dev` requires the cheap destination checks: `branch-gate` and
`third-party-review`, plus verified signatures, pull requests, non-fast-forward
protection, deletion protection, and resolved review threads.

`main` requires the full destination checks: `branch-gate`,
`third-party-review`, `workspace-builds`, `workspace-tests`, `integration`,
`coverage`, `website`, and `database-matrix`, plus verified signatures, pull
requests, non-fast-forward protection, deletion protection, and resolved review
threads.

## Definition of green

A PR is green only when every destination-required check is terminally
successful, valid review threads are resolved, traceability evidence is current,
and the protected merge succeeds without `--no-verify`, admin, force, or
equivalent bypass.
