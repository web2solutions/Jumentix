# @jumentix/sdk-rest-client

OpenAPI-driven REST client: call `operationId`s instead of hand-building URLs.

## O que é

OpenAPI-driven REST client: call `operationId`s instead of hand-building URLs.

## Por que existe

Hand-written fetch URLs drift from the OpenAPI contract. This client stays aligned with the spec.

**Quando usar:** Browser or Node consumers calling a Jumentix REST API described by OpenAPI.

**Quando não usar:** Realtime sockets (sdk-websocket-client), gRPC (sdk-grpc-client), or server persistence.

## Responsabilidade no escopo

- **Camada:** SDK / HTTP adapter (consumer)
- **Fronteira do problema:** `RestApiClient` request helper bound to OpenAPI operationIds.
- **Usado com:** shared-contracts loads the spec; server side is HTTP adapters + REST guide.
- **Composição típica:** OpenAPI spec → shared-contracts → RestApiClient → your UI/service.
- **Jornadas:** [REST API guide](/docs/jumentix/guides/rest-api) (includes playground).
- **Não é responsável por:** Authorizing users, defining domain rules, or hosting the API.

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
bun add @jumentix/sdk-rest-client
```

### 2. Primeiro sucesso (menos de 30 min)

```ts
import { RestApiClient } from '@jumentix/sdk-rest-client';

const client = new RestApiClient('http://localhost:3000/api/1.0.0');
const response = await client.request({
  operationId: 'createUser',
  body: { username: 'john', password: 'StrongPass#123' }
});
```

<DocsPlayground runtime="sdk-rest-client" id="getting-started" />

### 3. Fluxos centrais

### 1. Construct with base URL

Point at your API prefix.

### 2. Call by operationId

Pass body/params matching the OpenAPI operation.

### 3. Handle envelope errors

Read structured error fields — do not assume thrown Error only.


### 4. Superfície prática (exports)

- `RestApiClient`

Use os exports nas camadas de aplicação/adaptadores — não em entidades de domínio.

## Erros comuns

| Sintoma | Causa | Correção |
|---------|-------|----------|
| Unknown operationId | Spec mismatch | Regenerate/load the same OpenAPI the server uses. |

**Como verificar:** o snippet de primeiro sucesso roda (ou typechecka no serviço) e o use-case depende só de ports.

## Checklist júnior (“Eu consigo …”)

- [ ] I can call an operationId successfully against a local API or mock
- [ ] I know this package does not replace server adapters

## Próximo passo

Continue com [sdk-websocket-client](/docs/pt-BR/jumentix/packages/sdk-websocket-client).
