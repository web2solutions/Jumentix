# 113 - Private Free Repository-Owned CI and Coverage Evidence

- Status: Active
- Nature: NFR (CI/CD, security, coverage, governance)
- Source: Project owner decision, 2026-08-01; amended 2026-08-03 after GitHub Actions billing stopped hosted execution.
- Amends: `107` CircleCI redundancy.
- Replaces: `014` external Codecov dependency with CircleCI-hosted Codecov publishing.

## Requirement

1. `XpertMinds/Jumentix` remains private and canonical.
2. Required delivery evidence must have a zero-cost, repository-owned path. Paid-only provider checks must not be required.
3. CircleCI is the canonical hosted executor while GitHub Actions billing blocks hosted execution. The same commands remain executable locally or on a self-hosted runner without changing policy.
4. Coverage is produced by Jest, checked fail-closed by `ci-cd/check-coverage-thresholds.js`, and checked at patch level by `ci-cd/check-patch-coverage.js`. Missing reports fail.
5. Coverage evidence is uploaded as a CircleCI artifact and published to Codecov from CircleCI when `CODECOV_TOKEN` is configured. Codecov publishing is required for visibility, but Codecov is not the coverage authority and cannot weaken repository-owned thresholds.
6. GitHub Actions workflows are disabled in this repository while billing prevents execution. A configured but quota-blocked duplicate pipeline is not redundancy and must not be represented as a passing provider.
7. The full coverage gate runs in CircleCI for both `dev` and `main` so local production/development flows remain fast. Local commands may run coverage diagnostically, but local `ci:gate` and `ci:gate:strict` must not be the production coverage authority.
8. SonarQube Cloud may remain as defense-in-depth while operational, but repository-owned coverage and security gates remain authoritative if it becomes unavailable.
9. CircleCI jobs use frozen dependencies, deterministic pinned tools/images where available, explicit failure on missing evidence, and retained evidence artifacts.
10. Pending, skipped, missing, timed-out, cancelled, quota-blocked, or provider-inaccessible checks are never passing.
11. No `--no-verify`, admin bypass, force merge, swallowed failure, or synthetic green is allowed.

## Required CI plan

- Task branches: changed/related tests plus governance, security, architecture, coverage-policy, and third-party review checks.
- PRs to `dev`: complete unit/coverage gate, website gate, security/review gate, and Sonar defense-in-depth while configured.
- Promotions to `main`: the same CircleCI checks must be green on `main` after promotion; Sonar runs on both `dev` and `main`.
- Scheduled/manual: full history secret scan, dependency audit, workflow lint, and complete strict matrix.

## Temporary bridge: CircleCI (owner decision, 2026-08-03)

The §3 condition is currently false: the account's GitHub Actions allowance rejects new job starts with "recent account payments have failed or your spending limit needs to be increased", so the canonical hosted executor cannot run. Until the allowance is restored, the project owner has authorized a bridge:

1. CircleCI is temporarily unretired as the bridge executor. Its configuration must carry the `x-jumentix-temporary-bridge:` marker; an unmarked CircleCI configuration remains a §6 violation and `ci:check-provider` fails on it.
2. The repository-owned GitHub workflows stay in the tree and stay authoritative for what the gate is. CircleCI mirrors them job for job; no threshold, coverage, review, or security gate is waived, weakened, or substituted.
3. Owner-authorized admin merges may bypass the quota-blocked GitHub checks for the promotion to `main` that restores green delivery. This is a narrow §10 exception for the quota condition in §9: quota-blocked checks remain non-passing, they are explicitly bypassed by owner decision — not silently treated as green. Every check that CAN run must run and pass.
4. When the GitHub Actions allowance is restored, the CircleCI configuration, the bridge marker, and this section are removed, and §6 is reinstated in full.

## Verification

- `bun run ci:check-provider`
- `bun run integrations:check`
- CircleCI `coverage` job: `bun run test:coverage && bun run coverage:check && bun run coverage:patch`, followed by Codecov upload.
- Required checks use CircleCI job names for both `dev` and `main`: `branch-gate`, `coverage`, `website`, `third-party-review`, `codecov`, and `sonarqube` where configured.
