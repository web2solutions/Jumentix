# Requirement 104 - Canonical Integration Parity and Provider Rebinding

## Status

Active and mandatory.

## Requirement

1. `XpertMinds/Jumentix` must recreate every applicable integration that
   protected the legacy application repository:
   - GitHub Actions
   - CircleCI
   - Codecov
   - SonarQube Cloud
   - Snyk
   - GitGuardian
   - Cursor Bugbot
   - Vercel
   - Dependabot
   - repository and environment secrets, variables, environments, and webhooks
2. A provider is migrated only when its canonical project/application binding
   targets `XpertMinds/Jumentix` and produces observable terminal evidence.
   Copying a legacy webhook or retaining a legacy project key is not migration.
3. Repository-owned configuration must use canonical XpertMinds identifiers.
4. Missing credentials or provider authorization must fail closed. Workflows
   must not skip a required provider scan and then report success.
5. Secret values must be recreated through provider-supported secure channels.
   They must never be read from the legacy repository, printed, logged, shared,
   or committed.
6. The source-to-destination inventory, provider-side evidence, current
   blockers, and rollback path must remain documented in English and Portuguese.
7. The deprecated application repository may be archived only after the
   canonical integration inventory is complete or each remaining provider has a
   precise owner-authentication blocker recorded in Linear.

## Acceptance Criteria

1. Repository-owned integration validation passes locally and in the complete
   strict matrix.
2. SonarQube Cloud uses the canonical organization/project and fails when
   `SONAR_TOKEN` is unavailable.
3. CircleCI and Codecov target the canonical repository and emit terminal
   checks.
4. Snyk, GitGuardian, and Cursor Bugbot are authorized for the canonical private
   repository and emit terminal security/review evidence.
5. Vercel is connected to `XpertMinds/Jumentix` and a canonical deployment
   reaches `READY`.
6. Dependabot configuration and security-update capability are active.
7. Required GitHub Actions, environments, secret names, and webhook bindings
   match the documented canonical inventory.

## Evidence

- Linear task: `JUM-568`
- Canonical integration inventory:
  `documentation/md/CANONICAL-INTEGRATIONS-AND-PROVIDER-REBINDING.md`
- Executable validation: `ci-cd/check-canonical-integrations.js`

