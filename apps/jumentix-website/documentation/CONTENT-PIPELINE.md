# Markdown Content Pipeline

Issue tracking:

- Epic: [#167](https://github.com/web2solutions/aaa-typescript-boilerplate/issues/167)
- Task: [#172](https://github.com/web2solutions/aaa-typescript-boilerplate/issues/172)

## Purpose

Transform canonical consumer documentation owned by Jumentix components into a bilingual,
hierarchical Nextra portal. The pipeline currently generates 110 source-backed pages plus localized
portal and section landings, producing 61 English routes and 61 Portuguese routes.

## Source Configuration

`config/content-sources.json` supports two source models:

- `entries`: curated concepts, guides, and reference pages with explicit English and Portuguese
  source paths, titles, descriptions, sections, and slugs;
- `collections`: recursively discovered package or adapter documentation whose English `.md` source
  must have a sibling `.pt-BR.md` translation.

Internal planning, migration, governance, and creator-only documents are intentionally omitted from
this consumer configuration.

## Generator

`scripts/sync-markdown-content.mjs`:

1. validates configured sources and collection translation pairs;
2. infers collection titles and stable slugs;
3. creates matching trees under `content/jumentix` and `content/pt-BR/jumentix`;
4. creates `_meta.ts` navigation metadata for each hierarchy level;
5. removes unsupported HTML comments before MDX compilation;
6. rewrites links to another published source as canonical website routes;
7. rewrites other resolvable repository Markdown links as GitHub `blob/dev` links;
8. adds frontmatter and source traceability to each generated page;
9. generates localized portal landing pages and recommended journeys.

## Route Contract

- English: `/docs/jumentix/<section>/<slug>`
- Portuguese: `/docs/pt-BR/jumentix/<section>/<slug>`
- Sections: `concepts`, `guides`, `adapters`, `packages`, and `reference`
- Adapter families: `http`, `databases`, and `realtime`

The application loader maps maintained legacy slugs to canonical routes.

## Validation

`scripts/content-smoke.mjs` requires:

- at least 61 pages per language;
- identical EN/PT relative route trees;
- representative concept, guide, adapter, package, and reference pages;
- frontmatter on every generated page;
- no unsupported HTML comments;
- no `undefined` generated-link markers.

`scripts/prepublish-site-checks.mjs` builds and starts the production application, exercises
canonical and compatibility documentation routes, and follows internal links from the commercial
and documentation surfaces.

## Commands

```bash
pnpm --filter @jumentix/website run content:sync
pnpm --filter @jumentix/website run content:smoke
pnpm --filter @jumentix/website run test:prepublish
```

`predev` and `prebuild` regenerate content automatically. Generated files remain versioned so
deployments retain auditable source-to-page output.
