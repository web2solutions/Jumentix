# 012 - CircleCI NPM/Node Compatibility

## Requirement
CircleCI setup must avoid npm/node engine mismatch failures.

## Why
Upgrading npm to `latest` on older Node patch versions can break CI unexpectedly.

## Acceptance criteria
- CircleCI Node image uses a compatible Node 22.x patch level.
- Pipeline does not force `npm@latest` globally.

## Status
Done

## Superseded outright by 105 (2026-07-30)

Superseded by [105-circleci-as-sole-ci-provider](105-circleci-as-sole-ci-provider.md).

CircleCI is again the provider, but this requirement's subject — npm/Node engine
mismatch from upgrading npm on an older Node patch — no longer exists. CircleCI
now runs the `oven/bun` image directly, with no npm and no Node bootstrap.

## Supersession notice (phased, historical)

For internal engineering workflows this requirement is superseded by [096-bun-internal-tooling-runtime](096-bun-internal-tooling-runtime.md) once the Bun cutover (Linear JUM-40, project 5c38372a8e45) completes with full evidence. Until then, this requirement remains authoritative.
