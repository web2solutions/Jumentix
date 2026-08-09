# 113 - Private Free Repository-Owned CI and Coverage Evidence

- Status: Active
- Nature: NFR (CI/CD, security, coverage, governance)
- Source: Project owner decision, 2026-08-01; amended 2026-08-03 after GitHub Actions billing stopped hosted execution; amended 2026-08-09 to keep task delivery to `dev` under a cheap layer-aware gate; amended 2026-08-09 to restore GitHub Actions and disable CircleCI.
- Amends: `107` CircleCI redundancy.
- Replaces: `014` external Codecov dependency with GitHub Actions-hosted Codecov publishing.

## Requirement

1. `XpertMinds/Jumentix` remains private and canonical.
2. Required delivery evidence must have a zero-cost, repository-owned path. Paid-only provider checks must not be required.
3. GitHub Actions is the canonical orchestrator. Hosted billing failures are handled by
   repository-owned self-hosted runners; CircleCI disabled means `.circleci/config.yml`
   must not be present or required.
4. Coverage is produced by Jest, checked fail-closed by `ci-cd/check-coverage-thresholds.js`, and checked at patch level by `ci-cd/check-patch-coverage.js`. Missing reports fail.
5. Coverage evidence is uploaded as a GitHub Actions artifact and published to Codecov from GitHub Actions when `CODECOV_TOKEN` is configured. Codecov publishing is required for visibility, but Codecov is not the coverage authority and cannot weaken repository-owned thresholds.
6. CircleCI workflows are disabled in this repository. A configured duplicate pipeline is not redundancy and must not be represented as a passing provider.
7. GitHub Actions jobs must use the repository-owned self-hosted runner label `jumentix`
   until hosted runner billing is explicitly restored through a governed requirement change.
7. The full coverage gate runs in GitHub Actions for `dev -> main` release promotions, `main` pushes, and scheduled/manual full runs so task delivery to `dev` remains fast. Local commands may run coverage diagnostically, but local `ci:gate` and task PR gates must not be the production coverage authority.
8. SonarQube Cloud may remain as defense-in-depth while operational, but repository-owned coverage and security gates remain authoritative if it becomes unavailable.
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
- GitHub Actions `coverage` job during full-suite contexts: `bun run test:coverage && bun run coverage:check && bun run coverage:patch`, followed by Codecov upload.
- Required task PR checks use GitHub Actions job names `branch-gate` and `third-party-review`; required release/main checks use `branch-gate`, `workspace-builds`, `workspace-tests`, `integration`, `coverage`, `website`, `third-party-review`, and `database-matrix`.
