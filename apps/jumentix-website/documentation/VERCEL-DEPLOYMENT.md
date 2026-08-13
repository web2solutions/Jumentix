# Vercel Deployment

Issue tracking:

- Epic: [JUM-390](https://linear.app/jumentix/issue/JUM-390/epicwebsite-rebuild-the-jumentix-open-source-product-and-documentation)
- Release: [JUM-397](https://linear.app/jumentix/issue/JUM-397/release-deploy-and-verify-the-rebuilt-jumentix-website-on-vercel)

Production URL: `https://jumentix-website.vercel.app/`

## Deployment Commands

From repository root:

```bash
bun run website:deploy:vercel
```

Preview deployment:

```bash
bun run website:deploy:vercel:preview
```

From app workspace directly:

```bash
bun run --filter @jumentix/website deploy:vercel
```

Safe path (prepublish gate before production):

```bash
bun run --filter @jumentix/website deploy:vercel:safe
```

Auth:

```bash
bunx vercel login
bun run website:vercel:link
```

## Bun pin on Vercel

Vercel's default Bun image may lag the repo pin (`.bun-version` / `packageManager`).
`apps/jumentix-website/vercel.json` forces:

- `installCommand`: `bunx bun@1.3.13 install --frozen-lockfile`
- `buildCommand`: `bunx bun@1.3.13 run build`

## Configuration

File:

- `apps/jumentix-website/vercel.json`

Configured values:

- `framework`: `nextjs`
- `installCommand`: `bun install --frozen-lockfile`
- `buildCommand`: `bun run build`
- `devCommand`: `bun run dev`
- `outputDirectory`: `.next`

## Required Vercel environment

Because `XpertMinds/Jumentix` is private, unauthenticated GitHub API calls return 404.
Set these on the Vercel project (Production + Preview):

| Name | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | GitHub releases API (`/api/github-releases`). Not needed by `/changelog`, which bundles its data at build time via `scripts/sync-changelog.mjs`. |

Vercel Analytics is mounted in the root App Router layout via
`@vercel/analytics/react` (`<Analytics />`) and does not require a custom
environment variable.

## Post-deploy verification

Smoke at minimum:

- `/`, `/product`, `/use-cases`, `/roadmap`, `/community`, `/changelog`
- `/pt-BR`, `/pt-BR/product`
- `/docs/jumentix`, `/docs/jumentix/packages/cana`, `/docs/jumentix/concepts`
- `/docs/pt-BR/jumentix`
- `/sitemap.xml`, `/robots.txt`

Rollback: use the previous Production deployment in the Vercel project dashboard (Promote / Instant Rollback).

## Notes

- Website content is static-first and generated from markdown sources using `content:sync`.
- `prebuild` runs content synchronization automatically before build.
- Generated documentation remains available when a Vercel app-root build cannot access external
  monorepo source files.
- Vercel and local builds use the Bun workspace lockfile and patched dependency declarations.
- Root deployment scripts are intentionally scope-agnostic (no forced `--scope`) to support
  personal-account and team-account Vercel contexts.
