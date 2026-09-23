# Canonical Application Integration Requirement

Linear task: [JUM-568](https://linear.app/jumentix/issue/JUM-568)

## Requirement

`web2solutions/Jumentix` owns every applicable provider binding. A required
integration is complete only when its repository configuration and provider-side
binding both produce terminal evidence. Missing, skipped, neutral, or merely
configured checks are not successful evidence.

## Current provider contract

| Surface | Canonical contract |
| --- | --- |
| GitHub Actions | Retained branch-aware CI on GitHub-hosted Node 22 runners with Bun commands, disabled by default behind `vars.JUMENTIX_ENABLE_GITHUB_ACTIONS_CI` (Req 113, 2026-09-23); `pr-feedback`, `sync-changelog`, and `npm-publish` stay always-on. |
| CircleCI | Canonical public CI orchestrator using the same context classifier and gate policy (Req 113, 2026-09-23). |
| Codecov and SonarQube Cloud | Public visibility for repository-owned coverage evidence. |
| OSV.dev | First-party installed-tree audit through `bun run deps:audit`. |
| Dependabot, Vercel, webhooks, environments | Repository-owned settings bound to the public canonical repository where applicable. |

## Repository-owned configuration

- `package.json` homepage and issues URL target `web2solutions/Jumentix`.
- `packages/cli-init` clones `web2solutions/Jumentix.git`.
- CircleCI and Codecov use the `web2solutions/Jumentix` slug.
- Firestore is the agent coordination source of truth under Requirement `089`.

## Enforcement

- `bun run integration-migration:check` validates canonical repository markers.
- `bun run integrations:check` validates provider configuration and fail-closed behavior.
- Historical migration evidence is summarized in
  `documentation/md/HISTORICAL-TRANSITIONS.md` and is not operational policy.
