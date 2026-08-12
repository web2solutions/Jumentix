# @jumentix/shared-contracts

Loads the canonical OpenAPI/AsyncAPI documents so SDK clients share one spec-resolution path.

## O que é

Loads the canonical OpenAPI/AsyncAPI documents so SDK clients share one spec-resolution path.

## Por que existe

Each SDK copied walk-up logic to find `spec/` files; copies drifted and failed differently.

**Quando usar:** You use Jumentix SDKs or need to resolve the canonical spec from a package/app.

**Quando não usar:** You are authoring domain entities or offline IndexedDB schemas.

## Responsabilidade no escopo

- **Camada:** contracts / SDK support
- **Fronteira do problema:** `loadCanonicalSpec` and `candidateSpecPaths`.
- **Usado com:** Consumed by sdk-rest-client, sdk-websocket-client, sdk-grpc-client.
- **Composição típica:** SDK constructor → shared-contracts loads spec → client maps operationId.
- **Jornadas:** REST / Realtime guides.
- **Não é responsável por:** Performing HTTP/WebSocket/gRPC calls.

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
bun add @jumentix/shared-contracts
```

### 2. Primeiro sucesso (menos de 30 min)

```ts
import { loadCanonicalSpec } from '@jumentix/shared-contracts';

const spec = await loadCanonicalSpec({
  // Prefer explicit base path in apps; walk-up is for monorepo ergonomics.
});
```


### 3. Fluxos centrais

### 1. Load OpenAPI for REST

Point at `spec/1.0.0.yml` (or project equivalent).

### 2. Load AsyncAPI for realtime

Use websocket/grpc asyncapi documents.

### 3. Fail closed on missing spec

Prefer descriptive errors over silent empty clients.


### 4. Superfície prática (exports)

- `loadCanonicalSpec`
- `candidateSpecPaths`

Use os exports nas camadas de aplicação/adaptadores — não em entidades de domínio.

## Erros comuns

| Sintoma | Causa | Correção |
|---------|-------|----------|
| Cannot find spec | Wrong cwd / missing file | Pass an explicit base path from the app root. |

**Como verificar:** o snippet de primeiro sucesso roda (ou typechecka no serviço) e o use-case depende só de ports.

## Checklist júnior (“Eu consigo …”)

- [ ] I can explain why SDKs depend on this package
- [ ] I can load a spec without duplicating walk-up code

## Próximo passo

Continue com [sdk-rest-client](/docs/pt-BR/jumentix/packages/sdk-rest-client).
