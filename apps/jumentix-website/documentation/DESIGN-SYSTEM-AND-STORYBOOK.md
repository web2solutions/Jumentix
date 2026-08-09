# Jumentix Website Design System and Storybook

Issue tracking:

- Epic: [#167](https://github.com/XpertMinds/Jumentix/issues/167)
- Task: [#170](https://github.com/XpertMinds/Jumentix/issues/170)

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

The catalog currently generates 54 indexed entries, including explicit mobile states for the site
header, architecture flow, commercial product page, complete commercial page compositions, and the
Service Management designer coverage below.

## Service Management Designer Coverage

The Service Management designer (`apps/service-management`) is a zero-build vanilla SPA, so it
cannot import the React components. It adopts the design system at the token layer (JUM-488):

- `apps/service-management/tokens.css` vendors `components/design-system/tokens.css` — the shared
  `--jtx-*` custom properties (colors, surfaces, lines, radii, shadows, spacing, motion, and the
  `--jtx-font-sans`/`--jtx-font-mono` typography stacks). Token changes land in the website file
  first and are mirrored into the vendored copy.
- `apps/service-management/styles.css` resolves every cosmetic value to those tokens. Only
  structural geometry the canvas math depends on (3200×2200 canvas, 24 px grid, 520 px domains,
  190 px entities) and the compact inspector density stay literal, and its element-level rules are
  scoped under `.service-management-shell` so embedding the stylesheet here never leaks into the
  Storybook chrome.
- `components/service-management-designer/ServiceManagementDesigner.stories.tsx` mounts the
  designer's real markup and stylesheets in this Storybook — tab shell, workspace controls, domain
  canvas with entities/edges/mini-map, the JUM-543 status surfaces, entity inspector, panels and
  lists, code previews, and the JUM-489 PWA update banner — so the same static build, manifest
  smoke, accessibility, and light/dark gates cover the designer's key UI states.

The smoke check requires the eight designer stories and a minimum catalog of 54 entries.

The designer-side view of this adoption — the vendored-token sync rule, the
keyboard and screen-reader model, and the PWA shell it shares with these
stories — is documented in
[Service Management Design System and PWA Shell](../../../documentation/md/SERVICE-MANAGEMENT-DESIGN-SYSTEM-PWA.md)
(E7).

Visual evidence:

- [Component catalog](./research/storybook-design-system.png)
- [Dark-theme components](./research/storybook-dark-theme.png)
- [Mobile header at 320 px](./research/storybook-mobile-header.png)

## Commands

From the monorepo root:

```bash
bun run website:storybook
bun run website:storybook:build
bun run website:storybook:smoke
```

From `apps/jumentix-website`:

```bash
bun run storybook
bun run storybook:build
bun run storybook:smoke
```

The smoke command expects a fresh `storybook-static` build. Generated output is ignored by Git.

## Workflow Ownership

Storybook belongs exclusively to the `apps/jumentix-website` workflow. Its development server,
static build, smoke validation, accessibility checks, and component tests are website quality
gates.

Storybook is not part of the main monorepo workflow or its global test matrix. It must not block
unrelated packages, applications, backend templates, or services. The root
`website:storybook*` commands are convenience delegates to this workspace and do not transfer
workflow ownership to the monorepo root.

The path-scoped `.github/workflows/website.yml` workflow is the hosted CI owner. It runs only
when website-owned inputs change and executes the Storybook static build, inventory smoke check,
and website prepublish validation. The repository-wide `.github/workflows/test.yml` never invokes
Storybook.

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
