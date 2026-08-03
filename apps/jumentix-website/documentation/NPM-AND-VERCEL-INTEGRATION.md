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
bun run npm:whoami
bun run npm:org:check:xpertminds
bun run npm:publish:dry-run:packages
```

Note:

- Publishing is **not** executed by these commands.
- Dry-run warns for packages that are not yet in `@xpertminds/*` scope.

## Vercel Integration

Target Vercel account:

- `web2solutions` (personal account)

Root commands:

```bash
bun run website:vercel:link
bun run website:vercel:pull:preview
bun run website:vercel:pull:prod
bun run website:deploy:vercel:preview
bun run website:deploy:vercel
```

App commands (`apps/jumentix-website`):

```bash
bun run vercel:link
bun run vercel:pull:preview
bun run vercel:pull:prod
bun run deploy:vercel:preview
bun run deploy:vercel
```

These commands are configured to work without forced scope flags and do not require immediate publish/deploy.

## Important Runtime Note

Deployment commands are now scope-agnostic by default (no forced `--scope` flag), because
Vercel rejects explicit personal-account scopes in some CLI contexts. This keeps deployment
reliable for both personal and team account setups.
