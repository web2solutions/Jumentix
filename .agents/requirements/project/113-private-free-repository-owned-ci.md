# 113 - Private Free Repository-Owned CI and Coverage Evidence

- Status: Active
- Nature: NFR (CI/CD, security, coverage, governance)
- Source: Project owner decision, 2026-08-01.
- Supersedes: `014` external Codecov dependency and `107` CircleCI redundancy.

## Requirement

1. `XpertMinds/Jumentix` remains private and canonical.
2. Required delivery evidence must have a zero-cost, repository-owned path. Paid-only provider checks must not be required.
3. GitHub Actions is the canonical hosted executor while its included private-repository allowance is available. The same commands remain executable locally or on a self-hosted runner without changing policy.
4. Coverage is produced by Jest, checked fail-closed by `ci-cd/check-coverage-thresholds.js`, and checked at patch level by `ci-cd/check-patch-coverage.js`. Missing reports fail.
5. Coverage evidence is uploaded as a workflow artifact. Codecov is not authoritative and its absence cannot block or weaken coverage enforcement.
6. CircleCI is retired. A configured but inactive duplicate pipeline is not redundancy and must not be represented as a passing provider.
7. SonarQube Cloud may remain as defense-in-depth while operational, but repository-owned coverage and security gates remain authoritative if it becomes unavailable.
8. Workflows use least privilege, immutable action SHAs, frozen dependencies, concurrency cancellation, explicit timeouts, and retained evidence artifacts.
9. Pending, skipped, missing, timed-out, cancelled, quota-blocked, or provider-inaccessible checks are never passing.
10. No `--no-verify`, admin bypass, force merge, swallowed failure, or synthetic green is allowed.

## Required CI plan

- Task branches: changed/related tests plus governance, security, architecture, coverage-policy, and third-party review checks.
- PRs to `dev`: complete unit/coverage gate, website gate, security/review gate, and Sonar defense-in-depth while configured.
- Promotions to `main`: strict full matrix plus all `dev` gates.
- Scheduled/manual: full history secret scan, dependency audit, workflow lint, and complete strict matrix.

## Verification

- `bun run ci:check-provider`
- `bun run integrations:check`
- `bun run test:coverage && bun run coverage:check && bun run coverage:patch`
- GitHub required checks use repository-owned job names.
