# Requirement 098 - Commit, Push, and Merge Authorization

## Status
Implemented

## Context
Jumentix requires explicit authorization control over who can commit, push, and merge to the repository to maintain auditability and prevent unauthorized changes.

## Policy
Only emails declared in `.agents/AUTHORIZED-COMMITTERS.json` and explicitly authorized by the project owner may perform commit, push, and merge operations in the Jumentix repository. Every commit accepted by protected branches must also carry a verified signature recognized by GitHub.

## Operational Rules
1. The authorized email allowlist for commit, push, and merge operations is `.agents/AUTHORIZED-COMMITTERS.json`.
2. Additional individuals may be explicitly authorized by the project owner through:
   - a documented grant recorded in a Linear Issue or Project Update, or
   - a repository collaborator invitation approved by the project owner.
3. All commits must be authored and committed by an authorized email.
4. All commits must carry a GitHub-verified signature before they can be merged into protected branches.
5. All pushes must pass the repository-owned authorship check before publication.
6. All PR merges must be performed by an authorized user.
7. AI agents and automation tools may create commits and push branches only if their runtime identity is explicitly authorized by the project owner and their commits are signed with a verified key for that identity.
8. Authorization grants must be recorded in Linear with the grant date, scope, recipient identity, and signing-key ownership evidence.
9. GitHub branch protection rules and repository settings must enforce this policy at the platform level.

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
4. Commit signature verification is mandatory for protected branches; author and committer
   email checks remain mandatory under Requirement `111`.
5. Automated CI/CD workflows must not bypass authorization checks.

## Evidence
- Requirement registered in `.agents/README.md`.
- NFR registry updated.
- Repository settings enforce the authorization policy.
- Governance docs reference this requirement.

## Acceptance Criteria
- Only declared and explicitly authorized identities can push to or merge PRs in `main` and `dev`.
- Protected branches reject unsigned commits and commits whose signatures are not verified by GitHub.
- Authorization grants are documented in Linear.
- GitHub branch protection and rulesets reflect the review-optional, checks-mandatory policy.
