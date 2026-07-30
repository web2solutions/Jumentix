# Canonical Application Integration Migration Requirement

Linear task: [JUM-568](https://linear.app/jumentix/issue/JUM-568)

## Requirement

`XpertMinds/Jumentix` must recreate every integration that is applicable to the
deprecated `web2solutions/aaa-typescript-boilerplate` source before the source
is archived. An integration is complete only when its provider-side binding and
repository-owned configuration are both verified. Missing, skipped, neutral, or
merely configured checks are not successful evidence.

## Audited source-to-canonical matrix

| Integration surface | Deprecated source | Canonical destination | Status / evidence |
| --- | --- | --- | --- |
| GitHub Actions: Run branch-aware tests | active | active | `build (22.x, 7.2)` succeeds on `dev` PRs |
| GitHub Actions: SonarQube Cloud | active | active | workflow registered; scan step requires `SONAR_TOKEN` |
| GitHub Actions: Jumentix website quality | active | active | `storybook` succeeds on website PRs |
| Actions repository secrets | `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD` | same names with CI placeholders | secret-name inventory parity; values never logged |
| Actions repository variables | none | none | empty inventory |
| Environments | `env vars`, `secrets` (empty) | `env vars`, `secrets` (empty) | name inventory parity |
| Dependabot Updates | active (GitHub-managed) | enabled via `.github/dependabot.yml` | Dependabot PR path available |
| Repository webhooks | 2 active (provider callbacks) | provider-owned GitHub App/webhook bindings recreated | CircleCI, Codecov, Snyk, GitGuardian, Cursor, Sonar, and Vercel apps authorized; PR-only checks remain pending |
| CircleCI project | bound to legacy slug | project `95b034cf-dd83-4407-be64-108d63263ed8` follows `XpertMinds/Jumentix` | pipelines 2, 3, and 4 passed `test-source` on canonical SHA `19af3a52` |
| Codecov | `codecov/project`, `codecov/patch` on legacy PRs | GitHub App authorized, repository active, rotated token stored in GitHub and CircleCI | authenticated CircleCI pipeline passed; project/patch PR checks pending |
| SonarQube Cloud project key | `web2solutions_aaa-typescript-boilerplate` | `xpertminds` / `XpertMinds_Jumentix` | baseline and PR #9 quality gates passed with zero new issues or hotspots |
| Snyk | badge + GH checks on legacy | XpertMinds org/settings/policies, all-repository GitHub App, canonical package projects, and new 90-day token | PR #9 `security/snyk` passed with zero issues |
| GitGuardian | Security Checks on legacy PRs | all five XpertMinds repositories monitored; history scan completed; blocking checks enabled | terminal PR check still pending |
| Cursor Bugbot | checks on legacy PRs | 5/5 XpertMinds repositories enabled, including both Jumentix repositories | PR #9 `Cursor Bugbot` passed |
| Vercel (website) | legacy project binding | Vercel GitHub App authorized for all XpertMinds repositories | **paid-plan blocker**: Hobby rejects binding a private organization repository; explicit Pro approval required |
| Branch protection / required checks | enforced on legacy (Pro) | unavailable on current private plan | **owner-auth blocker**: GitHub Pro/Team for private branch protection |

Registry-only integration migration is governed separately by JUM-569.

## Repository-owned configuration that must stay canonical

- `package.json` `homepage` / `bugs.url` → `XpertMinds/Jumentix`
- `packages/cli-init` bootstrap clone URL → `XpertMinds/Jumentix.git`
- `.agents/registry-source.json` → `XpertMinds/jumentix-agent-registry`
- README / docs canonical notices → Requirement `103` / `104`
- CircleCI / Codecov / Snyk badge slugs → `XpertMinds/Jumentix`

## Enforcement

- `pnpm run integration-migration:check` validates this contract.
- `pnpm run ci:gate:strict` includes the integration-migration cell.
- Review-count bypass is allowed because review is optional. No CI, governance,
  hook, coverage, or security gate may be bypassed.
- The deprecated application origin is archived only after this requirement and
  the final legacy freeze PR are merged.

## Verification record

- Audit date: `2026-07-30`
- Deprecated source: `web2solutions/aaa-typescript-boilerplate`
- Canonical destination: `XpertMinds/Jumentix`
- Destination visibility: private
- Actions secrets recreated (names only): `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD`
- Environments recreated (names): `env vars`, `secrets`
- Provider authentication is complete; Vercel Git binding and GitHub private
  branch protection require paid plans, while terminal PR checks remain
  mandatory and are recorded above
