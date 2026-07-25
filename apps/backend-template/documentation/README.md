# Backend Template Documentation Hub

This is the technical documentation hub for the backend template application used by Jumentix to bootstrap backend services.

## Index

- Guides
  - [Creating REST API with Jumentix](./guides/CREATING-REST-API-WITH-JUMENTIX.md)
  - [Creating Realtime API with Jumentix](./guides/CREATING-REALTIME-API-WITH-JUMENTIX.md)
- Architecture and structure
  - [Architecture and Structure](../../../documentation/md/ARCHITECTURE-AND-STRUCTURE.md)
  - [Hexagonal Feature-Driven Migration](../../../documentation/md/HEXAGONAL-FEATURE-DRIVEN-MIGRATION.md)
- Runtime and adapters
  - [Runtime Environment Contracts](../../../documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md)
  - [HTTP Adapters](../../../documentation/md/adapters/http/README.md)
  - [Realtime WebSocket API](../../../documentation/md/adapters/realtime/WEBSOCKET-API.md)
  - [Realtime gRPC API](../../../documentation/md/adapters/realtime/GRPC-API.md)
- Data and persistence
  - [Database Adapters](../../../documentation/md/adapters/databases/README.md)
  - [Database Drivers Smoke Tests](../../../documentation/md/DATABASE-DRIVERS-SMOKE-TESTS.md)
- Contracts and quality
  - [OpenAPI Spec](../../../spec/1.0.0.yml)
  - [Events and Messages Map](../../../documentation/md/EVENTS-AND-MESSAGES-MAP.md)
  - [Error Contracts and Responses](../../../documentation/md/ERROR-CONTRACTS-AND-RESPONSES.md)
  - [Testing, CI and Quality](../../../documentation/md/TESTING-CI-AND-QUALITY.md)

## What This Component Delivers

- Contract-first backend services with OpenAPI 3.1 and AsyncAPI.
- DDD + Hexagonal architecture baseline for modular monolith and microservice evolution.
- Runtime adapter matrix for REST, realtime, and serverless contexts.
- Pluggable persistence and messaging layers through shared `@jumentix/*` packages.

## Main Entrypoints

- REST runtime loaders and adapters in `apps/backend-template/src/interface/HTTP`.
- Realtime runtime loaders and adapters in `apps/backend-template/src/interface/WebSocket` and `apps/backend-template/src/interface/gRPC`.
- PM2 profiles from repo root `pm2/` for dev/staging/production process orchestration.

## Architecture Snapshot

- Domain modules expose use cases and controllers through inbound adapters.
- Outbound concerns (database, key-value, messaging) are injected via shared runtime packages.
- API contracts are OpenAPI-first for REST and AsyncAPI-first for realtime channels.

## Integration Examples

REST profile with explicit framework selection:

```bash
AAA_HTTP_FRAMEWORK=fastify pnpm run dev:http
```

WebSocket + REST fallback profile:

```bash
AAA_REALTIME_API=yes AAA_REALTIME_API_PROTOCOL=websocket pnpm run dev:websocket
```

gRPC + REST fallback profile:

```bash
AAA_REALTIME_API=yes AAA_REALTIME_API_PROTOCOL=grpc pnpm run dev:grpc
```
