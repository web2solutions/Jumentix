# PostgreSQL Adapter

## Technology

Sequelize-based SQL client profile.

## Build Services with PostgreSQL

1. Start container:

```bash
bun run docker:up:postgresql
```

2. Set env:

```bash
JUMENTIX_DATABASE_DRIVER=PostgreSQL
JUMENTIX_DB_HOST=127.0.0.1
JUMENTIX_DB_PORT=5432
JUMENTIX_DB_NAME=jumentix
JUMENTIX_DB_USERNAME=postgres
JUMENTIX_DB_PASSWORD=postgres
```

3. Start service adapter (`dev:*` command).

