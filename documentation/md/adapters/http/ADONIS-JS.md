# Adonis.js Adapter

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

Adonis Js adapter for Jumentix http interfaces — mounts application use-cases without leaking framework types into the domain.

## Purpose

Expose API operations through Adonis.js runtime bridge.

## Entrypoints

- `apps/backend-template/src/interface/HTTP/adapters/adonis-js/adonis-js.ts`

## Build a Service with Adonis.js

1. Keep modules framework-agnostic.
2. Bridge Adonis request handling to controller operations.
3. Run:

```bash
bun run dev:adonis-js
```

## Junior checklist (“I can …”)

- [ ] I know when to pick this adapter
- [ ] I can start it from the documented script
- [ ] I know the next guide/package to read

## Next step

Return to [Getting started](/docs/jumentix/concepts/getting-started) or the matching delivery guide.
