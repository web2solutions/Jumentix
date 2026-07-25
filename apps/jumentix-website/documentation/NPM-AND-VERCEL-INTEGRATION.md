# NPM and Vercel Integration

## NPM Organization

Target organization for package publishing:

- `xpertminds`

Configured in root `.npmrc`:

- `@xpertminds:registry=https://registry.npmjs.org/`
- `always-auth=true`
- `provenance=true`

Validation commands:

```bash
pnpm run npm:whoami
pnpm run npm:org:check:xpertminds
pnpm run npm:publish:dry-run:packages
```

Note:

- Publishing is **not** executed by these commands.
- Dry-run warns for packages that are not yet in `@xpertminds/*` scope.

## Vercel Integration

Target Vercel account:

- `web2solutions` (personal account)

Root commands:

```bash
pnpm run website:vercel:link
pnpm run website:vercel:pull:preview
pnpm run website:vercel:pull:prod
pnpm run website:deploy:vercel:preview
pnpm run website:deploy:vercel
```

App commands (`apps/jumentix-website`):

```bash
pnpm run vercel:link
pnpm run vercel:pull:preview
pnpm run vercel:pull:prod
pnpm run deploy:vercel:preview
pnpm run deploy:vercel
```

These commands are configured to work without forced scope flags and do not require immediate publish/deploy.

## Important Runtime Note

Deployment commands are now scope-agnostic by default (no forced `--scope` flag), because
Vercel rejects explicit personal-account scopes in some CLI contexts. This keeps deployment
reliable for both personal and team account setups.
