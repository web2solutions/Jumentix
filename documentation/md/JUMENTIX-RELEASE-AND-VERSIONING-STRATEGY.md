# JumentiX Release and Versioning Strategy

## Policy

JumentiX uses a hybrid strategy:

- `packages/*`: **independent versioning**
- `apps/*`: **locked versioning** tied to root project version

Canonical policy source:

- `release-policy.json`

Current values:

- `packageVersioning`: `independent`
- `appVersioning`: `locked`
- `appLockedVersion`: must match root `package.json` version

## Governance Enforcement

The CI gate enforces release policy through:

- `bun run release:governance:check`
- included in `bun run ci:gate`

Validation includes:

- required release scripts exist in root (`changelog:*`, `release:dry-run*`)
- `release-policy.json` exists and is valid
- publishable packages have valid semver and `files` metadata
- app workspaces are private and their version equals `appLockedVersion`

## Operational Workflow

1. Update root version intentionally.
2. Update `release-policy.json` `appLockedVersion` to same value.
3. Keep app workspace versions synchronized with locked value.
4. Run:
   - `bun run release:governance:check`
   - `bun run release:dry-run`
5. Open PR with traceability to related Jumentix project issue(s).

## Future Evolution

If release orchestration moves to Changesets, this document and
`release-policy.json` remain the policy source; automation can be swapped without
changing governance intent.
