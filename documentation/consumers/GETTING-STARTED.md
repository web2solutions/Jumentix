# Getting started with Jumentix

Jumentix is a **software factory framework**: you describe contracts and domain
rules once, then generate and run REST, realtime, and offline clients around the
same core. This page is the on-ramp for junior developers.

## What you will build

In one afternoon you should be able to:

1. Install the toolchain (Bun).
2. Understand the mental model (hexagonal + contracts).
3. Follow the REST guide to expose an API.
4. Follow the realtime and SPA/PWA guides when you need sockets or offline.
5. Pick packages from the packages map without leaving this site.

## Prerequisites

- **Bun 1.3.14+** (pinned in the monorepo)
- Node 22 only if a tool still requires it
- A terminal and a code editor

```bash
curl -fsSL https://bun.sh/install | bash
bun --version
```

## Mental model (keep this picture)

```
[ Adapters ]  Express / Fastify / Socket.IO / gRPC / IndexedDB (Cana)
      ↓
[ Application ] use-cases, ports
      ↓
[ Domain ] entities, rules, events
```

- **Contracts first** — OpenAPI / AsyncAPI / shared packages describe the shape.
- **Adapters are replaceable** — swap Express for Fastify without rewriting domain code.
- **Offline is first-class** — `@jumentix/cana` is the IndexedDB adapter for PWAs.

## Install the monorepo (contributors / local factory)

```bash
git clone <your-fork-or-checkout>
cd Jumentix
bun install
```

For product teams consuming published packages:

```bash
bun add @jumentix/cana @jumentix/sdk-rest-client
```

## Your first journey (recommended order)

### 1. Concepts

Read [Jumentix Overview](/docs/jumentix/concepts/overview) and
[Architecture](/docs/jumentix/concepts/architecture). Skim once — come back when
a term appears in a guide.

### 2. Create a REST API

Follow [Create a REST API](/docs/jumentix/guides/rest-api). You will:

- start from OpenAPI
- wire a use-case
- mount an HTTP adapter
- call it with `@jumentix/sdk-rest-client` (playground on that page)

### 3. Add realtime when you need push

Follow [Create a Realtime API](/docs/jumentix/guides/realtime-api). Prefer
WebSocket first; treat gRPC as a server-to-server follow-up.

### 4. Build a SPA / offline PWA

Follow [Create a SPA or Offline PWA](/docs/jumentix/guides/spa-pwa). Use
`@jumentix/designer-core` for design documents and `@jumentix/cana` for IndexedDB.

Try Cana now:

<DocsPlayground runtime="cana" id="getting-started" />

### 5. Browse packages

Open [Packages](/docs/jumentix/packages). Look for **Try it** playgrounds on
interactive packages (Cana, designer-core, KV, mutex, mediator, REST/WS SDKs).
Node-only packages stay as deep reference docs with copy-paste snippets.

## Common mistakes (read before you debug)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `TransactionInactive` in Cana | `await fetch` inside a transaction | Only await IndexedDB work inside the tx |
| REST client cannot load specs | Node `fs` loader in the browser | Inject the OpenAPI object (see REST guide playground) |
| “It works in memory but not in Redis” | Wrong KV adapter | Start with InMemory in tests; compile Redis only in Node |
| Lost offline data | Expecting localStorage = IndexedDB | Read `client.backend` after `open()` |

## How this documentation is organized

1. **Concepts** — vocabulary and architecture
2. **Guides** — task tutorials (this is where you spend time)
3. **Adapters** — HTTP / databases / realtime choices
4. **Packages** — APIs and playgrounds
5. **Reference** — errors, events, runtime env, scripts

Machine-readable maps for AI agents:

- [/llms.txt](/llms.txt)
- [/docs-index.json](/docs-index.json)

## Next step

Go to [Create a REST API](/docs/jumentix/guides/rest-api) and complete the
hello-world path end to end.
