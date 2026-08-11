# Creating Realtime API with Jumentix

This guide covers realtime service setup using WebSocket or gRPC with REST fallback.

## 1. Enable Realtime Runtime

Set env profile:

- `JUMENTIX_REALTIME_API=yes`
- `JUMENTIX_REALTIME_API_PROTOCOL=websocket` or `grpc`
- `JUMENTIX_HTTP_FRAMEWORK=express` for fallback REST documentation and operational fallback

Start runtime profile:

```bash
bun run dev:websocket
# or
bun run dev:grpc
```

## 2. Define Async Contracts

1. Define channels/messages in AsyncAPI files under `spec/`.
2. Keep payload contracts aligned with domain models and controller method signatures.
3. Reference response/error contracts in handler implementations.

## 3. Implement Message Handlers

- WebSocket handlers receive messages, invoke controller methods, and answer back to the same client/message correlation.
- gRPC handlers receive requests, invoke controller methods, and return protocol-native responses.

## 4. Keep REST Fallback Available

Realtime services run with REST as secondary interface. Use REST docs and endpoints if realtime channel is degraded.

## 5. Validate Realtime Stability

```bash
bun run test:integration:realtime
bun run test:smoke:realtime
```

## 6. Client playground (WebSocket)

Prefer WebSocket for browser apps. gRPC stays Node-to-Node — use static snippets
on the gRPC adapter page, not a browser Run button.

<DocsPlayground runtime="sdk-websocket-client" id="getting-started" />

## Next steps

1. [Getting started](/docs/jumentix/concepts/getting-started)
2. [REST guide](/docs/jumentix/guides/rest-api) (fallback)
3. [WebSocket adapter](/docs/jumentix/adapters/realtime/websocket-api)
4. [gRPC adapter](/docs/jumentix/adapters/realtime/grpc-api) (Node-only)

## References

- WebSocket adapter: [/docs/jumentix/adapters/realtime/websocket-api](/docs/jumentix/adapters/realtime/websocket-api)
- gRPC adapter: [/docs/jumentix/adapters/realtime/grpc-api](/docs/jumentix/adapters/realtime/grpc-api)
- Events map: [/docs/jumentix/reference/events-messages](/docs/jumentix/reference/events-messages)
