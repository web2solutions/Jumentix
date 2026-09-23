# 113 - Public Open Source CI and Coverage Evidence

- Status: Active
- Nature: NFR (CI/CD, security, coverage, governance)
- Source: Project owner decision, 2026-08-01; amended 2026-08-03 after GitHub Actions billing stopped hosted execution; amended 2026-08-09 to keep task delivery to `dev` under a cheap layer-aware gate; amended 2026-08-09 to restore GitHub Actions and disable CircleCI; amended 2026-09-13 after transfer to the public `web2solutions/Jumentix` repository to re-enable free open-source GitHub Actions, CircleCI, Codecov and SonarQube Cloud integrations; amended 2026-09-23 (owner decision, epic `[EPIC][CI] CircleCI as canonical CI; GitHub Actions minimal and reversible`, JUM-872..JUM-881) to make CircleCI the canonical orchestrator and to retain GitHub Actions disabled by default behind a single reversible flag.
- Amends: `107` CircleCI redundancy.
- Replaces: `014` external Codecov dependency with repository-owned coverage gates plus public Codecov publishing.

## Requirement

1. `web2solutions/Jumentix` is public and canonical.
2. Required delivery evidence must have a free open-source path. Paid-only provider checks must not be required.
3. CircleCI is the canonical orchestrator for the full matrix and must use the
   repository-owned context classifier and destination-aware gate policy.
   GitHub Actions is retained, disabled by default via the repository Actions
   variable `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI` (unset or not `'true'` means
   disabled), and may be re-enabled with that single flag. No workflow file or
   job block is ever deleted to achieve "disabled" — jobs are gated behind the
   flag's `if:` condition so the fallback path is always exercised-ready.
4. Three GitHub Actions surfaces stay always-on because they have no CircleCI
   equivalent: `.github/workflows/pr-feedback.yml` (`pull_request_target`
   trusted-fork execution is a GitHub-only security model), the `sync-changelog`
   and `pr-feedback` jobs inside `.github/workflows/ci.yml` (cheap, event-scoped
   automation with no CircleCI job), and `.github/workflows/npm-publish.yml`
   (requirement `070`'s protected GitHub Environment). Everything else in GitHub
   Actions — the eight `ci.yml` matrix jobs, `browser-matrix.yml`, and
   `sonar-reliability.yml` — runs only when
   `vars.JUMENTIX_ENABLE_GITHUB_ACTIONS_CI == 'true'`.
5. Coverage is produced by Jest, checked fail-closed by `ci-cd/check-coverage-thresholds.js`, and checked at patch level by `ci-cd/check-patch-coverage.js`. Missing reports fail.
6. Coverage evidence is retained as CI artifacts and published to Codecov when
   `CODECOV_TOKEN` is configured. Codecov publishing is required for
   visibility, but Codecov is not the coverage authority and cannot weaken
   repository-owned thresholds.
7. CircleCI workflows are enabled for the public repository and must halt
   non-selected heavy jobs before starting costly work.
8. SonarQube Cloud and Codecov run on CircleCI and must keep running without a
   gap at every point of the CircleCI-canonical rollout; no change may merge if
   it interrupts either integration's history.
9. SonarQube Cloud remains active on the public `web2solutions_Jumentix`
   project while configured, but repository-owned coverage and security gates
   remain authoritative if it becomes unavailable.
10. CI jobs use frozen dependencies, deterministic pinned tools/actions where available, explicit failure on missing evidence, and retained evidence artifacts. GitHub Actions jobs use GitHub-hosted `ubuntu-latest` runners and Node 22 compatibility setup.
11. The full coverage gate runs in CircleCI for `dev -> main` release promotions, `main` pushes, and scheduled/manual full runs so task delivery to `dev` remains fast. Local commands may run coverage diagnostically, but local `ci:gate` and task PR gates must not be the production coverage authority.
12. Pending, skipped, missing, timed-out, cancelled, quota-blocked, or provider-inaccessible checks are never passing.
13. No `--no-verify`, admin bypass, force merge, swallowed failure, or synthetic green is allowed.

## Required CI plan

- Task branches: changed/related tests selected from `test-map.json`.
- PRs to `dev`: the layer-aware task gate, mandatory lightweight third-party review, the no-secret Chrome/Firefox/WebKit browser matrix, and a fail-closed SonarCloud reliability-A check; operational target is ten minutes or less. On CircleCI the browser matrix runs as the `browser-matrix` job and the SonarCloud reliability check runs inside the `coverage` job.
- Pushes to `dev`: cheap unit health gate plus coverage publishing to Codecov and SonarQube Cloud.
- Promotions to `main`: complete strict matrix, coverage, website, database smoke, third-party review, Codecov publishing, and Sonar defense-in-depth while configured.
- Pushes to `main`: the same full suite remains mandatory after promotion.
- Scheduled/manual: full history secret scan, dependency audit, workflow lint, and complete strict matrix. The scheduled full run is owned by the CircleCI nightly pipeline trigger.

## Verification

- `bun run ci:check-provider`
- `bun run integrations:check`
- Full-suite `coverage` job during release/main contexts: `bun run test:coverage && bun run coverage:check && bun run coverage:patch`, followed by Codecov upload and SonarQube Cloud scan.
- Required protected-branch PR checks are the CircleCI check contexts `ci/circleci: branch-gate`, `ci/circleci: third-party-review`, and `ci/circleci: browser-matrix`, plus the always-on GitHub Actions `pr-feedback` checks; the CircleCI `coverage` job subsumes `sonar-reliability` per rule 8/9. Release/main checks additionally use the CircleCI contexts `ci/circleci: workspace-builds`, `ci/circleci: workspace-tests`, `ci/circleci: integration`, `ci/circleci: coverage`, `ci/circleci: website`, and `ci/circleci: database-matrix`. When `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI` is set to `'true'`, the GitHub Actions jobs with the same names run as the equivalent fallback checks.
