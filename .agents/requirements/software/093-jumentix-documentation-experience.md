# Requirement 093 - Jumentix Documentation Experience

## Context

Jumentix has a broad open-source platform surface. Its public technical documentation must support
discovery, learning, implementation, and reference workflows without exposing consumers to an
unstructured repository mirror.

## Mandatory Rules

1. Public technical documentation is organized into Concepts, Guides, Adapters, Packages, and
   Reference.
2. Every published English page has a Portuguese (`pt-BR`) counterpart at the same relative route.
3. The documentation shell provides search, hierarchical sidebar navigation, current-page state,
   table of contents, previous/next links, repository feedback, edit links, theme controls, and a
   locale switch that preserves the current route.
4. Consumer documentation is generated from canonical component documentation. Internal planning,
   migration, governance, and maintainer-only material must not be published in the consumer tree.
5. Repository-relative links between published sources become website routes. Other repository
   documents become valid GitHub links; generated broken-link markers are prohibited.
6. Commands, contracts, payloads, environment variables, and code widgets must reflect implemented
   repository behavior.
7. Legacy published documentation URLs remain compatible when a canonical replacement exists.
8. Documentation components and responsive shell states are represented in Storybook.
9. Publication requires deterministic content generation, EN/PT tree-parity validation, canonical
   route smoke tests, legacy redirect checks, and internal-link validation.
10. New public packages, adapters, guides, or reference resources must be added through the
    configured content pipeline and are incomplete until both locales are available.

## Acceptance Criteria

1. The generator produces matching English and Portuguese documentation trees.
2. Canonical routes for concepts, guides, HTTP/database/realtime adapters, packages, and reference
   return successful production responses.
3. Documentation navigation works on desktop and mobile without broken links or hidden sections.
4. Storybook indexes the documentation header and footer in both languages.
5. Prepublication checks reject missing locale pairs, invalid MDX, undefined links, server errors,
   and broken maintained links.

## Evidence

- GitHub epic `#167`
- GitHub task `#172`
- `apps/jumentix-website/config/content-sources.json`
- `apps/jumentix-website/scripts/sync-markdown-content.mjs`
- `apps/jumentix-website/scripts/content-smoke.mjs`
- `apps/jumentix-website/scripts/prepublish-site-checks.mjs`
- `apps/jumentix-website/documentation/DOCUMENTATION-EXPERIENCE.md`
