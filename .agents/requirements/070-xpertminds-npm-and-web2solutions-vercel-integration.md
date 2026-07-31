# Requirement 070 - xpertminds NPM and web2solutions Vercel Integration

## Context
- Jumentix packages will be published under npm organization `xpertminds`.
- Vercel Git binding for the website must target `XpertMinds/Jumentix` (https://github.com/XpertMinds/Jumentix), with root directory `apps/jumentix-website` and Vercel project `jumentix-website`.
- The Vercel hosting account/team may remain `web2solutions` / `web2solutions-projects` until an XpertMinds Vercel team is created; Git must not point at archived `web2solutions/aaa-typescript-boilerplate`.
- Setup must be prepared without immediate publish/deploy actions.

## Mandatory Rules
1. Root npm configuration must include registry and auth-ready settings for `@xpertminds`.
2. Project must provide commands for:
   - npm identity/org validation
   - npm publish dry-run
3. Website Vercel project Git source must be bound to `XpertMinds/Jumentix` (not archived boilerplate repos); hosting scope/account may stay `web2solutions` until migrated.
4. Website integration docs must describe Git binding, project/root paths, and login/link/pull/deploy commands.
5. Setup must not auto-publish packages or auto-deploy website.

## Acceptance Criteria
- `package.json` exposes npm and vercel integration commands.
- `apps/jumentix-website` exposes scoped vercel commands.
- Documentation exists for both integrations and states the required `XpertMinds/Jumentix` Git binding.
