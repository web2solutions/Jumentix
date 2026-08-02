# Oracle Adapter

## Technology

Sequelize + Oracle profile.

## Build Services with Oracle

1. Start container:

```bash
bun run docker:up:oracle
```

2. Set env:

```bash
JUMENTIX_DATABASE_DRIVER=Oracle
JUMENTIX_DB_HOST=127.0.0.1
JUMENTIX_DB_PORT=1521
JUMENTIX_DB_NAME=XE
JUMENTIX_DB_USERNAME=system
JUMENTIX_DB_PASSWORD=oracle
```

3. Start service adapter.

