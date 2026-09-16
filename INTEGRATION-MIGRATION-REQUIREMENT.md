# Canonical Application Integration Migration Requirement

Linear task: [JUM-568](https://linear.app/jumentix/issue/JUM-568)

## Requirement

`web2solutions/Jumentix` must recreate every integration that is applicable to the
deprecated `web2solutions/aaa-typescript-boilerplate` source before the source
is archived. An integration is complete only when its provider-side binding and
repository-owned configuration are both verified. Missing, skipped, neutral, or
merely configured checks are not successful evidence.

## Audited source-to-canonical matrix

| Integration surface | Deprecated source | Canonical destination | Status / evidence |
| --- | --- | --- | --- |
| GitHub Actions: Run branch-aware tests | active | active | `ci.yml` runs on GitHub-hosted Node 22 runners with branch-aware gates |
| GitHub Actions: SonarQube Cloud | active | active | workflow registered; scan step requires `SONAR_TOKEN` in full coverage contexts |
| GitHub Actions: Jumentix website quality | active | active | `storybook` succeeds on website PRs |
| Actions repository secrets | `JUMENTIX_JWT_TOKEN_SECRET_KEY`, `JUMENTIX_REDIS_PASSWORD` | `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD`, `CODECOV_TOKEN`, `SONAR_TOKEN`, `LINEAR_API_KEY`, `AGENT_REGISTRY_TOKEN` | secret-name inventory verified; values never logged |
| Actions repository variables | optional provider toggles | optional provider toggles | `JUMENTIX_ENABLE_SONAR` controls Sonar execution |
| Environments | `env vars`, `secrets` (empty) | `env vars`, `secrets` (empty) | name inventory parity |
| Dependabot Updates | active (GitHub-managed) | enabled via `.github/dependabot.yml` | Dependabot PR path available |
| Repository webhooks | provider callbacks | required provider-owned GitHub App/webhook bindings recreated | CircleCI, Codecov, GitGuardian, Cursor, Sonar, and Vercel apps authorized; PR-only checks remain pending |
| CircleCI project | bound to legacy slug | `web2solutions/Jumentix` | `.circleci/config.yml` restored with the same context classifier and public branch badges |
| Codecov | `codecov/project`, `codecov/patch` on legacy PRs | `web2solutions/Jumentix` | full coverage job uploads LCOV after repository thresholds pass |
| SonarQube Cloud project key | `web2solutions_aaa-typescript-boilerplate` | `web2solutions` / `web2solutions_Jumentix` | scanner and badges point at the public canonical project key |
| OSV dependency scanner | incomplete legacy dependency coverage | first-party installed-tree scanner backed by OSV.dev | `bun run deps:audit` is part of the fail-closed gate |
| GitGuardian | Security Checks on legacy PRs | optional external visibility | pinned Gitleaks/Semgrep own the required third-party review evidence |
| Cursor Bugbot | checks on legacy PRs | optional external visibility | not a required check because quota/skipped states are non-terminal |
| Vercel (website) | legacy project binding | optional deployment surface | website build and prepublish checks remain required before release |
| Branch protection / required checks | enforced on legacy (Pro) | GitHub public rulesets | `dev` has cheap destination checks; `main` has full destination checks |

Registry-only integration migration is governed separately by JUM-569.

## Repository-owned configuration that must stay canonical

- `package.json` `homepage` / `bugs.url` → `web2solutions/Jumentix`
- `packages/cli-init` bootstrap clone URL → `web2solutions/Jumentix.git`
- `.agents/registry-source.json` → `XpertMinds/jumentix-agent-registry`
- README / docs canonical notices → Requirement `103` / `104`
- CircleCI / Codecov badge slugs → `web2solutions/Jumentix`

## Enforcement

- `bun run integration-migration:check` validates this contract.
- `bun run ci:gate:strict` includes the integration-migration cell.
- Review-count bypass is allowed because review is optional. No CI, governance,
  hook, coverage, or security gate may be bypassed.
- The deprecated application origin is archived only after this requirement and
  the final legacy freeze PR are merged.

## Verification record

- Audit date: `2026-07-30`
- Deprecated source: `web2solutions/aaa-typescript-boilerplate`
- Canonical destination: `web2solutions/Jumentix`
- Destination visibility: public
- Actions secrets recreated (names only): `AAA_JWT_TOKEN_SECRET_KEY`,
  `AAA_REDIS_PASSWORD`, `AGENT_REGISTRY_TOKEN`, `CODECOV_TOKEN`,
  `LINEAR_API_KEY`, `SONAR_TOKEN`
- Provider authentication is complete for GitHub Actions, CircleCI, Codecov and
  SonarQube Cloud public execution. Optional external providers may add
  visibility, while terminal PR checks remain mandatory and are recorded above.
