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
- `installCommand`: `pnpm install`
- `buildCommand`: `pnpm run build`
- `devCommand`: `pnpm run dev`
- `outputDirectory`: `.next`

## Notes

- Website content is static-first and generated from markdown sources using `content:sync`.
- `prebuild` runs content synchronization automatically before build.
