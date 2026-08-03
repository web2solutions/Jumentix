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
| Actions repository secrets | `JUMENTIX_JWT_TOKEN_SECRET_KEY`, `JUMENTIX_REDIS_PASSWORD` | same names with CI placeholders | secret-name inventory parity; values never logged |
| Actions repository variables | none | none | empty inventory |
| Environments | `env vars`, `secrets` (empty) | `env vars`, `secrets` (empty) | name inventory parity |
| Dependabot Updates | active (GitHub-managed) | enabled via `.github/dependabot.yml` | Dependabot PR path available |
| Repository webhooks | provider callbacks | required provider-owned GitHub App/webhook bindings recreated | CircleCI, Codecov, GitGuardian, Cursor, Sonar, and Vercel apps authorized; PR-only checks remain pending |
| CircleCI project | bound to legacy slug | project `95b034cf-dd83-4407-be64-108d63263ed8` follows `XpertMinds/Jumentix` | pipelines 2, 3, and 4 passed `test-source` on canonical SHA `19af3a52` |
| Codecov | `codecov/project`, `codecov/patch` on legacy PRs | GitHub App authorized, repository active, rotated token stored in GitHub and CircleCI; canonical slug and fail-on-error supplied to the orb | pipeline 4 exposed hidden `Repository not found`; corrected fail-closed `dev` upload and project/patch checks pending |
| SonarQube Cloud project key | `web2solutions_aaa-typescript-boilerplate` | `xpertminds` / `Jumentix` | baseline and PR #9 quality gates passed with zero new issues or hotspots |
| OSV dependency scanner | incomplete legacy dependency coverage | first-party installed-tree scanner backed by OSV.dev | `bun run deps:audit` is part of the fail-closed gate |
| GitGuardian | Security Checks on legacy PRs | all five XpertMinds repositories monitored; canonical history scan completed | **paid-plan blocker**: forked-repository check runs require GitGuardian Business |
| Cursor Bugbot | checks on legacy PRs | 5/5 XpertMinds repositories enabled, including both Jumentix repositories | PR #9 `Cursor Bugbot` passed |
| Vercel (website) | legacy project binding | Vercel GitHub App authorized for all XpertMinds repositories | **paid-plan blocker**: Hobby rejects binding a private organization repository; explicit Pro approval required |
| Branch protection / required checks | enforced on legacy (Pro) | unavailable on current private plan | **owner-auth blocker**: GitHub Pro/Team for private branch protection |

Registry-only integration migration is governed separately by JUM-569.

## Repository-owned configuration that must stay canonical

- `package.json` `homepage` / `bugs.url` → `XpertMinds/Jumentix`
- `packages/cli-init` bootstrap clone URL → `XpertMinds/Jumentix.git`
- `.agents/registry-source.json` → `XpertMinds/jumentix-agent-registry`
- README / docs canonical notices → Requirement `103` / `104`
- CircleCI / Codecov badge slugs → `XpertMinds/Jumentix`

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
- Canonical destination: `XpertMinds/Jumentix`
- Destination visibility: private
- Actions secrets recreated (names only): `JUMENTIX_JWT_TOKEN_SECRET_KEY`, `JUMENTIX_REDIS_PASSWORD`
- Environments recreated (names): `env vars`, `secrets`
- Provider authentication is complete; Vercel Git binding, GitHub private
  branch protection, and GitGuardian fork check runs require paid plans, while
  terminal PR checks remain mandatory and are recorded above
