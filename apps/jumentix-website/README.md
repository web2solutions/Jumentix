# Jumentix Website

Commercial website application for selling Jumentix as an enterprise software factory.

## Template Baseline

This app uses the architecture baseline from the Vercel template:

- [MantineUI + Nextra](https://vercel.com/templates/next.js/mantine-ui-nextra)
- Source template repository: `gfazioli/next-app-nextra-template`

## Purpose

- Present a conversion-oriented commercial narrative for enterprise buyers.
- Reuse markdown documentation as static content source.
- Publish statically on Vercel.
- Expose a public changelog page backed by GitHub commit history with pagination.

## Documentation Hub

- [Website Documentation Index](./documentation/README.md)

## Run

```bash
bun run --filter @jumentix/website dev
```

## Build

```bash
bun run --filter @jumentix/website build
```

## Planning Artifacts

- [Website IA and Conversion Plan](./documentation/WEBSITE-IA-AND-CONVERSION-PLAN.md)
- [Markdown Content Pipeline](./documentation/CONTENT-PIPELINE.md)
- [Changelog Page](./documentation/CHANGELOG-PAGE.md)
- [SEO and Performance Baseline](./documentation/SEO-AND-PERFORMANCE-BASELINE.md)
- [Vercel Deployment](./documentation/VERCEL-DEPLOYMENT.md)
- [NPM and Vercel Integration](./documentation/NPM-AND-VERCEL-INTEGRATION.md)
