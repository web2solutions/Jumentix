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
| Repository webhooks | 2 active (provider callbacks) | none yet | **owner-auth blocker**: recreate Codecov/CircleCI/GitGuardian callbacks |
| CircleCI project | bound to legacy slug | badge targets `XpertMinds/Jumentix` | **owner-auth blocker**: follow/bind CircleCI project |
| Codecov | `codecov/project`, `codecov/patch` on legacy PRs | `codecov.yml` present | **owner-auth blocker**: install Codecov GitHub App on org/repo |
| SonarQube Cloud project key | `web2solutions_aaa-typescript-boilerplate` | transitional legacy key | **owner-auth blocker**: create SonarCloud project for `XpertMinds/Jumentix` and rotate keys/token |
| Snyk | badge + GH checks on legacy | badge targets canonical | **owner-auth blocker**: install/bind Snyk on `XpertMinds/Jumentix` |
| GitGuardian | Security Checks on legacy PRs | not observed on canonical PRs | **owner-auth blocker**: install GitGuardian App |
| Cursor Bugbot | checks on legacy PRs | not observed on canonical PRs | **owner-auth blocker**: enable Bugbot for private `XpertMinds/Jumentix` |
| Vercel (website) | legacy project binding | docs already describe XpertMinds npm path | **owner-auth blocker**: rebind Vercel project/git integration |
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

- Audit date: `2026-07-29`
- Deprecated source: `web2solutions/aaa-typescript-boilerplate`
- Canonical destination: `XpertMinds/Jumentix`
- Destination visibility: private
- Actions secrets recreated (names only): `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD`
- Environments recreated (names): `env vars`, `secrets`
- Remaining provider installs require owner authorization and are recorded above
  as explicit blockers
