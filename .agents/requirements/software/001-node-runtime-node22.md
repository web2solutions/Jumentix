# 001 - Node Runtime Lock (22.x)

## Requirement
Project runtime must be strictly Node.js 22.x.

## Why
Consistent runtime across local development and CI prevents engine mismatches.

## Enforced by
- `package.json` engines
- `.nvmrc`
- `.node-version`
- CI runtime versions (CircleCI/GitHub Actions)

## Status
Done

## Supersession notice (phased)

For internal engineering workflows this requirement is superseded by [096-bun-internal-tooling-runtime](096-bun-internal-tooling-runtime.md) once the Bun cutover (Linear JUM-40, project 5c38372a8e45) completes with full evidence. Until then, this requirement remains authoritative.
