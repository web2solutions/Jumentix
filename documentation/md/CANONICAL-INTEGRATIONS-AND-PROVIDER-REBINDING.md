# Canonical integrations and free private CI

`XpertMinds/Jumentix` remains the private canonical repository. Requirement 113
replaces unavailable paid check ownership with tracked, reproducible contracts.
A missing, skipped, cancelled, timed-out, or failed required check is never green.

## Canonical contract

| Concern | Required free contract | Role |
| --- | --- | --- |
| CI | GitHub Actions canonical workflow tracked in this repository | Canonical orchestrator for PRs to `dev`, promotions to `main`, and both protected branches; repository-owned self-hosted runner `jumentix`; CircleCI disabled |
| Coverage | repository-owned GitHub Actions coverage job, JSON/LCOV artifacts, project and patch thresholds | Canonical coverage authority; Codecov publishing is visibility only |
| Codecov publishing | Codecov CLI upload from GitHub Actions with `CODECOV_TOKEN` | Coverage dashboard mirror after repository-owned thresholds pass |
| Quality | Branch-aware Bun quality gate and Storybook build/smoke/prepublish | Required product and governance validation |
| SAST/quality | SonarQube Cloud | Defense in depth while its free private-project entitlement remains available |
| Dependencies | Repository-owned OSV.dev scanner plus Dependabot | Fail-closed vulnerability detection and update proposals |
| Secrets | Pinned OSS scanner executed by GitHub Actions | Repository-owned replacement for paid PR secret checks |
| PR findings | SARIF artifacts from pinned OSS scanners | Third-party review evidence without granting a hosted reviewer authority |
| Deployment | Reproducible website build and documented manual deployment | Free fallback when private organization Git binding is unavailable |

## Retired or optional services (2026-08-03)

- **CircleCI disabled:** GitHub Actions is the active orchestrator and
  repository-owned self-hosted runners provide execution while hosted billing is blocked.
  `.circleci/config.yml` must not return without a governed requirement change.
- **Codecov publishing restored:** GitHub Actions uploads LCOV through Codecov CLI
  after repository-owned coverage passes. Codecov is not the threshold authority.
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

## Third-party PR review implementation

The required `third-party-review` check runs Gitleaks `8.30.1` and Semgrep
`1.172.0`. Release archives are checksum-verified, Semgrep is installed into a
pinned job-local virtualenv, and the policy lives in `.semgrep.yml`. GitHub Actions retains SARIF
artifacts; scanner exit states are enforced so publishing evidence cannot mask a
failed scan.

## Fail-closed rules

1. GitHub Actions jobs use pinned tools, frozen dependencies, and fail-closed evidence.
2. Secrets are never printed, copied from legacy stores, or committed.
3. The canonical branch gate, coverage, website, security, governance, and
   conversation-resolution checks must terminate successfully.
4. No `--no-verify`, admin merge, force merge, fake status, or temporary
   relaxation is valid evidence.
5. Branch protection lists only deterministic checks emitted by tracked GitHub Actions
   jobs. Optional providers never block a PR by being absent.

## Repository-owned validation

```bash
bun run ci:gate:branch
bun run integrations:check
```

The same non-coverage commands run locally and in GitHub Actions. The heavy coverage
producer and threshold gate run in the GitHub Actions `coverage` job for release
promotions to `main`, `main` pushes, and scheduled full runs, then upload LCOV
to Codecov for visibility.

## Rollback and provider changes

Provider links can be removed independently. A replacement becomes required
only through a governed requirement and a successful PR to `dev`; external
green badges or dashboards never override repository evidence.
