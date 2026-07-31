# Canonical Integrations and Provider Rebinding

`XpertMinds/Jumentix` is the public canonical application repository. Provider
migration means creating a new provider-side binding to this repository and
observing a terminal check or deployment. A copied legacy webhook, a skipped
scan, or a legacy project key is not passing evidence.

## Source-to-canonical inventory

| Integration | Legacy evidence | Canonical contract | Completion evidence |
| --- | --- | --- | --- |
| GitHub Actions | test, website, and Sonar workflows | Same tracked workflows on `XpertMinds/Jumentix` | Required workflow runs terminate successfully |
| CircleCI | `test-source` pipeline and GitHub webhook | Canonical project plus webhook; only `dev` and `main` | `ci/circleci: test-source` succeeds on canonical SHA |
| Codecov | CircleCI orb and project/patch checks | Canonical Codecov repository with 95% project/patch targets | `codecov/project` and `codecov/patch` succeed |
| SonarQube Cloud | legacy `web2solutions_aaa-typescript-boilerplate` project | `xpertminds` / `XpertMinds_Jumentix`; required token; no skipped scan | `SonarQube Cloud Scan` runs the scanner and succeeds |
| OSV dependency scanner | no complete Bun lockfile coverage | First-party scanner resolves the installed Bun dependency tree and queries OSV.dev | `bun run deps:audit` succeeds in the canonical gate |
| GitGuardian | GitHub App check | GitGuardian installation authorized for the canonical public repository; same-repo PR checks available | `GitGuardian Security Checks` succeeds on same-repo PRs |
| Cursor Bugbot | GitHub App check | Cursor installation authorized for the canonical public repository | `Cursor Bugbot` terminates successfully |
| Vercel | `jumentix-website` project and production deployment | Git connection changed to `XpertMinds/Jumentix`, root `apps/jumentix-website` | Canonical Git deployment reaches `READY` |
| Dependabot | GitHub-native update workflow | `.github/dependabot.yml` targets `dev` for npm and GitHub Actions | Dependabot configuration is accepted and updates can run |
| GitHub secrets | `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD` | Same names, values recreated securely | Secret-name inventory exists; workflows consume them |
| Environments | `env vars`, `secrets` | Same environments; provider credentials created securely | Environment inventory and provider checks agree |
| Variables | No repository or environment variables | No variables unless a provider requires a non-secret identifier | Inventory remains explicit |
| Webhooks | CircleCI and legacy provider callbacks | Only required provider-owned hooks for the canonical repository | Hook targets and provider checks are canonical |

## Migration status (2026-07-30)

| Area | Verified state | Remaining action |
| --- | --- | --- |
| GitHub repository/branch settings | Actions use read-only default permissions; workflow PR approvals are disabled; merge policy, issues, discussions, labels, topics, environments, and CircleCI hook events match the legacy application repository; destination visibility is public on Team; branch protection on `dev` and `main` requires `build (1.3.14, 7.2)`, `SonarQube Cloud Scan`, and `storybook` with `enforce_admins` | Actions billing/minutes authority remains an owner-auth blocker if unpaid or exhausted |
| GitHub security | Vulnerability alerts, automated security fixes, and the tracked Dependabot configuration are enabled | Observe the first canonical Dependabot update |
| CircleCI | `XpertMinds/Jumentix` is followed, uncertified public orbs are allowed for the copied Codecov contract, and the fail-closed rerun of pipeline 6 passed `test-source` on canonical SHA `68d785a4` | Continue enforcing the canonical pipeline on `dev` and `main` |
| Repository secrets | `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD`, and the dedicated `AGENT_REGISTRY_TOKEN` exist by name | Validate their consumers without exposing their values; rotate the registry credential under the owner policy |
| GitHub environments | `env vars` and `secrets` exist; dependency scanning requires no provider token | Validate environment consumers on canonical task PRs |
| SonarQube Cloud | Organization `xpertminds`, project `XpertMinds_Jumentix`, GitHub App authorization, and `SONAR_TOKEN` are active; the baseline and PR #10 quality gates passed with zero new issues or hotspots | Continue enforcing the fail-closed scan on canonical PRs |
| OSV dependency scanner | The first-party scanner resolves the installed Bun dependency graph and queries OSV.dev in fail-closed mode | Continue enforcing `bun run deps:audit` in the canonical gate |
| Codecov | The GitHub App is authorized for all XpertMinds repositories; the repository token was regenerated and synchronized in GitHub and CircleCI; pipeline 6 passed the fail-closed upload; and Codecov recorded commit `68d785a4` as `CI Passed` with 99.24% project coverage | `codecov/project` and `codecov/patch` did not appear on PR #10; project/patch PR status remains incomplete until terminal evidence exists (Codecov Team may still be required depending on product limits) |
| GitGuardian | The GitHub App is authorized for all five XpertMinds repositories; `Jumentix` is monitored; automatic history scanning completed; same-repo PR checks are available on the public repository | Forked-repository check runs still require GitGuardian Business; do not treat fork coverage as complete without Business |
| Cursor Bugbot | XpertMinds shows 5/5 repositories enabled, including both Jumentix repositories, with Bugbot triggered on every push; PR #10 `Cursor Bugbot` passed | Continue enforcing the terminal Cursor Bugbot check |
| Vercel | The GitHub App is authorized for all XpertMinds repositories; project `jumentix-website` exists and its latest manual production deployment is `READY` | Git binding pending re-auth on the public repository; Hobby may work now—complete re-auth and record a Git-connected deploy that reaches `READY` |
| GitHub Actions billing | Public repository Actions workflows are registered | Owner must keep Actions billing/minutes funded; unpaid or exhausted billing fails closed and is not successful evidence |

Terminal provider evidence is attached to Linear JUM-568. Branch
protection/required checks are configured on `dev` and `main`. Remaining true
blockers on the public destination fail closed until terminal evidence exists:
GitHub Actions billing/minutes authority, Vercel Git re-auth plus `READY`
Git-connected deploy, Codecov project/patch PR status where still incomplete,
and GitGuardian Business only for fork check runs. This status must not be read
as final provider migration approval.

## Fail-closed rules

1. Secret values are never copied out of the legacy repository.
2. `SONAR_TOKEN`, Codecov credentials, Vercel credentials, and
   provider OAuth grants are recreated through their provider.
3. A missing token, missing app authorization, absent check, skipped scan,
   cancelled run, timeout, or provider-side legacy binding is incomplete.
4. Review approval is optional. Every non-review CI, coverage, security,
   governance, and conversation-resolution gate remains mandatory.
5. External-provider blockers are recorded in Linear JUM-568 and its Project
   Updates with the exact owner action required.

## Repository-owned validation

Run:

```bash
bun run integrations:check
```

The check validates canonical Sonar identifiers, fail-closed scanner execution,
the authenticated private agent-registry binding (registry repo remains private), CircleCI/Codecov contracts,
OSV.dev scanner presence, Dependabot configuration, and this bilingual inventory.
It is a required strict-matrix cell.

## Provider authorization sequence

1. Authorize each provider's GitHub App/OAuth integration for the public
   `XpertMinds/Jumentix` repository.
2. Create or import the canonical provider project; never reuse a legacy project
   key that points to `web2solutions/aaa-typescript-boilerplate`.
3. Recreate credentials into GitHub/provider secret stores without printing
   them.
4. Trigger a PR or provider validation.
5. Record the terminal check/deployment URL in Linear JUM-568.

## Rollback

Provider links can be removed independently while the tracked configuration is
reverted through a governed PR to `dev`. The deprecated repository remains
archived and is not a rollback delivery target.
