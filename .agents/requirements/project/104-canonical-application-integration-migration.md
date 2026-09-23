# Requirement 104 - Canonical Application Integration Governance

## Status
Active and mandatory.

## Requirement

1. Repository-owned provider configuration targets `web2solutions/Jumentix`.
2. The governed surfaces include GitHub Actions, CircleCI, Codecov, SonarQube
   Cloud, OSV.dev, Dependabot, Vercel, secrets, variables, environments, and
   webhooks where applicable.
3. A required provider must produce terminal evidence; missing credentials,
   inaccessible providers, skipped checks, and partial configuration fail closed.
4. Secret values are never read, logged, committed, or copied. Only names may
   appear in inventories.
5. `INTEGRATION-MIGRATION-REQUIREMENT.md`, `bun run integration-migration:check`,
   and `bun run integrations:check` remain the executable governance contract.

## Acceptance Criteria

- Canonical provider identifiers and repository metadata target
  `web2solutions/Jumentix`.
- CircleCI is the canonical CI orchestrator and GitHub Actions is retained,
  disabled by default behind `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI`, under
  Requirement `113` (2026-09-23 amendment).
- Incomplete provider bindings are recorded as owner-authorized blockers, never
  as passing evidence.
- Historical migration context is only in `documentation/md/HISTORICAL-TRANSITIONS.md`.
