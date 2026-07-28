# Requirement 098 - Commit, Push, and Merge Authorization

## Status
Implemented

## Context
Jumentix requires explicit authorization control over who can commit, push, and merge to the repository to maintain auditability and prevent unauthorized changes.

## Policy
Only the project owner email `web2solucoes@gmail.com` and explicitly authorized individuals may perform commit, push, and merge operations in the Jumentix repository.

## Operational Rules
1. The authorized email for commit, push, and merge operations is: `web2solucoes@gmail.com`.
2. Additional individuals may be explicitly authorized by the project owner through:
   - a documented grant recorded in a Linear Issue or Project Update, or
   - a repository collaborator invitation approved by the project owner.
3. All commits must be authored by an authorized email.
4. All pushes must originate from an authorized account.
5. All PR merges must be performed by an authorized user.
6. AI agents and automation tools may create commits and push branches only if their runtime identity is explicitly authorized by the project owner.
7. Authorization grants must be recorded in Linear with the grant date, scope, and recipient identity.
8. GitHub branch protection rules and repository settings must enforce this policy at the platform level.

## Enforcement
1. GitHub branch protection rules on `main` and `dev` must restrict push and merge access to authorized users.
2. Repository collaborator settings must list only authorized individuals.
3. Commit signature verification or author email checks may be used as additional enforcement.
4. Automated CI/CD workflows must not bypass authorization checks.

## Evidence
- Requirement registered in `.agents/README.md`.
- NFR registry updated.
- Repository settings enforce the authorization policy.
- Governance docs reference this requirement.

## Acceptance Criteria
- Only `web2solucoes@gmail.com` (and explicitly authorized others) can push to or merge PRs in `main` and `dev`.
- Authorization grants are documented in Linear.
- GitHub branch protection rules reflect the policy.
