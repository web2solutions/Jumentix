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

Target Vercel user/scope:

- `web2solutions`

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

These commands are configured for scope `web2solutions` and do not require immediate publish/deploy.
