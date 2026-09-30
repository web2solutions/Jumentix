# Requirement 070 - Jumentix NPM and web2solutions Vercel Integration

## Context
- Jumentix public packages are published under npm organization `jumentix`.
- Jumentix website deployment target is Vercel under scope/user `web2solutions`.
- Setup must be prepared without immediate publish/deploy actions.

## Mandatory Rules
1. Root npm configuration must include registry and auth-ready settings for `@jumentix`.
2. Project must provide commands for:
   - npm identity/org validation
   - package tarball and external-consumer validation
3. Website deployment scripts must include Vercel scope `web2solutions`.
4. Website integration docs must describe login/link/pull/deploy commands.
5. Setup must not auto-deploy the website. npm publication is automated (owner decision
   2026-09-26, JUM-894): after every application release on `main`, `app-release.yml` calls
   `npm-publish.yml`, which publishes every public package whose `package.json` version is not
   yet on npm, from a `bun pm pack` tarball (never a directory publish, which would ship
   `workspace:*` ranges). Already-tagged or already-published versions are skipped, so the call
   is idempotent. `workflow_dispatch` remains for a manual cohort re-run. A package is released by
   bumping its version and promoting to `main`; nothing is published from a local machine.

## Acceptance Criteria
- `package.json` exposes npm and vercel integration commands.
- `apps/jumentix-website` exposes scoped vercel commands.
- Documentation exists for both integrations.
