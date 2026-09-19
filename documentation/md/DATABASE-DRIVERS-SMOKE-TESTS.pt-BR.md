<!--
Arquivo gerado automaticamente a partir de: documentation/md/DATABASE-DRIVERS-SMOKE-TESTS.md
Idioma alvo: Português (Brasil)
-->
# Testes de fumaça de drivers de banco de dados

Este padrão agora oferece suporte à seleção em tempo de execução de vários drivers de banco de dados por meio de `JUMENTIX_DATABASE_DRIVER` e inclui testes de fumaça e arquivos de composição do Docker por banco de dados para validar o ciclo de vida de inicialização do adaptador (`connect` / `disconnect`) em ambientes locais/dev/staging/prod-like.

## Drivers Suportados

- `InMemory`
- `Mongo`
- `PostgreSQL`
- `MySQL`
- `MSSQL`
- `Oráculo`
- `SQLite`
- `DynamoDB`
- `Cassandra`
- `Firebase`
- `Aurora`
- `RDS`

## Compilação do cliente em tempo de execução

- Fonte: `apps/backend-template/src/infra/persistence/compileDatabaseClient.ts`
- Os armazenamentos externos agora usam proxies fail-fast (`apps/backend-template/src/infra/persistence/external/ExternalStoreProxy.ts`) em vez de reutilizar silenciosamente os armazenamentos na memória.
- Oracle possui suporte de conector dedicado (`apps/backend-template/src/infra/persistence/external/OracleRepository.ts`).
- Adaptadores Bootstrap que injetam `IDatabaseClient` de `JUMENTIX_DATABASE_DRIVER`:
  - `apps/backend-template/src/interface/HTTP/adapters/*`
  - `apps/backend-template/src/interface/WebSocket/adapters/socket-io/socket-io.ts`
  - `apps/backend-template/src/interface/gRPC/adapters/grpc/grpc.ts`
  - `apps/backend-template/src/modules/Users/interface/restapi/frameworks/aws/lambda/handlers/runtime.ts`

## Conjunto de testes de fumaça

- Arquivo de teste: `apps/backend-template/test/smoke/database/DatabaseDrivers.smoke.test.ts`
- Execute todos os drivers de fumaça configurados:

```bash
bun run test:smoke:db:all
```

- Execute apenas um driver:

```bash
bun run test:smoke:db:postgresql
bun run test:smoke:db:mysql
bun run test:smoke:db:mssql
bun run test:smoke:db:oracle
bun run test:smoke:db:mongo
bun run test:smoke:db:cassandra
bun run test:smoke:db:dynamodb
bun run test:smoke:db:firebase
bun run test:smoke:db:aurora
bun run test:smoke:db:rds
bun run test:smoke:db:sqlite
bun run test:smoke:db:inmemory
```

### Filtro de driver

`JUMENTIX_DB_SMOKE_DRIVERS` aceita uma lista separada por vírgulas e controla quais caixas de fumaça são executadas.

Exemplo:

```bash
JUMENTIX_DB_SMOKE_DRIVERS=PostgreSQL,MySQL bun run test:smoke:db
```

## Arquivos Docker Compose por banco de dados

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

## Fluxos de trabalho de fumaça de banco de dados de um comando

Cada fluxo de trabalho inicia o contêiner -> executa o teste de fumaça -> interrompe o contêiner:

```bash
bun run smoke:db:postgresql
bun run smoke:db:mysql
bun run smoke:db:mssql
bun run smoke:db:oracle
bun run smoke:db:mongodb
bun run smoke:db:cassandra
bun run smoke:db:dynamodb
bun run smoke:db:firebase
bun run smoke:db:aurora
bun run smoke:db:rds
```

## Variáveis ​​de ambiente

Adicione/atualize essas chaves em `apps/backend-template/src/config/.env.*` para tempo de execução específico do driver:

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

## Nota Operacional

Se o daemon Docker não estiver disponível, os scripts smoke que precisam de contêineres falharão na inicialização. Nesse caso:

1. Inicie o Docker Desktop/daemon.
2. Execute novamente o comando `smoke:db:*`.
3. Para ambientes CI sem Docker, mantenha `test:smoke:db:inmemory` e testes de unidade como verificações de linha de base.
