# Canonical integrations and free private CI

`XpertMinds/Jumentix` remains the private canonical repository. Requirement 113
replaces unavailable paid check ownership with tracked, reproducible contracts.
A missing, skipped, cancelled, timed-out, or failed required check is never green.

## Canonical contract

| Concern | Required free contract | Role |
| --- | --- | --- |
| CI | GitHub Actions workflows tracked in this repository | Canonical hosted executor for PRs to `dev`, promotions to `main`, and both protected branches |
| Coverage | repository-owned coverage workflow, JSON/LCOV artifacts, project and patch thresholds | Canonical coverage authority; no provider account or token |
| Quality | Branch-aware Bun quality gate and Storybook build/smoke/prepublish | Required product and governance validation |
| SAST/quality | SonarQube Cloud | Defense in depth while its free private-project entitlement remains available |
| Dependencies | Repository-owned OSV.dev scanner plus Dependabot | Fail-closed vulnerability detection and update proposals |
| Secrets | Pinned OSS scanner executed by GitHub Actions | Repository-owned replacement for paid PR secret checks |
| PR findings | Reviewdog reporters fed by pinned OSS scanners | Third-party inline review without granting a hosted vendor the source |
| Deployment | Reproducible website build and documented manual deployment | Free fallback when private organization Git binding is unavailable |

## Retired or optional services (2026-08-01)

- **CircleCI retired:** its duplicate pipeline and webhook are no longer an
  authority. GitHub Actions and the same local Bun commands own the gates.
- **Codecov retired:** private project/patch checks require a paid plan. The
  repository now calculates and publishes both metrics itself.
- **GitGuardian retired:** organization-private PR checks require a paid plan.
  A pinned OSS secret scanner owns this gate.
- Cursor Bugbot is optional because quota exhaustion makes it non-terminal; it
  cannot be a required check. Reviewdog-backed scanners provide deterministic
  third-party PR findings.
- Vercel Git binding is optional because Hobby does not bind the private
  organization repository. Build validation remains required and deployment
  has a manual, auditable fallback.
- SonarQube Cloud remains defense in depth, not the sole owner of coverage or
  security. If its private entitlement changes, repository-owned gates remain.

## Fail-closed rules

1. Actions use least-privilege permissions and immutable commit SHAs.
2. Secrets are never printed, copied from legacy stores, or committed.
3. The canonical branch gate, coverage, website, security, governance, and
   conversation-resolution checks must terminate successfully.
4. No `--no-verify`, admin merge, force merge, fake status, or temporary
   relaxation is valid evidence.
5. Branch protection lists only deterministic checks emitted by tracked
   workflows. Optional providers never block a PR by being absent.

## Repository-owned validation

```bash
bun run ci:gate:branch
bun run integrations:check
bun run test:coverage
bun run coverage:check
bun run coverage:patch
```

The same commands run locally and in GitHub Actions. Coverage artifacts are
retained by the workflow so every result is auditable without Codecov.

## Rollback and provider changes

Provider links can be removed independently. A replacement becomes required
only through a governed requirement and a successful PR to `dev`; external
green badges or dashboards never override repository evidence.
