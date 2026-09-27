# Jumentix Commercial Website Experience

Issue tracking:

- Epic: [#167](https://github.com/web2solutions/Jumentix/issues/167)
- Implementation: [#171](https://github.com/web2solutions/Jumentix/issues/171)

## Purpose

The public website presents Jumentix as an open-source software factory and gives technical
evaluators enough evidence to validate it inside the commercial journey. It serves product owners,
engineering leaders, software engineers, platform teams, security evaluators, and contributors.

The experience learns from the information depth and code-first communication of established
open-source framework websites while preserving Jumentix language, product assets, and identity.

## Information Architecture

| Route | Responsibility |
| --- | --- |
| `/` | Positioning, proof, real Domain Designer view, and code entry point |
| `/product` | Complete platform capability and delivery lifecycle |
| `/use-cases` and children | REST, realtime, modular SaaS, microservices, and offline PWA blueprints |
| `/integrations` | HTTP, realtime, persistence, messaging, and deployment inventory |
| `/architecture` | DDD, Hexagonal, Event-Driven, SOLID, and contract boundaries, plus an interactive backend-template hexagonal map (including `interface/GUI`) |
| `/security-compliance` | RBAC, PCI-oriented controls, secret safety, and evidence |
| `/pricing-or-engagement` | Open-source, pilot, and platform adoption paths |
| `/community` | Contribution workflow and governance |
| `/roadmap` | Product direction linked to the live Linear roadmap |
| `/changelog` | GitHub history with up to 200 changes per page |
| `/contact` | Discussions, issues, and enterprise contact |
| `/docs/jumentix` | Technical documentation entry point |

Each commercial route also exists under `/pt-BR`. The locale control preserves the current route.

## Navigation

Desktop navigation keeps Product, Use cases, Integrations, Architecture, and Docs visible. GitHub
and language selection remain direct actions. At compact widths, navigation becomes a labelled
menu that also exposes Community and Roadmap. The footer groups product construction, learning,
and community resources.

## Code Evidence

`CodeShowcase` presents repository-aligned examples as accessible tabs with a named copy action:

- Bun installation and local startup;
- TypeScript service and Message Mediator contracts;
- OpenAPI 3.1 and AsyncAPI definitions;
- Fetch, Socket.IO, and gRPC clients;
- database driver selection, relationships, and Docker checks;
- PM2, Serverless, and quality-gate workflows.

Examples must evolve with actual scripts, contracts, and environment variables. Fictional examples
that cannot map to repository behavior are prohibited.

## Product Proof

The homepage uses the real Domain Designer canvas as full-bleed first-viewport media. The product
page opens with a "See it running" tour of six captures under `public/product/`:
`architecture-designer.png`, `domain-designer.png`, `openapi-swagger.png`, `code-workspace.png`
(Service Management) and `frontend-xcrud-users.png`, `frontend-dashboard.png` (the frontend seed).

Every capture is produced by one command against the running apps — WebKit, 1440×900 at 2×,
dark scheme — so a refresh is repeatable rather than a manual session:

```bash
bun apps/service-management/server.js                 # Service Management (JUMENTIX_SERVICE_MANAGEMENT_PORT)
# backend-template on InMemory + `bun run dev` in apps/frontend
FRONTEND_USERNAME=… FRONTEND_PASSWORD=… \
  bun run --filter @jumentix/website screenshots:capture
```

Use a seeded account (`apps/backend-template/seed/users.ts`). The script loads the Service
Management sample model, splits it into two services for the architecture view, and signs in to
the frontend for the admin and dashboard views.

Every image on the site shows Jumentix itself. The starter-template leftovers the site was
scaffolded with — the `mantine+nextjs+nextra-template.png` placeholder, the unused `Welcome`,
`ProductHunt`, `Content`, `Sponsors` and `ColorSchemeToggle` components, the template author's
footer link lists and the `@gfazioli/mantine-*` styles they needed — were removed (JUM-897).
The only remaining trace is the attribution line in this app's README.

## Implementation

```text
components/commercial/
  ChangelogPage.tsx
  CommercialChrome.tsx
  CommercialPages.module.css
  CommercialPages.stories.tsx
  CommercialPages.tsx
```

Route files are thin wrappers. Portuguese routes are dispatched through
`app/pt-BR/[[...slug]]/page.tsx`, which rejects unknown paths with `notFound()`. Nextra continues
to own the `/docs` shell.

## Storybook and Release

Commercial stories cover both languages, primary pages, REST/realtime journeys, and mobile
product state. Together with the design system, the catalog has 42 entries.

```bash
bun run website:storybook
bun run website:storybook:build
bun run website:storybook:smoke
bun run --filter @jumentix/website test:prepublish
```

The prepublish gate builds production output, starts it locally, validates commercial routes in
both languages, verifies changelog pagination and documentation routes, then stops the server.
