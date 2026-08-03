# 020 - Coverage Threshold Approval Gate

## Requirement
All new changes can only be approved when coverage gates meet the configured thresholds.

## Why
This prevents silent quality regressions and enforces test accountability on every change set.

## Guardrails
- Local commit must fail when `bun run test:unit` fails coverage thresholds.
- Local push must fail when `bun run ci:gate` fails.
- CI must publish and validate coverage status checks before approval.
- PR approval/merge must be blocked when required coverage checks are red.

## Source of truth
- Jest thresholds in `jest.config.js`.
- Repository-owned coverage thresholds in `ci-cd/check-coverage-thresholds.js` and
  changed-line coverage in `ci-cd/check-patch-coverage.js`.
- CI gate command in `package.json` (`ci:gate`).

## Status
Active
