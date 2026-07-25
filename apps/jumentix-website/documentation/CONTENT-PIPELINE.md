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
3. Generates one `.mdx` page per source in `content/jumentix`.
4. Generates `content/jumentix/_meta.ts` for navigation.
5. Adds source traceability line in each generated page.

## Fallback Rules

- Missing `title`: inferred from `slug`.
- Missing `description`: generated from final title.
- Missing source file: generated page includes an explicit "Source file not found" message (build-safe fallback).

## Commands

From repo root:

```bash
node apps/jumentix-website/scripts/sync-markdown-content.mjs
```

From website workspace:

```bash
pnpm run content:sync
```

`predev` and `prebuild` automatically run `content:sync`.
