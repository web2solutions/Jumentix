# Requirement 092 - Jumentix Open-Source Commercial Experience

## Context

Jumentix is an open-source software factory with a broad product and technical surface. Its public
website must combine a persuasive product narrative with the navigation depth, technical proof,
and community paths expected from established open-source framework websites.

## Mandatory Rules

1. Commercial routes use one shared website shell with consistent header, mobile navigation,
   footer, active-route state, and language switch.
2. Every maintained commercial route must have complete English and Portuguese (`pt-BR`)
   experiences. The language switch must preserve the current route.
3. The homepage must identify Jumentix in the first viewport and use a real product view or
   relevant product asset as its primary visual evidence.
4. Product capabilities must be demonstrated with code widgets whenever commands, contracts,
   protocols, persistence, or deployment behavior can be shown accurately.
5. Published code examples must match repository commands, contracts, environment variables, and
   architectural patterns. Decorative or fictional APIs are prohibited.
6. Commercial information architecture must provide explicit journeys for product owners,
   software engineers, platform teams, security evaluators, and contributors.
7. Product, use-case, integration, architecture, security, adoption, contact, community,
   roadmap, and changelog routes must be mutually discoverable through global or contextual
   navigation.
8. Changelog data remains sourced from GitHub and paginated, with no more than 200 changes loaded
   per website page.
9. Internal commercial links must resolve to a maintained website route or canonical
   documentation route. Broken or unpublished placeholder links are prohibited.
10. Canonical production metadata, sitemap, Open Graph, and Twitter URLs must use
    `https://jumentix-website.vercel.app`.
11. Responsive layouts must preserve readable code, actions, navigation, product media, and
    headings without overlap at mobile and desktop widths.
12. Reusable commercial page states must be represented in Storybook alongside the design-system
    inventory.
13. Reference-product research may guide information architecture and interaction patterns but
    must not copy another product's identity, language, or visual assets.
14. Production release requires typecheck, website build, Storybook build/smoke, commercial route
    smoke checks in both languages, documentation route checks, and internal-link validation.

## Acceptance Criteria

1. English and Portuguese commercial route matrices return successful responses.
2. Header, mobile navigation, footer, current-page state, and locale switching work consistently.
3. Homepage and product pages expose real Jumentix product evidence and accurate code examples.
4. Storybook indexes commercial page variants and all exported design-system components.
5. Production metadata and sitemap contain the deployed Vercel hostname.
6. The website prepublish gate catches missing content, runtime errors, and broken maintained
   routes before deployment.

## Evidence

- GitHub epic `#167`
- GitHub task `#171`
- `apps/jumentix-website/components/commercial`
- `apps/jumentix-website/components/design-system`
- `apps/jumentix-website/scripts/prepublish-site-checks.mjs`
- `apps/jumentix-website/documentation/COMMERCIAL-EXPERIENCE.md`
