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
5. Setup must not auto-publish packages or auto-deploy website. Publication is a manual `main` workflow protected by the `npm-publish` environment.

## Acceptance Criteria
- `package.json` exposes npm and vercel integration commands.
- `apps/jumentix-website` exposes scoped vercel commands.
- Documentation exists for both integrations.
