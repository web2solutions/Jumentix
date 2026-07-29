# SEO and Performance Baseline

Issue tracking:

- Epic: [#124](https://github.com/XpertMinds/Jumentix/issues/124)
- Task: [#129](https://github.com/XpertMinds/Jumentix/issues/129)

## SEO Baseline Implemented

- Global metadata configured in `config/index.ts`:
  - title template
  - description
  - keywords
  - Open Graph metadata and image
  - Twitter card metadata
- Robots endpoint:
  - `app/robots.ts`
- Sitemap endpoint:
  - `app/sitemap.ts` with core commercial and docs routes

## Performance Baseline Strategy

- Static-first page design for commercial routes.
- Markdown content generated ahead of runtime via `content:sync`.
- Minimal client-only interactivity on commercial pages.
- Keep pages component-light and avoid large runtime dependencies per route.

## Follow-up Validation Steps

1. Run Lighthouse for key routes:
   - `/`
   - `/product`
   - `/use-cases`
   - `/contact`
2. Capture baseline for:
   - Performance
   - SEO
   - Accessibility
3. Store baseline evidence in PR description for website launch milestones.
