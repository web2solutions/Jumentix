# NPM and Vercel Integration

## NPM Organization

Target organization for package publishing:

- `jumentix`

Configured in root `.npmrc`:

- `@jumentix:registry=https://registry.npmjs.org/`
- `always-auth=true`
- `provenance=true`

Validation commands:

```bash
bun run npm:whoami
bun run npm:org:check:jumentix
bun run npm:packages:check
```

Note:

- These commands do not publish.
- The artifact gate validates the approved `@jumentix/*` release cohort in an external consumer.

### Automated publish on `main`

1. `app-release.yml` runs on every push to `main` and calls `npm-publish.yml`.
2. `npm-publish.yml` publishes every public package whose `package.json` version is not yet on npm.
3. When package content (docs, media, README, dist inputs, …) changes on `main` without a
   version bump, `package-content-bump.yml` opens a signed patch-bump PR so the next publish
   ships the new surface (JUM-917).

Do not publish from a laptop. Bump the package version in the delivery PR when you change
published surface, or rely on the automated patch-bump follow-up.

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

### Automated production deploy on `main`

Vercel Git Integration deploys the `jumentix-website` project for pushes to `main`.
`website-deploy-verify.yml` waits for the Vercel commit status and fails closed if deploy
does not succeed (JUM-917 / Req 070). Manual `website:publish` is recovery-only.

## Important Runtime Note

Deployment commands are now scope-agnostic by default (no forced `--scope` flag), because
Vercel rejects explicit personal-account scopes in some CLI contexts. This keeps deployment
reliable for both personal and team account setups.
