# Changelog Page

The website exposes `/changelog` as a GitHub-backed change history page for Jumentix.

## Data Source

- GitHub repository: `XpertMinds/Jumentix`
- Branch: `dev`
- Endpoint family: GitHub commits API

## Pagination Contract

- UI page size: up to `200` changes per page
- GitHub API page size: `100` commits per request
- Implementation strategy:
  - website page `N` fetches GitHub pages `2N-1` and `2N`
  - results are merged and capped at 200

## Behavior

- Each entry links to the exact commit on GitHub.
- Previous/Next controls avoid loading the entire history at once.
- Supports optional `GITHUB_TOKEN` for rate-limit-friendly API access, with unauthenticated fallback.

## Files

- `app/changelog/page.tsx`
- `config/index.ts` (commits URL + default branch)
- `app/sitemap.ts` (route indexing)
- `components/MantineFooter/MantineFooter.tsx` (site navigation link)
