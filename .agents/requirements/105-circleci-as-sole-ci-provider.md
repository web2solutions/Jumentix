# 105 - CircleCI as the Sole CI Provider

- Status: Active
- Nature: NFR (CI/CD, governance)
- Source: Project owner decision, 2026-07-30. Recorded during the Cana epic (Linear project `[EPIC][Database] Cana — IndexedDB offline database adapter`).

## Requirement

1. **CircleCI is the sole CI provider for this repository.** Every automated
   check — tests, quality gates, coverage, static analysis, website and
   Storybook validation, and release automation — runs there.

2. **GitHub Actions is retired.** No workflow under `.github/workflows/` may be
   the source of a required check. Adding a new one is a governance violation,
   not a preference.

3. **CircleCI must run on every branch**, not only `dev` and `main`. A pipeline
   that skips feature branches provides no signal on the pull request where a
   defect is cheapest to fix, and produces a merge whose only evidence is local.

4. **Requirement 065 applies unchanged.** A check that did not start is
   *pending*, not passing and not failing. It may not be described as green, and
   it may not be waved through as unrelated. A CI provider that cannot execute —
   for billing, quota, or configuration — blocks the merge exactly as a failing
   check does.

5. The pinned Bun toolchain (Requirement `096`) remains the runtime. CircleCI
   uses the official `oven/bun` image at the pinned version; it does not
   bootstrap Bun through Node or npm.

## Why this changed

GitHub Actions became unable to execute. Every run on PR #15 terminated at the
runner in under two seconds with:

> The job was not started because recent account payments have failed or your
> spending limit needs to be increased.

That is not a flaky job or a broken workflow. It is a provider that cannot run
at all, which makes every required check permanently pending — and a repository
whose governance requires green checks cannot merge anything.

The failure mode is worth recording because it is subtle: the pull request
displays red marks that *look* like test failures. They are not. Nothing
executed. Reading them as failures sends people to debug code that was never
run; reading them as noise trains people to merge without evidence. Both are
worse than an honest "CI did not run".

## Relationship to Requirement 012

Requirement `012` (CircleCI NPM/Node compatibility) predates the Bun migration
and was phase-superseded by `096` for internal tooling. It is **not** revived by
this requirement: its subject was npm/Node engine mismatch, which no longer
applies now that CircleCI runs the `oven/bun` image directly.

This requirement supersedes `012` outright. CircleCI is again the provider, but
on a different runtime with different constraints.

## Enforcement

- `ci-cd/check-ci-provider.js` fails when a GitHub Actions workflow file exists
  that could act as a required check, and when the CircleCI configuration is
  absent or does not run on all branches. Wired into `ci:gate`.
- The CircleCI configuration must express every check the retired workflows
  performed. A migration that drops a check silently is the same false green
  this requirement exists to prevent, so the checker enumerates them.
- Branch filtering must not exclude feature branches.

## Migration record

Three GitHub Actions workflows were retired, and what each did is preserved so
the CircleCI equivalents can be verified against them rather than against
memory:

| Retired workflow | What it ran | CircleCI job |
|---|---|---|
| `test.yml` | `bun run ci:gate:branch` with Redis 7.x, on every branch | `quality-gate` |
| `sonarqube-cloud.yml` | `bun run test:unit` then the SonarQube scan, on `main`/`dev` | `sonarqube` |
| `website.yml` | Storybook build, inventory smoke, publishable-content check | `website` |

The workflow files are removed rather than disabled. A disabled workflow is a
file someone re-enables later without knowing why it was off.

## Required project configuration

CircleCI must expose these environment variables, or the corresponding jobs
fail closed rather than skipping:

- `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD` — test fixtures
- `AGENT_REGISTRY_TOKEN` (or `GH_TOKEN` / `GITHUB_TOKEN`) — contents:read on
  `XpertMinds/jumentix-agent-registry`, per Requirement `089`. Default tokens
  cannot read a sibling private repository.
- `SONAR_TOKEN` — SonarQube Cloud
- `CODECOV_TOKEN` — coverage upload

A missing variable must produce a failing job with a message naming the
variable. It must never produce a skipped step that reports success.
