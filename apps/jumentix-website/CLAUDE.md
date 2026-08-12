# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Next.js 16 + Mantine 9 + Nextra 4** template used as the documentation site foundation for the Mantine Extensions ecosystem. It serves as a reusable starter for building docs sites with integrated Mantine components.

## Commands

| Command | Purpose |
|---------|---------|
| `yarn dev` | Start Next.js dev server |
| `yarn build` | Production build (Next.js + pagefind search index) |
| `yarn test` | Full suite: typegen, oxfmt, lint, typecheck, jest |
| `yarn jest` | Run Jest tests only |
| `yarn jest:watch` | Jest in watch mode |
| `yarn jest -- path/to/file` | Run a single test file |
| `yarn typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `yarn lint` | oxlint + Stylelint |
| `yarn format:write` | Auto-format all TS/TSX/CSS files (oxfmt) |
| `yarn format:test` | Check formatting (oxfmt) |
| `yarn storybook` | Storybook dev server on port 6006 |
| `yarn analyze` | Bundle analysis with `@next/bundle-analyzer` |

## Architecture

### Routing & Content

- **App Router** (`app/`): Next.js 16 app router with Nextra integration
- **Docs content** (`content/`): MDX files rendered via Nextra at `/docs/[[...mdxPath]]`
- Nextra is configured with `contentDirBasePath: '/docs'` — all MDX content is served under `/docs`
- `content/_meta.ts` controls sidebar navigation order and labels

### Layout & Theme Integration

- `app/layout.tsx` wraps the entire app in both `MantineProvider` and Nextra's `Layout`
- Dark mode sync between Mantine and Nextra is handled by `MantineNextraThemeObserver`
- Mantine theme overrides go in `theme.ts` (client-side `createTheme`)
- Global site configuration (metadata, GitHub API, search, Nextra layout) lives in `config/index.ts`

### Key Components (`components/`)

- `MantineNavBar` / `MantineFooter` — custom Nextra layout replacements
- `ColorSchemeControl` / `ColorSchemeToggle` — dark mode toggle
- `ReleaseNotes` — fetches GitHub releases via `/api/github-releases`
- `Logo`, `Welcome`, `Content` — branding and landing page components

### API Routes (`app/api/`)

- `version/` — returns current package version
- `github-releases/` — proxies GitHub releases API (configured in `config/index.ts`)
- `search/` — pagefind-based search endpoint

### Search

Search uses [pagefind](https://pagefind.app/). The index is built post-build (`yarn build:pagefind`) into `public/_pagefind/`. The search API route reads this index.

### CSS Import Order

In `app/layout.tsx`, CSS imports must follow this order:
1. `@mantine/core/styles.css`
2. Mantine extension styles (e.g., marquee, text-animate)
3. Global styles

### Build Pipeline

Next.js config (`next.config.mjs`) chains: `nextra()` → `bundleAnalyzer()`. Turbopack is configured with inline SVG loader for SVGs under ~4KB.

## Tooling

- **Formatter**: oxfmt (`.oxfmtrc.json`)
- **Linter**: oxlint + stylelint
- **TypeScript**: 6.x
- **Package Manager**: Bun 1.3.14 (workspace standard). Do not use npm, pnpm, or yarn inside this monorepo.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
