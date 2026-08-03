# Database Drivers Smoke Tests

This boilerplate now supports runtime selection of multiple database drivers through `JUMENTIX_DATABASE_DRIVER`, and includes smoke tests and per-database Docker compose files to validate adapter boot lifecycle (`connect` / `disconnect`) in local/dev/staging/prod-like environments.

## Supported Drivers

- `InMemory`
- `Mongo`
- `PostgreSQL`
- `MySQL`
- `MSSQL`
- `Oracle`
- `SQLite`
- `DynamoDB`
- `Cassandra`
- `Firebase`
- `Aurora`
- `RDS`

## Runtime Client Compilation

- Source: `apps/backend-template/src/infra/persistence/compileDatabaseClient.ts`
- External stores now use fail-fast proxies (`apps/backend-template/src/infra/persistence/external/ExternalStoreProxy.ts`) instead of silently reusing in-memory stores.
- Oracle has dedicated connector support (`apps/backend-template/src/infra/persistence/external/OracleRepository.ts`).
- Bootstrap adapters that inject `IDatabaseClient` from `JUMENTIX_DATABASE_DRIVER`:
  - `apps/backend-template/src/interface/HTTP/adapters/*`
  - `apps/backend-template/src/interface/WebSocket/adapters/socket-io/socket-io.ts`
  - `apps/backend-template/src/interface/gRPC/adapters/grpc/grpc.ts`
  - `apps/backend-template/src/modules/Users/interface/restapi/frameworks/aws/lambda/handlers/runtime.ts`

## Smoke Test Suite

- Test file: `apps/backend-template/test/smoke/database/DatabaseDrivers.smoke.test.ts`
- Run all configured smoke drivers:

```bash
pnpm run test:smoke:db:all
```

- Run one driver only:

```bash
pnpm run test:smoke:db:postgresql
pnpm run test:smoke:db:mysql
pnpm run test:smoke:db:mssql
pnpm run test:smoke:db:oracle
pnpm run test:smoke:db:mongo
pnpm run test:smoke:db:cassandra
pnpm run test:smoke:db:dynamodb
pnpm run test:smoke:db:firebase
pnpm run test:smoke:db:aurora
pnpm run test:smoke:db:rds
pnpm run test:smoke:db:sqlite
pnpm run test:smoke:db:inmemory
```

### Driver Filter

`JUMENTIX_DB_SMOKE_DRIVERS` accepts a comma-separated list and controls which smoke cases run.

Example:

```bash
JUMENTIX_DB_SMOKE_DRIVERS=PostgreSQL,MySQL pnpm run test:smoke:db
```

## Docker Compose Files Per Database

- `apps/backend-template/docker-compose-postgresql.yml`
- `apps/backend-template/docker-compose-mysql.yml`
- `apps/backend-template/docker-compose-mssql.yml`
- `apps/backend-template/docker-compose-oracle.yml`
- `apps/backend-template/docker-compose-mongodb.yml`
- `apps/backend-template/docker-compose-cassandra.yml`
- `apps/backend-template/docker-compose-dynamodb.yml`
- `apps/backend-template/docker-compose-firebase.yml`
- `apps/backend-template/docker-compose-aurora.yml`
- `apps/backend-template/docker-compose-rds.yml`

## One-command DB smoke workflows

Each workflow starts container -> runs smoke test -> stops container:

```bash
pnpm run smoke:db:postgresql
pnpm run smoke:db:mysql
pnpm run smoke:db:mssql
pnpm run smoke:db:oracle
pnpm run smoke:db:mongodb
pnpm run smoke:db:cassandra
pnpm run smoke:db:dynamodb
pnpm run smoke:db:firebase
pnpm run smoke:db:aurora
pnpm run smoke:db:rds
```

## Environment Variables

Add/update these keys in `apps/backend-template/src/config/.env.*` for driver-specific runtime:

- `JUMENTIX_DATABASE_DRIVER`
- `JUMENTIX_DATABASE_CONNECTION_URL`
- `JUMENTIX_DATABASE_NAME`
- `JUMENTIX_DATABASE_DIALECT`
- `JUMENTIX_DATABASE_REGION`
- `JUMENTIX_DATABASE_ENDPOINT`
- `JUMENTIX_DATABASE_PROJECT_ID`
- `JUMENTIX_DATABASE_CASSANDRA_CONTACT_POINTS`
- `JUMENTIX_DATABASE_CASSANDRA_DATACENTER`
- `JUMENTIX_DATABASE_POOL_MAX`
- `JUMENTIX_DATABASE_POOL_MIN`
- `JUMENTIX_DATABASE_POOL_ACQUIRE_MS`
- `JUMENTIX_DATABASE_POOL_IDLE_MS`
- `JUMENTIX_DATABASE_POOL_EVICT_MS`
- `JUMENTIX_DATABASE_USER`
- `JUMENTIX_DATABASE_PASSWORD`
- `JUMENTIX_DATABASE_CONNECT_STRING`

## Operational Note

If Docker daemon is not available, smoke scripts that need containers will fail at startup. In that case:

1. Start Docker Desktop/daemon.
2. Re-run the `smoke:db:*` command.
3. For CI environments without Docker, keep `test:smoke:db:inmemory` and unit tests as baseline checks.
