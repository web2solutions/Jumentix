# Markdown Content Pipeline

Issue tracking:

- Epic: [#124](https://github.com/web2solutions/aaa-typescript-boilerplate/issues/124)
- Task: [#127](https://github.com/web2solutions/aaa-typescript-boilerplate/issues/127)

## Purpose

Convert selected markdown documents from the Jumentix repository into static website documentation pages under `apps/jumentix-website/content/jumentix`.

## Source Configuration

File:

- `apps/jumentix-website/config/content-sources.json`

Each item defines:

- `slug` (required)
- `title` (optional fallback from slug)
- `description` (optional fallback from title)
- `source` (required path relative to website app root)

## Generator Script

File:

- `apps/jumentix-website/scripts/sync-markdown-content.mjs`

Behavior:

1. Reads `content-sources.json`.
2. Loads each source markdown file.
3. Rewrites repository-relative Markdown links:
   - links to another published source become `/docs/jumentix/<slug>` routes;
   - links to repository documents outside the published set become valid GitHub `blob/dev` URLs.
4. Generates one `.mdx` page per source in `content/jumentix`.
5. Generates `content/jumentix/_meta.ts` for navigation.
6. Adds source traceability line in each generated page.

## Fallback Rules

- Missing `title`: inferred from `slug`.
- Missing `description`: generated from final title.
- Missing source file with an existing valid generated page: preserves the generated page. This
  supports isolated Vercel builds where monorepo source files are not included in the app build
  context.
- Missing source file without an existing valid generated page: fails the build.
- A generated page containing `Source file not found:` is invalid and is never accepted as a
  fallback.

## Documentation Runtime

- Canonical routes use `/docs/jumentix/<slug>`.
- Existing `/docs/<slug>` links remain compatible and resolve through the canonical Jumentix
  content tree.
- The Nextra documentation layout provides global navigation, search, sidebar, table of contents,
  previous/next navigation, feedback, edit links, and the site footer.
- The root Nextra navigation hides starter/demo pages that are not part of Jumentix documentation.

## Commands

From the repository root:

```bash
pnpm --dir apps/jumentix-website content:sync
```

From website workspace:

```bash
pnpm run content:sync
```

`predev` and `prebuild` automatically run `content:sync`.

The prepublish gate validates canonical and legacy documentation routes and rejects missing-source
markers, Nextra provider errors, invalid component errors, and server errors.
