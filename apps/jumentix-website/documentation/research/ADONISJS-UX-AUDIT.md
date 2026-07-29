# AdonisJS UX Reference Audit for the Jumentix Website Rebuild

## Purpose

This audit studies the public AdonisJS website as a product and frontend reference for the
Jumentix open-source website rebuild. It extracts reusable product-communication and navigation
ideas without copying AdonisJS branding, copy, visual assets, or source code.

Research date: `2026-07-26`

Related governance:

- Epic: [#167](https://github.com/XpertMinds/Jumentix/issues/167)
- Research task: [#168](https://github.com/XpertMinds/Jumentix/issues/168)
- Milestone:
  [Jumentix OSS website rebuild - 2026-08-23](https://github.com/XpertMinds/Jumentix/milestone/3)

## Evidence

The audit captured every first-level public page exposed through the AdonisJS navigation and
footer, plus representative documentation pages.

![AdonisJS public pages contact sheet](./adonisjs/public-pages-contact-sheet.jpg)

![AdonisJS and current Jumentix documentation comparison](./adonisjs/docs-comparison-contact-sheet.jpg)

Full-page screenshots:

| Page | Evidence |
| --- | --- |
| Home | [home.jpg](./adonisjs/pages/home.jpg) |
| Packages | [packages.jpg](./adonisjs/pages/packages.jpg) |
| Wall of love | [wall-of-love.jpg](./adonisjs/pages/wall-of-love.jpg) |
| Blog | [blog.jpg](./adonisjs/pages/blog.jpg) |
| Roadmap | [roadmap.jpg](./adonisjs/pages/roadmap.jpg) |
| Sponsor | [sponsor.jpg](./adonisjs/pages/sponsor.jpg) |
| About | [about.jpg](./adonisjs/pages/about.jpg) |
| Stories | [stories.jpg](./adonisjs/pages/stories.jpg) |
| Releases | [releases.jpg](./adonisjs/pages/releases.jpg) |
| Contributors | [contributors.jpg](./adonisjs/pages/contributors.jpg) |
| Support | [support.jpg](./adonisjs/pages/support.jpg) |
| Brand | [brand.jpg](./adonisjs/pages/brand.jpg) |
| Team | [team.jpg](./adonisjs/pages/team.jpg) |
| Documentation home | [docs-home.jpg](./adonisjs/pages/docs-home.jpg) |
| Documentation introduction | [docs-introduction.jpg](./adonisjs/pages/docs-introduction.jpg) |
| Documentation routing guide | [docs-routing-guide.jpg](./adonisjs/pages/docs-routing-guide.jpg) |
| Current Jumentix production docs | [current-production-docs-jumentix.jpg](./current-production-docs-jumentix.jpg) |

## Public Experience Map

| AdonisJS surface | Product job | Pattern worth adapting for Jumentix |
| --- | --- | --- |
| Home | Explain the framework and convert interest | Category statement, code proof, ecosystem breadth, OSS evidence, multiple next steps |
| Packages | Make the ecosystem inspectable | Searchable directory, official/community distinction, compact package metadata |
| Wall of love | Build developer trust | Community proof as a dedicated destination |
| Blog | Maintain an active project narrative | Release, architecture, AI, and engineering articles with visible recency |
| Roadmap | Show direction and invite participation | Public delivery states, issue links, and community feedback |
| Sponsor | Explain sustainability | Sponsorship purpose, tiers, placement, and current supporters |
| About | State philosophy and tradeoffs | Ecosystem problems, design choices, and long-term commitment |
| Stories | Provide decision evidence | Cases with migration context, scale, team size, and measurable results |
| Releases | Demonstrate maintenance | Chronological package-level release stream |
| Contributors | Recognize the community | Visible activity and direct repository linkage |
| Support | Provide a professional path | Scope, response model, pricing expectations, and qualification CTA |
| Brand | Enable correct reuse | Assets, naming rules, logo variants, and misuse examples |
| Team | Establish maintainership | Named maintainers, responsibilities, links, and ownership |
| Docs home | Route different learning intentions | Search-first entry, task-oriented paths, guides/reference separation |
| Docs article | Make dense knowledge navigable | Persistent hierarchy, central article, table of contents, search, breadcrumbs |

## Strong Patterns to Reuse

### Separate product discovery from technical depth

The commercial site and documentation have distinct jobs but share brand, search, GitHub, and
ecosystem links. Jumentix should keep the root website persuasive and the documentation
task-oriented while allowing users to move between both without losing context.

### Demonstrate features with real code

Jumentix should use real project contracts and APIs in code showcases:

- CLI project bootstrap;
- REST controller and handler flow;
- WebSocket message request/response;
- gRPC handler;
- Message Mediator contract;
- database driver selection;
- OpenAPI and AsyncAPI contracts;
- PM2 and deployment configuration.

### Give large documentation a stable spatial model

Jumentix needs:

- persistent desktop sidebar;
- mobile navigation drawer;
- article breadcrumbs;
- right-side table of contents;
- previous/next navigation;
- global documentation search;
- version and locale context;
- copyable deep links and code;
- Guides, Concepts, Reference, Packages, and Contribution areas.

### Treat the ecosystem as a product

Packages, integrations, releases, contributors, sponsors, and roadmap are first-class
destinations. Jumentix should expose its packages, HTTP adapters, persistence adapters, realtime
transports, cloud targets, SDKs, templates, and tools as an inspectable ecosystem.

### Use proof at multiple confidence levels

The rebuild should distinguish:

- implemented and tested capability;
- supported integration;
- roadmap capability;
- governance and security evidence;
- community or enterprise adoption evidence.

### Provide multiple valid entry paths

Product owners, backend engineers, frontend engineers, platform teams, contributors, and
evaluators need different journeys. A single long marketing page cannot serve all of them.

## Current Jumentix Production Findings

Production route audited:
`https://jumentix-website.vercel.app/docs/jumentix`

> Historical baseline: the defects below describe the production implementation observed before
> epic `#167`. Tasks `#170`, `#171`, and `#172` replace that shell with the shared design system,
> bilingual commercial experience, hierarchical documentation portal, Storybook inventory, and
> production route/link gates.

### Confirmed defects

1. The documentation route renders bare MDX without the global header, sidebar, table of
   contents, footer, or readable content frame.
2. `app/docs/[[...mdxPath]]/page.tsx` returns `MDXContent` directly and does not mount the Nextra
   documentation `Layout`.
3. `app/layout.tsx` provides Mantine but no application navigation or footer.
4. The generated index uses relative links such as `./overview`, while route fallback behavior
   mixes `/docs/overview` and `/docs/jumentix/overview`.
5. Production overview pages display `Source file not found`.
6. The content sync script reads files outside the website app. A Vercel project rooted at the
   website directory cannot reliably access those monorepo paths during `prebuild`.
7. The prepublish script checks status and marker strings but does not crawl internal links,
   validate layout landmarks, detect hydration errors, or exercise mobile navigation.
8. The prepublish script invokes `npm`, conflicting with the pnpm monorepo standard.
9. Storybook exists, but only a small fraction of website components have stories.
10. The homepage behaves like a basic enterprise landing page, not a complete open-source
    framework destination.

### Root-cause summary

```text
Vercel build
  -> website prebuild
  -> content sync reads monorepo-external sources
  -> unavailable sources become "Source file not found"
  -> catch-all docs page imports generated MDX
  -> MDX renders without Nextra Layout
  -> bare content and unreliable navigation reach production
```

The production failure is a composition and content-packaging issue, not a CSS-only issue.

## Proposed Jumentix Information Architecture

### Global navigation

1. Product
   - Overview
   - Architecture
   - Security and compliance
   - Changelog
2. Solutions
   - REST APIs
   - Realtime APIs
   - Modular SaaS
   - Microservices
   - Offline SPA/PWA
3. Developers
   - Documentation
   - Getting started
   - Guides
   - Contracts
   - Packages
4. Ecosystem
   - HTTP adapters
   - Persistence adapters
   - Realtime transports
   - Cloud and deployment
   - SDK clients
5. Community
   - GitHub
   - Roadmap
   - Contributors
   - Discussions
   - Brand

Persistent utilities:

- documentation search;
- locale switcher;
- color scheme control;
- GitHub repository and star signal;
- `Get started` command or CTA.

### Public route model

```text
/
├── product
├── architecture
├── security-compliance
├── use-cases
│   ├── rest-api
│   ├── realtime-api
│   ├── spa-pwa
│   ├── saas-monolith
│   └── saas-microservices
├── integrations
├── ecosystem
│   ├── packages
│   ├── http-adapters
│   ├── databases
│   ├── realtime
│   └── deployment
├── changelog
├── roadmap
├── community
│   ├── contributors
│   ├── support
│   └── brand
├── docs
│   ├── getting-started
│   ├── guides
│   ├── concepts
│   ├── reference
│   ├── packages
│   └── contributing
└── pt-BR
    └── equivalent localized public and documentation routes
```

Existing public URLs should remain valid through stable routes or explicit redirects.

## Core User Journeys

### Product owner

```text
Home -> Product -> Use case -> Architecture -> Security -> Adoption CTA
```

### Software engineer

```text
Home -> Code showcase -> Getting started -> Service guide -> Contract reference -> CLI
```

### Platform engineer

```text
Architecture -> Ecosystem -> Quality gates -> Runtime/deploy -> Security evidence
```

### Open-source contributor

```text
Community -> Roadmap -> Contributing -> GitHub issue -> Component documentation
```

## Storybook Component Inventory

Every reusable component needs stories for important visual, responsive, interactive, and
accessibility states.

### Global shell

- `AnnouncementBanner`
- `SiteHeader`
- `DesktopNavigation`
- `MobileNavigationDrawer`
- `SiteFooter`
- `ThemeSwitcher`
- `LocaleSwitcher`
- `GitHubLink`
- `SearchTrigger`
- `SearchDialog`

### Product storytelling

- `Hero`
- `HeroCodePreview`
- `SectionHeading`
- `FeatureGrid`
- `FeatureCard`
- `CapabilityMatrix`
- `StatsStrip`
- `Metric`
- `ArchitectureFlow`
- `IntegrationGrid`
- `IntegrationBadge`
- `PackageCard`
- `RoadmapCard`
- `ReleaseEntry`
- `Testimonial`
- `CaseStudyCard`
- `CallToActionBand`

### Code and technical proof

- `CodeBlock`
- `CodeTabs`
- `CodeShowcase`
- `CopyCodeButton`
- `TerminalCommand`
- `FileTree`
- `ContractBadge`
- `DiagramPanel`
- `RequestResponseExample`

### Documentation

- `DocsShell`
- `DocsSidebar`
- `DocsMobileMenu`
- `DocsBreadcrumbs`
- `DocsTableOfContents`
- `DocsPagination`
- `DocsSearchResults`
- `VersionSelector`
- `DocCallout`
- `DocLinkCard`
- `DocCardGrid`
- `TabbedContent`
- `Steps`
- `ApiContractTable`

### Foundations and feedback

- `Button`
- `IconButton`
- `Badge`
- `Card`
- `Tabs`
- `Tooltip`
- `Popover`
- `Pagination`
- `EmptyState`
- `LoadingState`
- `ErrorState`
- `SkipLink`

## Original Visual Direction

- Use the Jumentix mascot as a meaningful brand signal.
- Prefer graphite and ink surfaces with signal lime, cyan, coral, and neutral contrasts.
- Avoid a one-note purple or dark-blue palette.
- Use restrained borders and compact radii.
- Use code, diagrams, package metadata, and project evidence as primary visuals.
- Reserve large typography for true hero moments.
- Keep documentation typography quiet and highly readable.
- Use motion for state and hierarchy with reduced-motion support.
- Never place dense documentation inside decorative marketing cards.

## Non-Copy Boundary

The rebuild may adopt information-design principles, but it must not reuse:

- AdonisJS logos, icons, illustrations, screenshots as production assets, or brand colors;
- AdonisJS copy or testimonials;
- source code, CSS, component implementation, or proprietary data;
- page compositions copied one-to-one.

Research screenshots remain internal creator documentation and are not website production assets.

## Delivery Mapping

| Finding | Jumentix task |
| --- | --- |
| Broken docs composition and content packaging | #169 |
| Missing reusable design system and incomplete stories | #170 |
| Weak OSS product storytelling and code proof | #171 |
| Documentation cannot scale to the corpus | #172 |
| Insufficient route, link, layout, and accessibility gates | #173 |
| Production deployment needs verified evidence | #174 |
