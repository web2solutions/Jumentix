# 107 - CircleCI Hosted CI While GitHub Actions Billing Is Blocked

- Status: Active again through Requirement `113` amendment on 2026-08-03
- Nature: NFR (CI/CD, governance)
- Source: Project owner decision, 2026-07-30, revised the same day.

## Revision note

GitHub Actions billing is again preventing hosted execution for the private
repository. The project owner directed CircleCI to replace the disabled GitHub
Actions setup and keep `main` and `dev` green from repository-owned commands.

The file keeps its original slug so existing links do not break; the title above
is authoritative.

## Requirement

1. **CircleCI is the active hosted provider.** The `.circleci/config.yml`
   workflow owns the remote branch gate, coverage, website, third-party review,
   Codecov publishing, and Sonar defense-in-depth checks while GitHub Actions
   billing is blocked.

2. **CircleCI must run on every branch**, not only `dev` and `main`. This was the
   real gap and it survives the revision: the previous CircleCI configuration
   filtered to `only: [dev, main]`, so when GitHub Actions went dark, feature
   branches had coverage from neither provider.

3. **CircleCI must cover every retired GitHub Actions check.** The replacement
   is only valid when it carries the same branch gate, coverage, website,
   third-party review, Codecov publishing, and Sonar responsibilities.

4. **Requirement `065` applies unchanged.** A check that did not start is
   *pending* — not passing, not failing. It may not be described as green, and it
   may not be waved through as unrelated. A provider that cannot execute blocks a
   merge exactly as a failing check does.

5. The pinned Bun toolchain (Requirement `096`) remains the internal runtime.
   CircleCI may use a Node 22 browser image for browser compatibility, but the
   repository commands still install and assert Bun `1.3.14`.

## Why both, rather than one

The billing outage demonstrated the failure mode concretely. A single provider
going dark takes every required check with it, and the pull request then shows
red marks that look exactly like test failures. Reading them as failures sends
people to debug code that never ran; reading them as noise trains people to
merge without evidence. Both readings are worse than an honest "CI did not run".

## Enforcement

`ci-cd/check-ci-provider.js`, wired into `ci:gate`:

- The CircleCI configuration must be present.
- GitHub Actions workflow YAML must not be present while billing blocks
  execution.
- The CircleCI configuration must express every retired workflow responsibility,
  enumerated explicitly — a dropped job is otherwise silent: nothing fails, the
  pipeline simply covers less.
- The CircleCI quality gate must not be branch-filtered.

## Required project configuration

CircleCI must expose these, or the corresponding jobs fail closed rather than
skipping:

- `JUMENTIX_JWT_TOKEN_SECRET_KEY`, `JUMENTIX_REDIS_PASSWORD` — test fixtures
- `AGENT_REGISTRY_TOKEN` (or `GH_TOKEN` / `GITHUB_TOKEN`) — contents:read on
  `XpertMinds/jumentix-agent-registry`, per Requirement `089`. Default tokens
  cannot read a sibling private repository.
- `SONAR_TOKEN` — SonarQube Cloud
- `CODECOV_TOKEN` — Codecov upload from CircleCI
A missing variable must produce a failing job naming the variable. It must never
produce a skipped step that reports success.

## Relationship to Requirement 012

Requirement `012` (CircleCI NPM/Node compatibility) predates the Bun migration
and was phase-superseded by `096` for internal tooling. Its subject — npm/Node
engine mismatch from upgrading npm on an older Node patch — no longer applies,
because CircleCI now runs the `oven/bun` image directly with no npm and no Node
bootstrap. This requirement supersedes it on that basis.
