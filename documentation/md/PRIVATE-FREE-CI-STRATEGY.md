# Private Repository Free CI Strategy

## Decision

Jumentix remains private under `XpertMinds`. CircleCI is the canonical CI
orchestrator while GitHub Actions billing blocks hosted execution; evidence is
generated and retained by the repository wherever a hosted service charges for
private-repository enforcement. Required checks fail closed and no skipped,
neutral, missing, timed-out, or pending result is green.

## Free replacement map

| Retired or unreliable service | Repository-owned replacement | Required evidence |
| --- | --- | --- |
| GitHub Actions billing | CircleCI branch-aware workflow | `branch-gate` plus JSON gate artifact |
| Codecov private checks | Jest/Bun LCOV, project threshold and changed-lines checkers, then Codecov CLI upload from CircleCI | `coverage`, JSON, LCOV, patch evidence, and `codecov` upload |
| GitGuardian | pinned Gitleaks CLI in CircleCI | SARIF artifacts and terminal `third-party-review` result |
| Snyk private enforcement | `bun audit`, override integrity and pinned Semgrep | dependency/security cells and Reviewdog annotations |
| Hosted PR reviewer dependency | pinned Semgrep and Gitleaks through Reviewdog | required `third-party-review` check |

SonarQube Cloud stays as defense in depth while its private-project allowance is
available. It is not the sole owner of coverage or security evidence. If that
allowance disappears, repository-owned gates remain blocking; branch protection
changes only in the governed PR that records the provider retirement.

## Pull-request gate plan

Task PRs target `dev`; only release promotion from `dev` targets `main`.

| Gate | `dev` task PR | `dev` push | `dev -> main` promotion |
| --- | --- | --- | --- |
| Branch-aware build/test | required, affected tests | required, canonical unit gate | required, full strict matrix |
| Repository-owned coverage | required | required | required |
| Third-party review | required | required | required |
| Sonar quality gate | required | required | required while available |
| Storybook/site quality | required when triggered | required | required |
| Governance/traceability | required in selected matrix | required | required |

The strict matrix includes toolchain, dependency audit, secret/security smoke,
architecture boundaries, workspace policy, requirements/NFR, registry source,
unit/integration/e2e suites, coverage, OpenAPI/serverless contracts, build and
smoke cells. Every cell emits terminal evidence; failures are fixed, never
bypassed.

## Coverage contract

- Statements, lines and functions: 99%.
- Branches: 90%.
- Changed lines: 99%.
- CircleCI retains JSON and LCOV for independent audit and uploads LCOV to Codecov for visibility.
- Local production/development gates stay fast: full coverage production and patch coverage are required in CircleCI for `dev` and `main`, not inside local `ci:gate`.
- README branch badges and the coverage map point only to canonical workflows.

## Third-party review contract

The CircleCI `third-party-review` job runs pinned Gitleaks and Semgrep binaries.
Downloads are checksum-verified, SARIF is retained, and scanner errors or
findings return a non-zero terminal result. Mutable tags and silent
`continue-on-error` paths are rejected by `ci:check-third-party-review`.

Automated review supplements the mandatory quality matrix; it does not replace
tests, coverage, human accountability, or resolution of valid PR comments.

## Operations and failure recovery

1. Keep the exact required checks on protected `dev` and `main`; approval count
   stays optional, but quality/security evidence remains mandatory.
2. Pin tool versions and OCI digests. Review upstream releases monthly and apply
   upgrades through governed PRs with checksum and contract tests.
3. Retain gate, coverage, SARIF and scanner artifacts for the workflow retention
   window; never put secrets in logs or artifacts.
4. If CircleCI capacity is unavailable, use an ephemeral XpertMinds self-hosted
   runner with the same Bun commands and no persistent credentials. Local
   execution is diagnostic only; protected remote checks must still finish.
5. If a provider stops working, fail closed, record the outage in the Linear
   Project Update, replace it with a pinned repository-owned tool, and change
   protection only after the replacement is green.
6. Weekly: inspect check names and failed schedules. Monthly: review tokens,
   scanner pins and retention. Quarterly: test provider-loss and runner recovery.

## Required-check names

- `branch-gate`
- `coverage`
- `third-party-review`
- `codecov`
- `sonarqube`
- `website`

Cursor Bugbot is neutral/skipped and is not evidence. A future hosted reviewer
may be defense in depth only; it cannot replace the pinned fail-closed workflow.

## Definition of green

A PR is green only when every required check is terminally successful, valid
review findings are resolved, PR/Linear traceability is complete, and protected
merge succeeds without `--no-verify`, admin, force, or equivalent bypass.
