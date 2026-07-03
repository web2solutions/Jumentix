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
npm run npm:whoami
npm run npm:org:check:xpertminds
npm run npm:publish:dry-run:packages
```

Note:

- Publishing is **not** executed by these commands.
- Dry-run warns for packages that are not yet in `@xpertminds/*` scope.

## Vercel Integration

Target Vercel user/scope:

- `web2solutions`

Root commands:

```bash
npm run website:vercel:link
npm run website:vercel:pull:preview
npm run website:vercel:pull:prod
npm run website:deploy:vercel:preview
npm run website:deploy:vercel
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
