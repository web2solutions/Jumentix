# Requirement 098 - Commit, Push, and Merge Authorization

## Status
Implemented

## Context
Jumentix requires explicit authorization control over who can commit, push, and merge to the repository to maintain auditability and prevent unauthorized changes.

## Policy
Only emails declared in `.agents/AUTHORIZED-COMMITTERS.json` and explicitly authorized by the project owner may perform commit, push, and merge operations in the Jumentix repository.

## Operational Rules
1. The authorized email allowlist for commit, push, and merge operations is `.agents/AUTHORIZED-COMMITTERS.json`.
2. Additional individuals may be explicitly authorized by the project owner through:
   - a documented grant recorded in a Linear Issue or Project Update, or
   - a repository collaborator invitation approved by the project owner.
3. All commits must be authored and committed by an authorized email.
4. All pushes must pass the repository-owned authorship check before publication.
5. All PR merges must be performed by an authorized user.
6. AI agents and automation tools may create commits and push branches only if their runtime identity is explicitly authorized by the project owner.
7. Authorization grants must be recorded in Linear with the grant date, scope, and recipient identity.
8. GitHub branch protection rules and repository settings must enforce this policy at the platform level.

## Enforcement
1. GitHub branch protection and rulesets on `main` and `dev` require the destination-appropriate
   checks and block force pushes/deletions. PR review is optional and no approval count is
   required.
2. The canonical repositories are owned by the `XpertMinds` organization and their access
   lists must contain only identities authorized by the project owner in Linear.
3. Organization-owned repositories must use user/team restrictions when the active GitHub plan
   exposes that control. When the plan does not expose branch protection for private
   repositories, repository workflows, required evidence, and owner-controlled merge authority
   remain mandatory and the limitation must be reported truthfully.
4. Commit signature verification may be used as additional enforcement; author and committer
   email checks are mandatory under Requirement `111`.
5. Automated CI/CD workflows must not bypass authorization checks.

## Evidence
- Requirement registered in `.agents/README.md`.
- NFR registry updated.
- Repository settings enforce the authorization policy.
- Governance docs reference this requirement.

## Acceptance Criteria
- Only declared and explicitly authorized identities can push to or merge PRs in `main` and `dev`.
- Authorization grants are documented in Linear.
- GitHub branch protection and rulesets reflect the review-optional, checks-mandatory policy.
