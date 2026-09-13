# 113 - Public Open Source CI and Coverage Evidence

- Status: Active
- Nature: NFR (CI/CD, security, coverage, governance)
- Source: Project owner decision, 2026-08-01; amended 2026-08-03 after GitHub Actions billing stopped hosted execution; amended 2026-08-09 to keep task delivery to `dev` under a cheap layer-aware gate; amended 2026-08-09 to restore GitHub Actions and disable CircleCI; amended 2026-09-13 after transfer to the public `web2solutions/Jumentix` repository to re-enable free open-source GitHub Actions, CircleCI, Codecov and SonarQube Cloud integrations.
- Amends: `107` CircleCI redundancy.
- Replaces: `014` external Codecov dependency with repository-owned coverage gates plus public Codecov publishing.

## Requirement

1. `web2solutions/Jumentix` is public and canonical.
2. Required delivery evidence must have a free open-source path. Paid-only provider checks must not be required.
3. GitHub Actions is the canonical orchestrator on GitHub-hosted `ubuntu-latest`
   runners. CircleCI is enabled as the secondary public CI mirror and must use
   the same context classifier and destination-aware gate policy.
4. Coverage is produced by Jest, checked fail-closed by `ci-cd/check-coverage-thresholds.js`, and checked at patch level by `ci-cd/check-patch-coverage.js`. Missing reports fail.
5. Coverage evidence is retained as CI artifacts and published to Codecov when
   `CODECOV_TOKEN` is configured. Codecov publishing is required for
   visibility, but Codecov is not the coverage authority and cannot weaken
   repository-owned thresholds.
6. CircleCI workflows are enabled for the public repository and must halt
   non-selected heavy jobs before starting costly work.
7. GitHub Actions jobs must use GitHub-hosted `ubuntu-latest` runners and Node
   22 compatibility setup.
7. The full coverage gate runs in GitHub Actions for `dev -> main` release promotions, `main` pushes, and scheduled/manual full runs so task delivery to `dev` remains fast. Local commands may run coverage diagnostically, but local `ci:gate` and task PR gates must not be the production coverage authority.
8. SonarQube Cloud remains active on the public `web2solutions_Jumentix`
   project while configured, but repository-owned coverage and security gates
   remain authoritative if it becomes unavailable.
9. GitHub Actions jobs use frozen dependencies, deterministic pinned tools/actions where available, explicit failure on missing evidence, and retained evidence artifacts.
10. Pending, skipped, missing, timed-out, cancelled, quota-blocked, or provider-inaccessible checks are never passing.
11. No `--no-verify`, admin bypass, force merge, swallowed failure, or synthetic green is allowed.

## Required CI plan

- Task branches: changed/related tests selected from `test-map.json`.
- PRs to `dev`: the layer-aware task gate, plus mandatory lightweight third-party review; operational target is ten minutes or less.
- Pushes to `dev`: cheap unit health gate.
- Promotions to `main`: complete strict matrix, coverage, website, database smoke, third-party review, Codecov publishing, and Sonar defense-in-depth while configured.
- Pushes to `main`: the same full suite remains mandatory after promotion.
- Scheduled/manual: full history secret scan, dependency audit, workflow lint, and complete strict matrix.

## Verification

- `bun run ci:check-provider`
- `bun run integrations:check`
- Full-suite `coverage` job during release/main contexts: `bun run test:coverage && bun run coverage:check && bun run coverage:patch`, followed by Codecov upload and SonarQube Cloud scan.
- Required task PR checks use GitHub Actions job names `branch-gate` and `third-party-review`; required release/main checks use `branch-gate`, `workspace-builds`, `workspace-tests`, `integration`, `coverage`, `website`, `third-party-review`, and `database-matrix`.
