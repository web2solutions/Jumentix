# Requirement 104 - Canonical Application Integration Migration

## Status

Active and mandatory.

## Requirement

1. Before `web2solutions/aaa-typescript-boilerplate` is archived, every
   integration applicable to that source must be inventoried against
   `XpertMinds/Jumentix`.
2. Repository-owned configuration (workflows, badges, bootstrap URLs,
   `package.json` repository metadata, Dependabot, CircleCI/Codecov/OSV.dev
   identifiers, and registry consumer pinning) must target the canonical
   `XpertMinds` repositories unless a surface is explicitly marked
   transitional with an owner-auth blocker.
3. The inventory covers GitHub Actions, CircleCI, Codecov, SonarQube Cloud,
   the first-party OSV dependency scanner, GitGuardian, Cursor Bugbot, Vercel, Dependabot, repository and
   environment secrets, variables, environments, and webhooks wherever
   applicable to the source repository.
4. A provider is migrated only when its canonical project or application
   binding targets `XpertMinds/Jumentix` and produces observable terminal
   evidence. Copying a legacy webhook or retaining a legacy project key is not
   migration.
5. Provider-side bindings that cannot be completed with current authority must
   be recorded as precise owner-auth blockers; they must not be described as
   passing.
6. Missing credentials or provider authorization must fail closed. A workflow
   must not skip a required provider scan and then report success.
7. Secret values must never be read, logged, committed, or copied between
   repositories. Only secret names may be inventoried; replacement credentials
   are created through provider-supported secure channels.
8. The integration migration contract is executable through
   `INTEGRATION-MIGRATION-REQUIREMENT.md` and
   `bun run integration-migration:check`; provider configuration and
   fail-closed behavior are executable through
   `bun run integrations:check`.
9. Review approval count remains optional. Required CI, coverage, security,
   governance, and conversation-resolution checks remain mandatory.

## Acceptance Criteria

1. The audited source-to-canonical matrix and rollback path exist in English
   and Portuguese.
2. Fail-closed validation rejects an incomplete matrix or non-canonical
   repository-owned identifiers covered by the checker.
3. Actions secret-name and environment-name parity is recorded.
4. Every incomplete provider install is listed as an explicit owner-auth
   blocker with the owning surface named.
5. A pull request targeting `dev` demonstrates destination-appropriate hosted
   checks reaching terminal success for the surfaces that are already bound.
6. Traceability maps Requirement `104` in the NFR registry, ledger, coverage
   attestation, and documentation indexes.
7. SonarQube Cloud uses the canonical organization and project key and fails
   when `SONAR_TOKEN` is unavailable.
8. CircleCI, Codecov, the first-party OSV scanner, GitGuardian, Cursor Bugbot, and Vercel bindings
   produce canonical terminal evidence, or remain truthfully recorded as named
   owner-auth blockers.

## Evidence

- Linear epic: `JUM-562`
- Linear task: `JUM-568`
- Sibling registry task: `JUM-569`
- Requirement: `103` (repository authority) and `104` (integration migration)
- Canonical integration inventory:
  `documentation/md/CANONICAL-INTEGRATIONS-AND-PROVIDER-REBINDING.md`
- Executable provider validation: `ci-cd/check-canonical-integrations.js`
