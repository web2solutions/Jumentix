# 107 - CircleCI Runs Every Branch Alongside GitHub Actions

- Status: Superseded by Requirement `113` on 2026-08-01
- Nature: NFR (CI/CD, governance)
- Source: Project owner decision, 2026-07-30, revised the same day.

## Revision note

An earlier draft retired GitHub Actions entirely and made CircleCI the sole
provider. That was written while GitHub Actions could not execute at all — every
run terminated at the runner on a billing failure, which left every required
check permanently pending and, under Requirement `065`, blocked every merge.

**Billing has since been resolved and GitHub Actions runs again.** The project
owner has directed that the workflows stay. This requirement is revised
accordingly: both providers run, and CircleCI is kept correct and complete
rather than being a replacement.

The file keeps its original slug so existing links do not break; the title above
is authoritative.

## Supersession

CircleCI ceased producing canonical checks for the private XpertMinds repository.
Requirement `113` retires the inactive provider and replaces its redundancy claim
with repository-owned commands that run on GitHub-hosted or self-hosted runners.
Historical clauses below remain for audit only.

## Requirement

1. **Both providers are active.** The workflows under `.github/workflows/`
   remain, and CircleCI runs in parallel via `.circleci/config.yml`.

2. **CircleCI must run on every branch**, not only `dev` and `main`. This was the
   real gap and it survives the revision: the previous CircleCI configuration
   filtered to `only: [dev, main]`, so when GitHub Actions went dark, feature
   branches had coverage from neither provider.

3. **CircleCI must cover every check GitHub Actions covers.** Two providers
   checking different things are not redundancy — they are two partial
   pipelines, and neither can be trusted alone. The point of running both is
   that either going dark degrades coverage instead of eliminating it.

4. **Requirement `065` applies unchanged.** A check that did not start is
   *pending* — not passing, not failing. It may not be described as green, and it
   may not be waved through as unrelated. A provider that cannot execute blocks a
   merge exactly as a failing check does.

5. The pinned Bun toolchain (Requirement `096`) is the runtime on both. CircleCI
   uses the official `oven/bun` image at the pinned version; it does not
   bootstrap Bun through Node or npm.

## Why both, rather than one

The billing outage demonstrated the failure mode concretely. A single provider
going dark takes every required check with it, and the pull request then shows
red marks that look exactly like test failures. Reading them as failures sends
people to debug code that never ran; reading them as noise trains people to
merge without evidence. Both readings are worse than an honest "CI did not run".

## Enforcement

`ci-cd/check-ci-provider.js`, wired into `ci:gate`:

- Both configurations must be present.
- The CircleCI configuration must express every check the GitHub Actions
  workflows perform, enumerated explicitly — a dropped job is otherwise silent:
  nothing fails, the pipeline simply covers less.
- The CircleCI quality gate must not be branch-filtered.

## Required project configuration

CircleCI must expose these, or the corresponding jobs fail closed rather than
skipping:

- `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD` — test fixtures
- `AGENT_REGISTRY_TOKEN` (or `GH_TOKEN` / `GITHUB_TOKEN`) — contents:read on
  `XpertMinds/jumentix-agent-registry`, per Requirement `089`. Default tokens
  cannot read a sibling private repository.
- `SONAR_TOKEN` — SonarQube Cloud
- `CODECOV_TOKEN` — coverage upload

A missing variable must produce a failing job naming the variable. It must never
produce a skipped step that reports success.

## Relationship to Requirement 012

Requirement `012` (CircleCI NPM/Node compatibility) predates the Bun migration
and was phase-superseded by `096` for internal tooling. Its subject — npm/Node
engine mismatch from upgrading npm on an older Node patch — no longer applies,
because CircleCI now runs the `oven/bun` image directly with no npm and no Node
bootstrap. This requirement supersedes it on that basis.
