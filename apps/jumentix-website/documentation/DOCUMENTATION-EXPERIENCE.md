# Documentation Experience

Issue tracking:

- Epic: [#167](https://github.com/web2solutions/Jumentix/issues/167)
- Task: [#172](https://github.com/web2solutions/Jumentix/issues/172)

## Product Goal

The Jumentix documentation portal is the technical product surface for engineers evaluating,
building, and operating Jumentix applications. It combines the discoverability expected from a
mature open-source framework with source-level traceability to the monorepo.

## Information Architecture

| Section | Reader question | Typical content |
| --- | --- | --- |
| Concepts | Why does Jumentix work this way? | Architecture, domains, contracts, event-driven design |
| Guides | How do I build a product? | REST, realtime, SPA/PWA, monolith, microservices |
| Adapters | Which runtime or infrastructure should I use? | HTTP, database, and realtime adapters |
| Packages | Which reusable library should I install? | Message mediator, runtime bootstrap, SDK packages |
| Reference | What is the exact behavior? | Runtime contracts, commands, security, entities, events |

Canonical English routes start at `/docs/jumentix`. Portuguese routes preserve the same hierarchy
under `/docs/pt-BR/jumentix`.

## Navigation Contract

The documentation shell includes:

- product-aware header with direct links to Concepts, Guides, Adapters, and Packages;
- responsive hierarchical sidebar;
- full-text search;
- page table of contents and back-to-top control;
- previous and next page navigation;
- repository edit and issue-feedback links;
- dark/light theme control;
- locale switching that retains the current document path;
- shared commercial footer for product and community journeys.

Legacy routes remain supported by the documentation loader and resolve to canonical pages.

## Code And Technical Proof

Markdown fenced code is rendered as syntax-highlighted code widgets. Public examples must use real
Jumentix package names, scripts, environment variables, message contracts, and API shapes. The
pipeline does not invent examples to fill empty pages.

## Bilingual Source Model

Explicit guides and concepts define English and Portuguese sources in
`config/content-sources.json`. Collections discover component documentation recursively and require
a sibling `.pt-BR.md` document for every English `.md` source.

The generated trees are deterministic:

```text
content/
├── jumentix/
│   ├── concepts/
│   ├── guides/
│   ├── adapters/
│   ├── packages/
│   └── reference/
└── pt-BR/jumentix/
    └── <matching hierarchy>
```

## Publication Gates

```bash
bun run --filter @jumentix/website content:sync
bun run --filter @jumentix/website content:smoke
bun run --filter @jumentix/website storybook:build
bun run --filter @jumentix/website storybook:smoke
bun run --filter @jumentix/website test:prepublish
```

`content:smoke` validates locale parity, required routes, frontmatter, MDX-safe output, and generated
link integrity. `test:prepublish` builds the production application and exercises commercial,
canonical documentation, compatibility, API, and internal-link routes against the running server.

## Adding Documentation

1. Write the English consumer document next to the owning component.
2. Add the `.pt-BR.md` translation with the same source-relative location.
3. Add an explicit entry or collection to `config/content-sources.json`.
4. Run the content and prepublication gates.
5. Update Storybook when the change introduces a reusable documentation UI state.
6. Associate the documentation change with its GitHub task, epic, milestone, commit, and PR.
