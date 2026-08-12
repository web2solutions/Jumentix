# @jumentix/sdk-websocket-client

AsyncAPI/Socket.IO client that sends the standard realtime request envelope.

## What it is

AsyncAPI/Socket.IO client that sends the standard realtime request envelope.

## Why it exists

Ad-hoc socket emit/ack code drifts from the AsyncAPI contract.

**When to use:** You need request/response over WebSocket against a Jumentix realtime gateway.

**When not to use:** Plain REST (sdk-rest-client) or Node gRPC (sdk-grpc-client).

## Responsibility in context

- **Stack layer:** SDK / realtime adapter (consumer)
- **Problem boundary it owns:** `WebSocketApiClient` connect/request helpers.
- **Used with:** shared-contracts for AsyncAPI load; server realtime adapters; message-mediator for in-process messaging.
- **Typical composition:** Realtime guide → gateway → this client in SPA/services.
- **Journeys:** [Realtime API guide](/docs/jumentix/guides/realtime-api).
- **Not responsible for:** Persisting data or rendering UI.

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
bun add @jumentix/sdk-websocket-client
```

### 2. First success (under 30 min)

```ts
import { WebSocketApiClient } from '@jumentix/sdk-websocket-client';

const client = new WebSocketApiClient('ws://localhost:3001');
client.connect();
const response = await client.request({
  operationId: 'createUser',
  input: { username: 'john', password: 'StrongPass#123' }
});
```

<DocsPlayground runtime="sdk-websocket-client" id="getting-started" />

### 3. Core workflows

### 1. Connect

Call `connect()` before requests.

### 2. Request with operationId

Use the AsyncAPI operation identifiers.

### 3. Reconnect policy

Handle disconnects in the app shell — do not ignore socket errors.


### 4. Full practical surface (exports)

- `WebSocketApiClient`

Use exports from application/adapters layers as described above — not from domain entities.

## Common errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| Timeout waiting for ack | Server down or wrong path | Confirm `/ws` gateway and env ports. |

**Verify success:** the first-success snippet runs (or typechecks against your service) and your use-case depends only on ports.

## Junior checklist (“I can …”)

- [ ] I can connect and complete one operationId request
- [ ] I know when to pick WebSocket vs REST

## Next step

Continue with [sdk-grpc-client](/docs/jumentix/packages/sdk-grpc-client).
