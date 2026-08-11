# Firebase Adapter

## Glossary

- **Inbound adapter** — accepts external protocol calls and translates them into use-case calls.

## Responsibility in context

- **Stack layer:** adapter / databases
- **Owns:** framework-specific wiring for this technology
- **Used with:** backend-template composition, persistence/SDK packages as needed, matching delivery guide
- **Not responsible for:** domain rules, OpenAPI authoring, or browser offline storage

## Why it exists

Framework choice should stay at the edge. This adapter keeps Express/Fastify/DB/realtime details replaceable.

## What it is

Firebase adapter for Jumentix databases interfaces — mounts application use-cases without leaking framework types into the domain.

## Technology

Firebase Admin profile.

## Build Services with Firebase

1. Start local emulator container (if configured):

```bash
bun run docker:up:firebase
```

2. Set env:

```bash
JUMENTIX_DATABASE_DRIVER=Firebase
JUMENTIX_FIREBASE_PROJECT_ID=jumentix-dev
JUMENTIX_FIREBASE_CREDENTIALS_JSON=./path/to/service-account.json
```

3. Start service adapter.

## Junior checklist (“I can …”)

- [ ] I know when to pick this adapter
- [ ] I can start it from the documented script
- [ ] I know the next guide/package to read

## Next step

Return to [Getting started](/docs/jumentix/concepts/getting-started) or the matching delivery guide.
