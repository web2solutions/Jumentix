# Canonical Integrations and Provider Rebinding

`XpertMinds/Jumentix` is the private canonical application repository. Provider
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
| Snyk | legacy GitHub integration, webhook, and `SNYK_TOKEN` environment secret | New canonical Snyk project and webhook; securely recreated token | `security/snyk` succeeds on canonical PR |
| GitGuardian | GitHub App check | GitGuardian installation authorized for the canonical private repository | `GitGuardian Security Checks` succeeds |
| Cursor Bugbot | GitHub App check | Cursor installation authorized for the canonical private repository | `Cursor Bugbot` terminates successfully |
| Vercel | `jumentix-website` project and production deployment | Git connection changed to `XpertMinds/Jumentix`, root `apps/jumentix-website` | Canonical Git deployment reaches `READY` |
| Dependabot | GitHub-native update workflow | `.github/dependabot.yml` targets `dev` for npm and GitHub Actions | Dependabot configuration is accepted and updates can run |
| GitHub secrets | `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD` | Same names, values recreated securely | Secret-name inventory exists; workflows consume them |
| Environments | `env vars`, `secrets`; legacy `SNYK_TOKEN` in `secrets` | Same environments; new provider credentials created securely | Environment inventory and provider checks agree |
| Variables | No repository or environment variables | No variables unless a provider requires a non-secret identifier | Inventory remains explicit |
| Webhooks | CircleCI and Snyk | New provider-owned hooks for the canonical repository | Hook targets and provider checks are canonical |

## Migration status (2026-07-30)

| Area | Verified state | Remaining action |
| --- | --- | --- |
| GitHub repository/branch settings | Actions use read-only default permissions; workflow PR approvals are disabled; merge policy, issues, discussions, labels, topics, environments, and CircleCI hook events match the legacy application repository | Private-fork permission cannot be copied because the XpertMinds organization forbids private repository forking; branch protection/rulesets are unavailable on the current private-repository plan in both source and destination |
| GitHub security | Vulnerability alerts, automated security fixes, and the tracked Dependabot configuration are enabled | Observe the first canonical Dependabot update |
| CircleCI | `XpertMinds/Jumentix` is followed, uncertified public orbs are allowed for the copied Codecov contract, and pipelines 2, 3, and 4 passed `test-source` on canonical SHA `19af3a52` | Observe the provider check on the next canonical task PR |
| Repository secrets | `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD`, and the dedicated `AGENT_REGISTRY_TOKEN` exist by name | Validate their consumers without exposing their values; rotate the registry credential under the owner policy |
| GitHub environments | `env vars` and `secrets` exist; a newly issued 90-day `SNYK_TOKEN` is stored in `secrets` | Validate the environment consumer on the next canonical task PR |
| SonarQube Cloud | Organization `xpertminds`, project `XpertMinds_Jumentix`, GitHub App authorization, and `SONAR_TOKEN` are active; the baseline and PR #9 quality gates passed with zero new issues or hotspots | Continue enforcing the fail-closed scan on canonical PRs |
| Snyk | Organization `XpertMinds` copied legacy settings, integrations, and policies; its GitHub App is authorized for all repositories; the `XpertMinds/Jumentix` import created the package projects; a new 90-day token is stored in the `secrets` environment; and PR #9 `security/snyk` passed with zero issues | Continue enforcing the canonical Snyk PR check |
| Codecov | The GitHub App is authorized for all XpertMinds repositories, `XpertMinds/Jumentix` is active, and the rotated token is stored in GitHub and CircleCI; pipeline 4 exposed a hidden `Repository not found` response despite a green orb step, so PR #9 now supplies the canonical slug and makes upload errors fail the job | Produce a successful fail-closed upload on `dev`, then observe terminal `codecov/project` and `codecov/patch` checks |
| GitGuardian | The GitHub App is authorized for all five XpertMinds repositories; `Jumentix` is monitored; and automatic history scanning completed | PR check runs on forked repositories require GitGuardian Business; explicit paid-plan approval is required, and no trial or purchase was started |
| Cursor Bugbot | XpertMinds shows 5/5 repositories enabled, including both Jumentix repositories, with Bugbot triggered on every push; PR #9 `Cursor Bugbot` passed | Continue enforcing the terminal Cursor Bugbot check |
| Vercel | The GitHub App is authorized for all XpertMinds repositories; project `jumentix-website` exists and its latest manual production deployment is `READY` | Git binding to the private organization repository is rejected on Hobby; explicit approval for a paid Pro plan is required, and no trial or purchase was started |

PR-only provider checks remain incomplete until terminal evidence is attached
to Linear JUM-568. Vercel Git binding, GitHub private-repository branch
protection, and GitGuardian checks on canonical forks additionally remain
blocked on explicit paid-plan approval. This status must not be read as final
provider migration approval.

## Fail-closed rules

1. Secret values are never copied out of the legacy repository.
2. `SONAR_TOKEN`, `SNYK_TOKEN`, Codecov credentials, Vercel credentials, and
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
pnpm run integrations:check
```

The check validates canonical Sonar identifiers, fail-closed scanner execution,
the authenticated private agent-registry binding, CircleCI/Codecov contracts,
Snyk policy presence, Dependabot configuration, and this bilingual inventory.
It is a required strict-matrix cell.

## Provider authorization sequence

1. Authorize each provider's GitHub App/OAuth integration for the private
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
