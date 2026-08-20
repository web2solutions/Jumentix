# @jumentix/message-mediator — usage guide

## Responsibility in context

- **Stack layer:** messaging / application adapter
- **Owns:** in-process and broker-backed publish/subscribe + request mediation
- **Used with:** backend use-cases; not a replacement for sdk-websocket-client in browsers
- **Not responsible for:** OpenAPI HTTP routing or database persistence

## What it is

`@jumentix/message-mediator` decouples **event publishers** from **handlers** and
supports **request/response** over named contracts. The in-memory adapter runs in
the browser and unit tests; RabbitMQ and BullMQ adapters target Node servers
selected by environment variables.

## Why it exists

Junior teams need one pattern for “something happened” (events) and “please do
this” (commands/queries) without wiring every module directly. The mediator lets
you prototype in-memory in a SPA, then deploy the same handler signatures behind
a broker — without rewriting business logic.

## Prerequisites

- **Runtime:** browser (in-memory) or Node/Bun (in-memory, RabbitMQ, or BullMQ).
- **Prior reading:** [Getting started](/docs/jumentix/concepts/getting-started)
  and basic async/await in JavaScript.
- **For brokers:** RabbitMQ URL or Redis connection env vars (see
  `compileMessageMediator` in the package).
- **Optional:** [shared-contracts](/docs/jumentix/packages/shared-contracts) for
  contract naming conventions in larger services.

## Glossary

| Term | Meaning |
| --- | --- |
| **Integration event** | Fire-and-forget notification: `{ name, payload, occurredAt, metadata? }`. |
| **Message** | Request payload: `{ contract, version?, payload, metadata? }`. |
| **Handler** | Function registered for a `contract` — returns `IMessageResponse`. |
| **Mediator** | Object implementing publish/subscribe **and** registerHandler/request. |
| **Contract** | Stable string id for a command or query (e.g. `users.create`). |
| **In-memory adapter** | `InMemoryMessageMediatorAdapter` — no durability, same process only. |
| **Broker adapter** | RabbitMQ or BullMQ — multi-process, survives restarts (Node only). |

## Steps

### 1. Install (< 5 minutes)

```bash
bun add @jumentix/message-mediator
```

### 2. First success — publish and subscribe (< 15 minutes)

```ts
import { InMemoryMessageMediatorAdapter } from '@jumentix/message-mediator';

const mediator = InMemoryMessageMediatorAdapter.compile();
const seen: string[] = [];

mediator.subscribe('demo.ping', async (event) => {
  seen.push(event.name);
});

await mediator.publish({
  name: 'demo.ping',
  payload: { hello: true },
  occurredAt: new Date().toISOString()
});

console.log(seen); // ['demo.ping']
```

**Verify success:** `seen.length === 1` after `publish` resolves.

### 3. Core workflow — request/response

Register a handler, then call `request`:

```ts
mediator.registerHandler('users.create', async (message) => ({
  result: { id: 'user-1', username: message.payload.username }
}));

const response = await mediator.request({
  contract: 'users.create',
  version: '1.0.0',
  payload: { username: 'ana' }
});

if (response.error) throw response.error;
console.log(response.result);
```

Handlers may be sync or async. Errors returned in `response.error` do not
throw unless your wrapper chooses to.

### 4. Core workflow — compile by environment

```ts
import { compileMessageMediator } from '@jumentix/message-mediator';

// JUMENTIX_MESSAGE_MEDIATOR_ADAPTER=inmemory | rabbitmq | bullmq
const mediator = compileMessageMediator();
```

| Adapter env | When to use |
| --- | --- |
| `inmemory` (default) | Local dev, browser demos, unit tests |
| `rabbitmq` / `rabbit` | Multi-service async messaging |
| `bullmq` / `bull` | Job queues backed by Redis |

Broker adapters require the documented env vars; missing URL throws at compile
time with a clear message.

### 5. Core workflow — timeouts and routing options

```ts
const response = await mediator.request(
  { contract: 'billing.charge', payload: { amount: 10 } },
  { timeoutMs: 5000, routeKey: 'billing-primary' }
);
```

Register handlers with matching `routeKey` or `queueName` in
`IMessageHandlerRegistrationOptions` when you need more than one consumer per
contract.

### 6. Full surface — API map

| Export | Role |
| --- | --- |
| `IMessageMediator` | Full port type |
| `IEventBus` | `publish` + `subscribe` only |
| `InMemoryMessageMediatorAdapter.compile()` | In-process mediator |
| `RabbitMqMessageMediatorAdapter` | RabbitMQ (Node) |
| `BullMqMessageMediatorAdapter` | BullMQ (Node) |
| `compileMessageMediator()` | Env-driven factory |
| Types: `IMessage`, `IMessageResponse`, `IIntegrationEvent`, `MessageHandler` | Typing handlers and payloads |

## Try it in the docs playground

<DocsPlayground runtime="message-mediator" id="getting-started" />

The playground stub uses topic-style subscribe/publish:

```js
const seen = [];
const mediator = api.createInMemory();
await mediator.subscribe('demo.ping', async (msg) => { seen.push(msg); });
await mediator.publish('demo.ping', { hello: true });
```

In production code, prefer `InMemoryMessageMediatorAdapter.compile()` with full
event objects and `registerHandler` / `request` for commands.

## When not to use in-memory

- **Multi-process workers** — each process has its own memory; events do not
  cross process boundaries.
- **Durable queues across deploys** — use RabbitMQ or BullMQ adapters on Node.

Keep broker adapters out of browser bundles.

## Common errors

| Symptom | Cause | Fix | Verify success |
| --- | --- | --- | --- |
| Handler never runs | Wrong event `name` or `contract` string | Match strings exactly; log registrations | `seen` or `response.result` populated |
| `No handler registered for contract …` | Missing `registerHandler` | Register before `request` | `response.error` absent |
| Request hangs until timeout | Handler never resolves | Return or reject from handler; set `timeoutMs` | Response within timeout |
| Events lost after refresh | In-memory adapter | Switch to broker adapter in Node | Event survives process restart |
| `JUMENTIX_RABBITMQ_URL is required` | Rabbit adapter without URL | Set env or use `inmemory` locally | `compileMessageMediator()` succeeds |

## Junior checklist (“I can …”)

- [ ] Publish an integration event and handle it with `subscribe`.
- [ ] Register a handler and complete a `request` / `response` round-trip.
- [ ] Explain why in-memory is fine for unit tests but not for multi-worker production.
- [ ] Select the correct adapter via `JUMENTIX_MESSAGE_MEDIATOR_ADAPTER`.
- [ ] Pass `timeoutMs` and handle `response.error` without crashing the caller.
- [ ] Describe the difference between an event (`publish`) and a command (`request`).

## Next step

Connect HTTP and realtime clients in the
[REST API guide](/docs/jumentix/guides/rest-api) and
[Realtime API guide](/docs/jumentix/guides/realtime-api), then return to
[Getting started](/docs/jumentix/concepts/getting-started) for the full
communication journey.