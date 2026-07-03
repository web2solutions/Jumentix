# Fastify Adapter

## Purpose

Use Fastify as your REST inbound adapter with Fastify-native server features.

## Entrypoints

- `apps/backend-template/src/interface/HTTP/adapters/fastify/fastify.ts`
- `apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts`

## Build a Service with Fastify

1. Keep business logic in domain/use cases.
2. Implement Fastify handlers in module interface framework folder.
3. Run:

```bash
npm run dev:fastify
```

## Production

```bash
npm run prod:fastify
```

