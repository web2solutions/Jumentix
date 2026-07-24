# Realtime API Testing Guide

This document defines the official test matrix for realtime interfaces (`WebSocketAPI` and `gRPCAPI`).

## Scope

Covered interfaces:

- `apps/backend-template/src/interface/WebSocket/WebSocketAPI.ts`
- `apps/backend-template/src/interface/gRPC/gRPCAPI.ts`
- Socket.IO horizontal adapters:
  - `cluster`
  - `redis-streams`

## Test Matrix

## 1) Unit Tests

WebSocket:

- `apps/backend-template/test/unit/interface/WebSocket/WebSocketAPI.test.ts`
- `apps/backend-template/test/unit/interface/WebSocket/adapters/start-websocket-api.test.ts`
- `apps/backend-template/test/unit/interface/WebSocket/adapters/socket-io.bootstrap.test.ts`
- `apps/backend-template/test/unit/interface/WebSocket/clusterAdapter.test.ts`
- `apps/backend-template/test/unit/interface/WebSocket/redisStreamsAdapter.test.ts`

gRPC:

- `apps/backend-template/test/unit/interface/gRPC/gRPCAPI.test.ts`
- `apps/backend-template/test/unit/interface/gRPC/adapters/start-grpc-api.test.ts`
- `apps/backend-template/test/unit/interface/gRPC/adapters/grpc.bootstrap.test.ts`

Shared realtime core:

- `apps/backend-template/test/unit/interface/Async/RealtimeAPIBase.test.ts`

Run:

```bash
pnpm run test:unit
```

## 2) Integration Tests

Protocol-level integration:

- `apps/backend-template/test/integration/realtime/websocket.basic.integration.test.ts`
- `apps/backend-template/test/integration/realtime/grpc.basic.integration.test.ts`

Redis multi-instance integration:

- `apps/backend-template/test/integration/realtime/socketio.redis-streams.multi-instance.test.ts`

Run basic realtime integrations:

```bash
pnpm run test:integration:realtime
```

Run Redis multi-instance integration (requires Redis):

```bash
pnpm run test:integration:realtime:redis-streams
```

## 3) Smoke Tests

Local realtime smoke:

- `apps/backend-template/test/smoke/realtime/RealtimeApis.smoke.test.ts`

Run:

```bash
pnpm run test:smoke:realtime
```

End-to-end Redis smoke (Docker + multi-instance + cleanup):

```bash
pnpm run smoke:realtime:redis-streams
```

## CI Behavior

- Realtime basic integration and smoke tests are runnable without external Redis.
- Redis-backed multi-instance test is gated by `RUN_REDIS_INTEGRATION=1`.
- Jest ignore policy excludes only `socketio.redis-streams.multi-instance.test.ts` when Redis integration is disabled.

## Operational Notes

1. Keep realtime tests `--coverage=false` for smoke/integration scripts.
2. Maintain deterministic fixed ports for isolated test files.
3. Always close socket clients and stop server instances in `afterAll`.
4. Update this file and `.agents` requirements whenever realtime transport behavior changes.

