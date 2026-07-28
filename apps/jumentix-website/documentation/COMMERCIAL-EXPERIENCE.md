# Jumentix Commercial Website Experience

Issue tracking:

- Epic: [#167](https://github.com/web2solutions/aaa-typescript-boilerplate/issues/167)
- Implementation: [#171](https://github.com/web2solutions/aaa-typescript-boilerplate/issues/171)

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
| `/architecture` | DDD, Hexagonal, Event-Driven, SOLID, and contract boundaries |
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

- pnpm installation and local startup;
- TypeScript service and Message Mediator contracts;
- OpenAPI 3.1 and AsyncAPI definitions;
- Fetch, Socket.IO, and gRPC clients;
- database driver selection, relationships, and Docker checks;
- PM2, Serverless, and quality-gate workflows.

Examples must evolve with actual scripts, contracts, and environment variables. Fictional examples
that cannot map to repository behavior are prohibited.

## Product Proof

The homepage uses the real Domain Designer canvas as full-bleed first-viewport media. The product
page uses the Jumentix mascot as an immediate brand signal. The product capture is stored at
`public/product/domain-designer.png`.

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
pnpm run website:storybook
pnpm run website:storybook:build
pnpm run website:storybook:smoke
pnpm --filter @jumentix/website run test:prepublish
```

The prepublish gate builds production output, starts it locally, validates commercial routes in
both languages, verifies changelog pagination and documentation routes, then stops the server.
