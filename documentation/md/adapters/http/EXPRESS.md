# Express Adapter

## Purpose

Use Express as your REST inbound adapter.

## Entrypoints

- `apps/backend-template/src/interface/HTTP/adapters/express/express.ts`
- `apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts` (environment-driven bootstrap)

## Build a Service with Express

1. Implement domain/use cases/controllers in modules.
2. Add framework handlers for operations in module interface layer.
3. Start with:

```bash
pnpm run dev:express
```

## Production

```bash
pnpm run prod:express
```

