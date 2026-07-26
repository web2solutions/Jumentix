# Jumentix Website Design System and Storybook

Issue tracking:

- Epic: [#167](https://github.com/web2solutions/aaa-typescript-boilerplate/issues/167)
- Task: [#170](https://github.com/web2solutions/aaa-typescript-boilerplate/issues/170)

## Purpose

The Jumentix design system gives commercial pages and technical documentation one accessible,
code-first visual language. It keeps foundation UI close to the website package and makes every
reusable state inspectable before it reaches a page or deployment.

The design deliberately uses compact geometry, neutral surfaces, operational blue and green, and
coral/yellow signals. Reference products inform information density and navigation patterns, but
Jumentix retains an independent identity.

## Component Inventory

| Component | Responsibility |
| --- | --- |
| `BrandMark` | Stable product identity and home link |
| `ActionLink` | Primary, secondary, quiet, and external actions |
| `StatusBadge` | Neutral, success, and attention status |
| `SectionHeading` | Eyebrow, title, and supporting narrative |
| `FeatureGrid` | Responsive capability summaries |
| `Callout` | Information, success, and warning guidance |
| `MetricStrip` | Comparable product and engineering metrics |
| `CapabilityTable` | Dense, horizontally safe implementation matrix |
| `CodeShowcase` | Keyboard-accessible code tabs and copy action |
| `SearchField` | Stable documentation search control |
| `Pagination` | Labelled previous, next, and numbered navigation |
| `LocaleSwitch` | Explicit EN/PT-BR language control |
| `SiteHeader` | Product navigation and repository action |
| `SiteFooter` | Product, learning, and community navigation |
| `DocsToolbar` | Documentation search, edit, and locale actions |
| `ArchitectureFlow` | Responsive architecture and workflow diagrams |

The public entry point is `components/design-system/index.tsx`. Foundational styling is split into
`tokens.css` and `DesignSystem.module.css`.

## Storybook Capabilities

Storybook is configured for:

- Next.js, React, Mantine, and local static assets;
- generated component documentation;
- accessibility analysis that reports violations as errors;
- light and dark theme inspection;
- desktop and mobile viewport stories;
- deterministic static builds;
- a manifest-based smoke check for required stories and minimum catalog size.

The catalog currently generates 42 indexed entries, including explicit mobile states for the site
header, architecture flow, commercial product page, and complete commercial page compositions.

Visual evidence:

- [Component catalog](./research/storybook-design-system.png)
- [Dark-theme components](./research/storybook-dark-theme.png)
- [Mobile header at 320 px](./research/storybook-mobile-header.png)

## Commands

From the monorepo root:

```bash
pnpm run website:storybook
pnpm run website:storybook:build
pnpm run website:storybook:smoke
```

From `apps/jumentix-website`:

```bash
pnpm run storybook
pnpm run storybook:build
pnpm run storybook:smoke
```

The smoke command expects a fresh `storybook-static` build. Generated output is ignored by Git.

## Contribution Workflow

1. Add or update the reusable component in `components/design-system`.
2. Reuse existing tokens before introducing a new semantic token.
3. Export the component from the design-system entry point.
4. Add a meaningful story, including interaction, responsive, empty, or error states when
   applicable.
5. Verify keyboard focus, accessible names, contrast, dark mode, mobile layout, and reduced
   motion.
6. Run typecheck, Storybook build, and Storybook smoke.
7. Reuse the component in product or documentation pages rather than cloning its markup.

## Design Constraints

- Cards and framed surfaces use radii of eight pixels or less.
- Pill shapes are reserved for compact status labels.
- Text never scales directly with viewport width.
- Motion respects `prefers-reduced-motion`.
- Tables and code samples scroll horizontally instead of breaking mobile layout.
- Icon-only controls always expose accessible labels and tooltips where needed.
- Code widgets are preferred when a product capability is best demonstrated through executable
  contracts or commands.
