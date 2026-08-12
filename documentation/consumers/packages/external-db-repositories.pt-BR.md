# @jumentix/external-db-repositories

Reusable repository adapters that talk to external databases (Mongo, SQL, DynamoDB, and peers) behind Jumentix persistence ports.

## O que é

Reusable repository adapters that talk to external databases (Mongo, SQL, DynamoDB, and peers) behind Jumentix persistence ports.

## Por que existe

Each service used to invent its own Mongo/SQL/Dynamo wiring. Juniors copied insecure connection code and leaked driver details into use-cases.

**Quando usar:** You need a concrete external DB repository behind `IStore` / persistence ports in a backend service.

**Quando não usar:** Browser/offline storage (use Cana), key-value locks (use key-value-storage + mutex-service), or HTTP clients (use sdk-rest-client).

## Responsabilidade no escopo

- **Camada:** persistence / adapter
- **Fronteira do problema:** Driver-specific repository classes and connection lifecycle for supported external databases.
- **Usado com:** Contracts live in `@jumentix/persistence-contracts` and `@jumentix/external-persistence-core`. Store bridging is `@jumentix/external-store-proxy`. Driver selection is `@jumentix/database-client-factory`.
- **Composição típica:** Typically: persistence-contracts → external-persistence-core → external-db-repositories → external-store-proxy, selected via database-client-factory in backend-template.
- **Jornadas:** [Create a REST API](/docs/jumentix/guides/rest-api) and persistence reference pages.
- **Não é responsável por:** OpenAPI/HTTP, domain rules, Redis KV, IndexedDB, or choosing env drivers by itself.

## Pré-requisitos

- Bun 1.3.14+ (pin do monorepo) ou o Node do seu serviço
- Leia [Começando](/docs/pt-BR/jumentix/concepts/getting-started)
- TypeScript básico (`import`/módulos)

## Glossário

- **Porta (port)** — contrato TypeScript da aplicação (sem tipos de vendor).
- **Adaptador** — implementação concreta de driver/broker/protocolo.
- **Composition root** — startup que liga env → adaptadores → use-cases.

## Passos numerados

### 1. Instalar

```bash
bun add @jumentix/external-db-repositories
```

### 2. Primeiro sucesso (menos de 30 min)

```ts
import { MongoMongooseRepository } from '@jumentix/external-db-repositories';

// Wire options from env (URI, db name). Do not hardcode secrets.
const repo = new MongoMongooseRepository({
  uri: process.env.MONGO_URI!,
  database: process.env.MONGO_DB ?? 'app'
});
await repo.connect();
// Use through your IStore / use-case ports — never call drivers from domain code.
```


### 3. Fluxos centrais

### 1. Connect with env options

Load URI/region/credentials from environment; call `connect()` once at composition root.

### 2. Run a repository operation

Call repository methods from an application adapter, not from entities.

### 3. Disconnect on shutdown

Hook process shutdown to `disconnect()` so pools do not leak.


### 4. Superfície prática (exports)

- `MongoMongooseRepository`
- `SqlSequelizeRepository`
- `DynamoDbRepository`
- `CassandraRepository`
- `FirebaseRepository`
- `AuroraRepository`
- `RdsRepository`
- `OracleRepository`

Use os exports nas camadas de aplicação/adaptadores — não em entidades de domínio.

## Erros comuns

| Sintoma | Causa | Correção |
|---------|-------|----------|
| Connection refused / auth failed | Bad URI or secrets | Verify env vars locally; never commit credentials. |
| Used repository inside a domain entity | Layering violation | Keep repositories in adapters; domain talks ports only. |

**Como verificar:** o snippet de primeiro sucesso roda (ou typechecka no serviço) e o use-case depende só de ports.

## Checklist júnior (“Eu consigo …”)

- [ ] I can name when to pick this package vs Cana or KV
- [ ] I can connect a repository from env at the composition root
- [ ] I know which sibling packages own contracts vs store proxies

## Próximo passo

Continue com [external-persistence-core](/docs/pt-BR/jumentix/packages/external-persistence-core).
