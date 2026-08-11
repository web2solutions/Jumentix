# LoopBack Adapter

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

Loopback adapter for Jumentix http interfaces — mounts application use-cases without leaking framework types into the domain.

## Purpose

Run API operations with LoopBack runtime integration.

## Entrypoints

- `apps/backend-template/src/interface/HTTP/adapters/loopback/loopback.ts`

## Build a Service with LoopBack

1. Keep business/use-case contracts in module layer.
2. Use LoopBack adapter bootstrap to expose routes/handlers.
3. Run:

```bash
bun run dev:loopback
```

## Junior checklist (“I can …”)

- [ ] I know when to pick this adapter
- [ ] I can start it from the documented script
- [ ] I know the next guide/package to read

## Next step

Return to [Getting started](/docs/jumentix/concepts/getting-started) or the matching delivery guide.
