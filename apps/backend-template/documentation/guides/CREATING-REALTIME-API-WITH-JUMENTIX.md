# Creating Realtime API with Jumentix

This guide covers realtime service setup using WebSocket or gRPC with REST fallback.

## 1. Enable Realtime Runtime

Set env profile:

- `AAA_REALTIME_API=yes`
- `AAA_REALTIME_API_PROTOCOL=websocket` or `grpc`
- `AAA_HTTP_FRAMEWORK=express` for fallback REST documentation and operational fallback

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

## References

- [Realtime WebSocket API](../../../../documentation/md/adapters/realtime/WEBSOCKET-API.md)
- [Realtime gRPC API](../../../../documentation/md/adapters/realtime/GRPC-API.md)
- [WebSocket Realtime Contracts](../../../../documentation/md/contracts/WEBSOCKET-REALTIME-CONTRACTS.md)
- [gRPC Realtime Contracts](../../../../documentation/md/contracts/GRPC-REALTIME-CONTRACTS.md)
