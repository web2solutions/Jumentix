# Canonical integrations and provider rebinding

`web2solutions/Jumentix` is the public canonical repository. Requirement 113
keeps CI and quality evidence fail-closed while using free open-source
provider plans.

## Canonical contract

| Concern | Required contract | Role |
| --- | --- | --- |
| CI | CircleCI canonical pipeline tracked in this repository (`.circleci/config.yml`) | Canonical orchestrator for PRs to `dev`, promotions to `main`, and both protected branches; nightly scheduled trigger on `main`/`dev` |
| Fallback CI | GitHub Actions retained for the public repository, disabled by default behind the `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI` repository variable | Same context classifier and job names when the flag is `true`; always-on exceptions: `pr-feedback.yml`, the `sync-changelog`/`pr-feedback` jobs in `ci.yml`, and `npm-publish.yml` |
| Coverage | repository-owned coverage job, JSON/LCOV artifacts, project and patch thresholds | Canonical coverage authority; Codecov publishing is the public dashboard |
| Codecov publishing | CircleCI uses the checksum-verified Codecov CLI on `main` and `dev` pushes (plus release/scheduled contexts); when the fallback flag is enabled, GitHub Actions uses `codecov/codecov-action@v5` on the same surfaces, both with `CODECOV_TOKEN` | Live coverage badges + Grid graph after LCOV upload |
| Quality | Branch-aware Bun quality gate and Storybook build/smoke/prepublish | Required product and governance validation |
| SAST/quality | SonarQube Cloud project `web2solutions_Jumentix` | Public quality, reliability, security and coverage dashboard |
| Dependencies | Repository-owned OSV.dev scanner plus Dependabot | Fail-closed vulnerability detection and update proposals |
| Secrets | Pinned OSS scanner executed by CI | Repository-owned secret review without paid private checks |
| PR findings | SARIF artifacts from pinned OSS scanners | Third-party review evidence without giving a hosted reviewer sole authority |
| Deployment | Reproducible website build and documented deployment | Build validation remains required before release |

## Active services

- **CircleCI canonical:** `.circleci/config.yml` runs the full matrix —
  `branch-gate`, `third-party-review`, `browser-matrix`, `workspace-builds`,
  `workspace-tests`, `integration`, `coverage` (Codecov upload, SonarQube
  Cloud scan, and `bun run sonar:check-reliability`), `website`, and
  `database-matrix` — with a nightly scheduled trigger on `main`/`dev`. Jobs
  that are not required for the current destination halt successfully before
  starting heavy work.
- **GitHub Actions retained:** `.github/workflows/ci.yml` (matrix jobs),
  `browser-matrix.yml`, and `sonar-reliability.yml` are gated behind
  `if: vars.JUMENTIX_ENABLE_GITHUB_ACTIONS_CI == 'true'` and run as the
  equivalent fallback when the flag is enabled. The `pr-feedback.yml` workflow,
  the `sync-changelog`/`pr-feedback` jobs in `ci.yml`, and `npm-publish.yml`
  stay always-on because they have no CircleCI equivalent.
- **Codecov publishing:** the full coverage job uploads LCOV after local
  project and patch thresholds pass. Codecov is the coverage dashboard, not the
  threshold authority.
- **SonarQube Cloud:** the scanner runs after full coverage on release/main
  contexts and reads the same LCOV paths declared in
  `sonar-project.properties`.
- **GitGuardian/Cursor Bugbot/Vercel:** these remain optional external
  visibility or deployment surfaces. Required evidence stays in repository
  workflows.

## Fail-closed rules

1. CI jobs use pinned tools, frozen dependencies, and auditable evidence.
2. Secrets are never printed, copied from legacy stores, or committed.
3. Branch gate, coverage, website, security, governance, and
   conversation-resolution checks must terminate successfully when selected.
4. No `--no-verify`, admin merge, force merge, fake status, or temporary
   relaxation is valid evidence.
5. Branch protection lists only deterministic checks emitted by tracked
   workflows. Optional providers never block a PR by being absent.

## Repository-owned validation

```bash
bun run ci:gate:branch
bun run integrations:check
```

The same non-coverage commands run locally and in CI. The heavy coverage
producer and threshold gate run for release promotions to `main`, `main`
pushes, and scheduled full runs, then upload LCOV to Codecov and SonarQube
Cloud for visibility.

## Rollback and provider changes

Provider links can be removed independently. A replacement becomes required
only through a governed requirement and a successful PR to `dev`; external
green badges or dashboards never override repository evidence.
