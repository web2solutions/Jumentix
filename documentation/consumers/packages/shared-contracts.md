# @jumentix/shared-contracts

Loads the canonical OpenAPI/AsyncAPI documents so SDK clients share one spec-resolution path.

## What it is

Loads the canonical OpenAPI/AsyncAPI documents so SDK clients share one spec-resolution path.

## Why it exists

Each SDK copied walk-up logic to find `spec/` files; copies drifted and failed differently.

**When to use:** You use Jumentix SDKs or need to resolve the canonical spec from a package/app.

**When not to use:** You are authoring domain entities or offline IndexedDB schemas.

## Responsibility in context

- **Stack layer:** contracts / SDK support
- **Problem boundary it owns:** `loadCanonicalSpec` and `candidateSpecPaths`.
- **Used with:** Consumed by sdk-rest-client, sdk-websocket-client, sdk-grpc-client.
- **Typical composition:** SDK constructor → shared-contracts loads spec → client maps operationId.
- **Journeys:** REST / Realtime guides.
- **Not responsible for:** Performing HTTP/WebSocket/gRPC calls.

## Prerequisites

- Bun 1.3.14+ (monorepo pin) or the Node runtime your service already uses
- Read [Getting started](/docs/jumentix/concepts/getting-started) first
- Basic TypeScript modules/`import` knowledge

## Glossary

- **Port** — TypeScript contract the application depends on (no vendor types).
- **Adapter** — Concrete implementation that talks to a driver, broker, or protocol.
- **Composition root** — Process startup code that wires env → adapters → use-cases.

## Numbered steps

### 1. Install

```bash
bun add @jumentix/shared-contracts
```

### 2. First success (<30 min)

```ts
import { loadCanonicalSpec } from '@jumentix/shared-contracts';

const spec = await loadCanonicalSpec({
  // Prefer explicit base path in apps; walk-up is for monorepo ergonomics.
});
```


### 3. Core workflows

### 1. Load OpenAPI for REST

Point at `spec/1.0.0.yml` (or project equivalent).

### 2. Load AsyncAPI for realtime

Use websocket/grpc asyncapi documents.

### 3. Fail closed on missing spec

Prefer descriptive errors over silent empty clients.


### 4. Full practical surface (exports)

- `loadCanonicalSpec`
- `candidateSpecPaths`

Use exports from application/adapters layers as described above — not from domain entities.

## Common errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| Cannot find spec | Wrong cwd / missing file | Pass an explicit base path from the app root. |

**Verify success:** the first-success snippet runs (or typechecks against your service) and your use-case depends only on ports.

## Junior checklist (“I can …”)

- [ ] I can explain why SDKs depend on this package
- [ ] I can load a spec without duplicating walk-up code

## Next step

Continue with [sdk-rest-client](/docs/jumentix/packages/sdk-rest-client).
