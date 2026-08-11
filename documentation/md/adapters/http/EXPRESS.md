# Express Adapter

## Glossary

- **Inbound adapter** — accepts external protocol calls and translates them into use-case calls.

## Responsibility in context

- **Stack layer:** adapter / http
- **Owns:** framework-specific wiring for this technology
- **Used with:** backend-template composition, persistence/SDK packages as needed, matching delivery guide
- **Not responsible for:** domain rules, OpenAPI authoring, or browser offline storage

## Why it exists

Framework choice should stay at the edge. This adapter keeps Express/Fastify/DB/realtime details replaceable.

## What it is

Express adapter for Jumentix http interfaces — mounts application use-cases without leaking framework types into the domain.

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
bun run dev:express
```

## Production

```bash
bun run prod:express
```

## Junior checklist (“I can …”)

- [ ] I know when to pick this adapter
- [ ] I can start it from the documented script
- [ ] I know the next guide/package to read

## Next step

Return to [Getting started](/docs/jumentix/concepts/getting-started) or the matching delivery guide.
