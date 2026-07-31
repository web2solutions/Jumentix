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
| Repository webhooks | provider callbacks | required provider-owned GitHub App/webhook bindings recreated | CircleCI, Codecov, GitGuardian, Cursor, Sonar, and Vercel apps authorized; PR-only checks remain pending |
| CircleCI project | bound to legacy slug | project `95b034cf-dd83-4407-be64-108d63263ed8` follows `XpertMinds/Jumentix` | pipelines 2, 3, and 4 passed `test-source` on canonical SHA `19af3a52` |
| Codecov | `codecov/project`, `codecov/patch` on legacy PRs | GitHub App authorized, repository active, rotated token stored in GitHub and CircleCI; canonical slug and fail-on-error supplied to the orb | pipeline 4 exposed hidden `Repository not found`; corrected fail-closed `dev` upload and project/patch checks pending |
| SonarQube Cloud project key | `web2solutions_aaa-typescript-boilerplate` | `xpertminds` / `XpertMinds_Jumentix` | baseline and PR #9 quality gates passed with zero new issues or hotspots |
| OSV dependency scanner | incomplete legacy dependency coverage | first-party installed-tree scanner backed by OSV.dev | `bun run deps:audit` is part of the fail-closed gate |
| GitGuardian | Security Checks on legacy PRs | all five XpertMinds repositories monitored; canonical history scan completed; same-repo PR checks available on the public destination | **paid-plan blocker**: GitGuardian Business remains required for forked-repository check runs only |
| Cursor Bugbot | checks on legacy PRs | 5/5 XpertMinds repositories enabled, including both Jumentix repositories | PR #9 `Cursor Bugbot` passed |
| Vercel (website) | legacy project binding | Vercel GitHub App authorized for all XpertMinds repositories | **owner-auth blocker**: Git binding pending re-auth on the public repository, then a Git-connected deploy must reach `READY` (Hobby may work now that the destination is public) |
| Branch protection / required checks | enforced on legacy (Pro) | Team plan + public repository; protection configured on `dev` and `main` requiring `build (1.3.14, 7.2)`, `SonarQube Cloud Scan`, and `storybook` with `enforce_admins` | done — required checks observed on destination; not a remaining owner-auth blocker |
| GitHub Actions billing | billed minutes on legacy | public repository Actions path | **owner-auth blocker**: Actions billing/plan must allow required workflow minutes; unpaid or exhausted billing fails closed |

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
- Destination visibility: public
- Actions secrets recreated (names only): `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD`
- Environments recreated (names): `env vars`, `secrets`
- Provider authentication is largely complete on the public destination. Branch
  protection/required checks are configured on `dev` and `main`. Remaining true
  blockers (fail closed until terminal evidence exists): GitHub Actions
  billing/minutes authority, Vercel Git re-auth plus `READY` Git deploy, Codecov
  project/patch PR status where still unpaid, and GitGuardian Business only for
  fork check runs. Missing, skipped, neutral, or merely configured checks are
  not success.
- Visibilidade: public
