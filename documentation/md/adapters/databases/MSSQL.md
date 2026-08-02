# SQL Server Adapter

## Technology

Sequelize + tedious profile.

## Build Services with SQL Server

1. Start container:

```bash
bun run docker:up:mssql
```

2. Set env:

```bash
JUMENTIX_DATABASE_DRIVER=MSSQL
JUMENTIX_DB_HOST=127.0.0.1
JUMENTIX_DB_PORT=1433
JUMENTIX_DB_NAME=jumentix
JUMENTIX_DB_USERNAME=sa
JUMENTIX_DB_PASSWORD=YourStrong!Passw0rd
```

3. Start service adapter.

