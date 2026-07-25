# Vercel Deployment

Issue tracking:

- Epic: [#124](https://github.com/web2solutions/aaa-typescript-boilerplate/issues/124)
- Task: [#130](https://github.com/web2solutions/aaa-typescript-boilerplate/issues/130)

## Deployment Commands

From repository root:

```bash
pnpm run website:deploy:vercel
```

Preview deployment:

```bash
pnpm run website:deploy:vercel:preview
```

From app workspace directly:

```bash
pnpm --filter @jumentix/website deploy:vercel
```

## Configuration

File:

- `apps/jumentix-website/vercel.json`

Configured values:

- `framework`: `nextjs`
- `installCommand`: `npm install --no-audit --no-fund`
- `buildCommand`: `npm run build`
- `devCommand`: `npm run dev`
- `outputDirectory`: `.next`

## Notes

- Website content is static-first and generated from markdown sources using `content:sync`.
- `prebuild` runs content synchronization automatically before build.
- Root deployment scripts are intentionally scope-agnostic (no forced `--scope`) to support
  personal-account and team-account Vercel contexts.
