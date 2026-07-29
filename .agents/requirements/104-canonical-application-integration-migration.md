# Requirement 104 - Canonical Application Integration Migration

## Status

Active and mandatory.

## Requirement

1. Before `web2solutions/aaa-typescript-boilerplate` is archived, every
   integration applicable to that source must be inventoried against
   `XpertMinds/Jumentix`.
2. Repository-owned configuration (workflows, badges, bootstrap URLs,
   `package.json` repository metadata, Dependabot, CircleCI/Codecov/Snyk
   identifiers, and registry consumer pinning) must target the canonical
   `XpertMinds` repositories unless a surface is explicitly marked
   transitional with an owner-auth blocker.
3. Provider-side bindings that cannot be completed with current authority must
   be recorded as precise owner-auth blockers; they must not be described as
   passing.
4. Secret values must never be read, logged, committed, or copied between
   repositories. Only secret names may be inventoried; replacement credentials
   are created through provider-supported secure channels.
5. The integration migration contract is executable through
   `INTEGRATION-MIGRATION-REQUIREMENT.md` and
   `pnpm run integration-migration:check`.
6. Review approval count remains optional. Required CI, coverage, security,
   governance, and conversation-resolution checks remain mandatory.

## Acceptance Criteria

1. The audited source-to-canonical matrix exists in English and Portuguese.
2. Fail-closed validation rejects an incomplete matrix or non-canonical
   repository-owned identifiers covered by the checker.
3. Actions secret-name and environment-name parity is recorded.
4. Every incomplete provider install is listed as an explicit owner-auth
   blocker with the owning surface named.
5. A pull request targeting `dev` demonstrates destination-appropriate hosted
   checks reaching terminal success for the surfaces that are already bound.
6. Traceability maps Requirement `104` in the NFR registry, ledger, coverage
   attestation, and documentation indexes.

## Evidence

- Linear epic: `JUM-562`
- Linear task: `JUM-568`
- Sibling registry task: `JUM-569`
- Requirement: `103` (repository authority) and `104` (integration migration)
