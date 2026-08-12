# MySQL Adapter

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

Mysql adapter for Jumentix databases interfaces — mounts application use-cases without leaking framework types into the domain.

## Technology

Sequelize + mysql2 profile.

## Build Services with MySQL

1. Start container:

```bash
bun run docker:up:mysql
```

2. Set env:

```bash
JUMENTIX_DATABASE_DRIVER=MySQL
JUMENTIX_DB_HOST=127.0.0.1
JUMENTIX_DB_PORT=3306
JUMENTIX_DB_NAME=jumentix
JUMENTIX_DB_USERNAME=root
JUMENTIX_DB_PASSWORD=root
```

3. Start your API adapter.

## Junior checklist (“I can …”)

- [ ] I know when to pick this adapter
- [ ] I can start it from the documented script
- [ ] I know the next guide/package to read

## Next step

Return to [Getting started](/docs/jumentix/concepts/getting-started) or the matching delivery guide.
