# InMemory Database Adapter

## Purpose

Default official adapter for local development and deterministic tests.

## Entrypoints

- `apps/backend-template/src/infra/persistence/InMemoryDatabase/InMemoryDbClient.ts`
- `apps/backend-template/src/infra/persistence/compileDatabaseClient.ts`

## Build Services with InMemory

1. Set env:

```bash
JUMENTIX_DATABASE_DRIVER=InMemory
```

2. Start API adapter.
3. Repositories will use `dbClient.stores` contract.

