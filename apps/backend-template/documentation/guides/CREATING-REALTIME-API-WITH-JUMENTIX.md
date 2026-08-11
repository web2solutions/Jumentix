# Creating Realtime API with Jumentix

## What it is

This guide covers enabling **push and bidirectional communication** on top of the
backend template using WebSocket (browser-friendly) or gRPC (server-to-server), with
REST kept as an operational fallback.

## Why it exists

Many products need live updates — chat, notifications, dashboards — but teams bolt
WebSocket code onto REST controllers and lose contract alignment. Jumentix treats
**AsyncAPI like OpenAPI**: channels and payloads are specified first, handlers invoke
the same controllers and use cases as REST, and degraded realtime falls back to HTTP.

## Prerequisites

| Item | Required | Notes |
| --- | --- | --- |
| Bun 1.3.14+ | Yes | [Getting started](/docs/jumentix/concepts/getting-started) |
| Working REST profile | Recommended | Complete [REST guide](/docs/jumentix/guides/rest-api) first |
| AsyncAPI specs | Yes | Under `spec/` alongside OpenAPI |
| Env file | Yes | `apps/backend-template/src/config/.env.dev` |

## Glossary

| Term | Meaning on this page |
| --- | --- |
| **Realtime API** | Non-HTTP primary interface — WebSocket or gRPC — for push/pull messaging. |
| **AsyncAPI** | Spec describing channels, messages, and payload schemas for realtime. |
| **WebSocket** | Browser-friendly persistent connection; default protocol for SPAs. |
| **gRPC** | Binary RPC protocol; use for service-to-service, not browser clients. |
| **REST fallback** | HTTP endpoints still available when realtime channel is down or unsupported. |
| **Message handler** | Adapter code receiving a message, calling a controller, replying on same correlation id. |
| **Correlation id** | Token linking a client request to its response on the same socket. |
| **JUMENTIX_REALTIME_API** | Env flag `yes`/`no` enabling realtime startup profile. |

## Numbered steps

### Step 1 — Enable the realtime runtime profile (< 5 minutes)

1. Edit your env file:

```bash
JUMENTIX_REALTIME_API=yes
JUMENTIX_REALTIME_API_PROTOCOL=websocket   # or grpc
JUMENTIX_HTTP_FRAMEWORK=express            # REST fallback + docs
```

2. Start the matching dev profile from monorepo root:

```bash
# WebSocket + REST fallback (start here for browser apps)
bun run dev:websocket

# gRPC + REST fallback (Node service mesh)
bun run dev:grpc
```

From `apps/backend-template` you can also run `bun run dev:websocket-rest` or
`bun run dev:grpc-rest`.

**Success check:** PM2 shows the websocket or grpc process online; REST `/health`
still responds.

### Step 2 — Define Async contracts (< 15 minutes)

1. Add or update AsyncAPI files under `spec/` — define **channels**, **messages**,
   and payload schemas.
2. Align payload shapes with domain models and controller method signatures.
3. Reference shared error/response contracts in handler implementations — same types
   as REST DTOs where possible.
4. Cross-check [Events and messages](/docs/jumentix/reference/events-messages) for
   naming conventions.

**Success check:** AsyncAPI channel names match handler registrations; no orphan messages.

### Step 3 — Implement message handlers (< 30 minutes)

**WebSocket path (browser apps):**

1. Handler receives framed message on a channel.
2. Handler parses payload → calls controller method.
3. Handler sends response on the **same client connection** using the message correlation id.

**gRPC path (Node-to-Node):**

1. gRPC service method receives protobuf request.
2. Invokes the same controller used by REST.
3. Returns protobuf response mapped from domain result.

Rule: **controllers and use cases stay identical** — only adapter code differs from REST.

**Success check:** unit/integration test invokes handler without starting full cluster.

### Step 4 — Keep REST fallback available (< 5 minutes)

Realtime services always run with REST as a secondary interface:

- Operational tools and degraded mode use REST endpoints.
- OpenAPI docs remain the backup contract when sockets fail.
- Do not delete REST routes when adding realtime — clients may downgrade gracefully.

**Success check:** with realtime process stopped, REST endpoints still serve critical reads.

### Step 5 — Validate realtime stability (< 10 minutes)

From monorepo root:

```bash
bun run test:integration:realtime
bun run test:smoke:realtime
```

For Redis-backed Socket.IO scaling (optional advanced path):

```bash
bun run test:integration:realtime:redis-streams
```

**Success check:** both commands exit 0; smoke test covers connect → message → response.

### Step 6 — Client integration (junior path)

**Prefer WebSocket for browser apps.** gRPC stays Node-to-Node — use static snippets
on the [gRPC adapter](/docs/jumentix/adapters/realtime/grpc-api) page, not a browser Run button.

Static subscribe pattern:

```js
const ws = api.createMockClient();
const sub = await ws.subscribe({ channel: 'notifications' });
sub.on('message', (msg) => console.log(msg.payload));
```

## Examples

### Interactive WebSocket client playground

<DocsPlayground runtime="sdk-websocket-client" id="getting-started" />

**Success check:** **Run** connects mock client, receives a message; **Reset** clears state.

## Common errors

| Symptom | Likely cause | Fix | Verify success |
| --- | --- | --- | --- |
| Realtime starts but REST 404 | HTTP adapter not loaded in combined profile | Keep `JUMENTIX_HTTP_FRAMEWORK=express`; use `dev:websocket` not raw socket only | `/health` returns 200 |
| Handler never replies | Missing correlation id on response | Echo client message id in adapter reply | Integration test green |
| Browser cannot use gRPC | gRPC is not a browser protocol | Use WebSocket for SPA; gRPC for backend services | WS playground Run green |
| `test:integration:realtime` fails on grpc | Wrong `JUMENTIX_REALTIME_API_PROTOCOL` | Match env to script (`websocket` vs `grpc`) | Target protocol test passes |
| Duplicate message handling | Handler registered twice | One registration per channel in adapter bootstrap | Single response per send |
| Redis streams test skipped | `RUN_REDIS_INTEGRATION` not set | Start redis compose; set env flag | redis-streams integration green |

## Junior checklist (“I can …”)

- [ ] Set `JUMENTIX_REALTIME_API=yes` and choose `websocket` or `grpc`.
- [ ] Start `bun run dev:websocket` and confirm REST fallback still works.
- [ ] Locate AsyncAPI under `spec/` and name one channel and its payload schema.
- [ ] Trace one message: adapter handler → controller → use case.
- [ ] Run `bun run test:integration:realtime` and `bun run test:smoke:realtime`.
- [ ] Use the sdk-websocket-client playground (**Run** green).
- [ ] Explain when to choose gRPC instead of WebSocket.

## Next step

Build the frontend that consumes these channels in
[Create a SPA or Offline PWA](/docs/jumentix/guides/spa-pwa). For adapter details,
see [WebSocket adapter](/docs/jumentix/adapters/realtime/websocket-api) and
[gRPC adapter](/docs/jumentix/adapters/realtime/grpc-api).
