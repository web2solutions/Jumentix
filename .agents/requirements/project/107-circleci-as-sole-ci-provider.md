# 107 - Superseded CircleCI Hosted CI Bridge

- Status: Superseded by Requirement `113` amendment on 2026-08-09
- Nature: NFR (CI/CD, governance)
- Source: Project owner decision, 2026-07-30, revised the same day.

## Supersession note

GitHub Actions hosted execution has been restored by owner decision on
2026-08-09. CircleCI is disabled again, `.circleci/config.yml` must not be
present, and `.github/workflows/ci.yml` is the canonical GitHub Actions workflow.

The file keeps its original slug so existing links do not break; the title above
is authoritative.

## Historical Requirement

The following rules are historical and no longer active; Requirement `113` is
the current executable policy.

1. **CircleCI was the active hosted provider.** The `.circleci/config.yml`
   workflow owns the remote branch gate, coverage, website, third-party review,
   Codecov publishing, and Sonar defense-in-depth checks while GitHub Actions
   billing is blocked.

2. **CircleCI had to run on every branch**, not only `dev` and `main`. This was the
   real gap and it survives the revision: the previous CircleCI configuration
   filtered to `only: [dev, main]`, so when GitHub Actions went dark, feature
   branches had coverage from neither provider.

3. **CircleCI had to cover every retired GitHub Actions check.** The replacement
   is only valid when it carries the same branch gate, coverage, website,
   third-party review, Codecov publishing, and Sonar responsibilities.

4. **Requirement `065` applies unchanged.** A check that did not start is
   *pending* — not passing, not failing. It may not be described as green, and it
   may not be waved through as unrelated. A provider that cannot execute blocks a
   merge exactly as a failing check does.

5. The pinned Bun toolchain (Requirement `096`) remains the internal runtime.
   CircleCI may use a Node 22 browser image for browser compatibility, but the
   repository commands still install and assert Bun `1.3.13`.

## Why both, rather than one

The billing outage demonstrated the failure mode concretely. A single provider
going dark takes every required check with it, and the pull request then shows
red marks that look exactly like test failures. Reading them as failures sends
people to debug code that never ran; reading them as noise trains people to
merge without evidence. Both readings are worse than an honest "CI did not run".

## Former Enforcement

This section described the bridge-era `ci-cd/check-ci-provider.js` behavior.
It is retained for traceability only:

- The CircleCI configuration had to be present.
- GitHub Actions workflow YAML had to be absent while billing blocked
  execution.
- The CircleCI configuration had to express every retired workflow responsibility,
  enumerated explicitly — a dropped job is otherwise silent: nothing fails, the
  pipeline simply covers less.
- The CircleCI quality gate could not be branch-filtered.

## Former project configuration

CircleCI had to expose these during the bridge:

- `JUMENTIX_JWT_TOKEN_SECRET_KEY`, `JUMENTIX_REDIS_PASSWORD` — test fixtures
- `FIREBASE_SERVICE_ACCOUNT_KEY` — Firestore service account JSON for the
  agent registry, per Requirement `089`.
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
