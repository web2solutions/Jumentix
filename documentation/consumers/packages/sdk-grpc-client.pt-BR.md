# @jumentix/sdk-grpc-client

AsyncAPI/gRPC client for the realtime gateway — Node-oriented, no browser Run playground.

## O que é

AsyncAPI/gRPC client for the realtime gateway — Node-oriented, no browser Run playground.

## Por que existe

gRPC clients need the proto + envelope conventions; this package standardizes them.

**Quando usar:** Node services calling the Jumentix gRPC realtime gateway.

**Quando não usar:** Browser apps (use REST/WS SDKs) or in-process events (message-mediator).

## Responsabilidade no escopo

- **Camada:** SDK / realtime adapter (Node)
- **Fronteira do problema:** `GrpcApiClient` and proto loading for `realtime.AsyncApiGateway`.
- **Usado com:** shared-contracts; server gRPC adapter docs.
- **Composição típica:** Realtime guide gRPC path → this client in Node workers/services.
- **Jornadas:** [Realtime API guide](/docs/jumentix/guides/realtime-api).
- **Não é responsável por:** Browser networking or DB persistence.

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
bun add @jumentix/sdk-grpc-client
```

### 2. Primeiro sucesso (<30 min)

```ts
import { GrpcApiClient } from '@jumentix/sdk-grpc-client';

const client = new GrpcApiClient('localhost:3002');
const response = await client.request({
  operationId: 'createUser',
  input: { username: 'john', password: 'StrongPass#123' }
});
```


### 3. Fluxos centrais

### 1. Point at host:port

Use the gRPC gateway address from env.

### 2. Send envelope

operationId + input matching AsyncAPI/proto.

### 3. Deploy only on Node

Do not bundle this into a browser app.


### 4. Superfície prática (exports)

- `GrpcApiClient`

Use os exports nas camadas de aplicação/adaptadores — não em entidades de domínio.

## Erros comuns

| Sintoma | Causa | Correção |
|---------|-------|----------|
| Proto not found | Packaging/path issue | Ensure dist proto is present in the installed package. |

**Como verificar:** o snippet de primeiro sucesso roda (ou typechecka no serviço) e o use-case depende só de ports.

## Checklist júnior (“Eu consigo …”)

- [ ] I can run a Node hello against a local gRPC gateway
- [ ] I know this page is docs-only (no browser playground)

## Próximo passo

Continue com [message-mediator](/docs/pt-BR/jumentix/packages/message-mediator).
