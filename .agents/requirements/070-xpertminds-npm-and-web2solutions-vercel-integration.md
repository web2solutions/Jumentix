# Requirement 070 - xpertminds NPM and web2solutions Vercel Integration

## Context
- Jumentix packages will be published under npm organization `xpertminds`.
- Jumentix website deployment target is Vercel under scope/user `web2solutions`.
- Setup must be prepared without immediate publish/deploy actions.

## Mandatory Rules
1. Root npm configuration must include registry and auth-ready settings for `@xpertminds`.
2. Project must provide commands for:
   - npm identity/org validation
   - npm publish dry-run
3. Website deployment scripts must include Vercel scope `web2solutions`.
4. Website integration docs must describe login/link/pull/deploy commands.
5. Setup must not auto-publish packages or auto-deploy website.

## Acceptance Criteria
- `package.json` exposes npm and vercel integration commands.
- `apps/jumentix-website` exposes scoped vercel commands.
- Documentation exists for both integrations.
