<!--
Arquivo gerado automaticamente a partir de: documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md
Idioma alvo: Português (Brasil)
-->
# Contratos de ambiente de tempo de execução

Este documento define o contrato do ambiente de tempo de execução usado para inicializar adaptadores de API e perfis de processo PM2.

## Propósito

Garanta um comportamento determinístico de inicialização para:

- Adaptadores API REST
- Adaptadores API em tempo real (WebSocket, gRPC)
- Editor de perfil de tempo de execução do Service Management

Todos os pontos de entrada de inicialização do tempo de execução devem seguir este contrato.

## Chaves de tempo de execução

As seguintes chaves são obrigatórias em arquivos env em `apps/backend-template/src/config/`:

- `JUMENTIX_HTTP_FRAMEWORK`
  - padrão: `expresso`
  - valores atuais suportados:
    - `expressar`
    - `fastificar`
    - `restificar`
    - `hiper-expresso`
    - `trabalhadores da cloudflare`
    - `funções vercel`
    - `loopback`
    - `velas-js`
    - `penas`
    - `derby-js`
    - `adonis-js`
    - `total-js`
  - usado por: `apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts`

- `JUMENTIX_REALTIME_API`
  - padrão: `não`
  - valores suportados: `sim`, `não`
  - usado por:
    - `apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts`
    - `apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.ts`

- `JUMENTIX_REALTIME_API_PROTOCOL`
  - padrão: `websocket`
  - valores suportados: `websocket`, `grpc`
  - usado por:
    - `apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts`
    - `apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.ts`

- `JUMENTIX_REALTIME_API_DATABASE_DRIVER`
  - padrão: `Mongo`
  - valores suportados:
    - `Mongo`
    - `PostgreSQL`
    - `MySQL`
    - `MSSQL`
    - `RDS`
    - `Aurora`
    - `Cassandra`
  - usado por: metadados de perfil de tempo de execução e fluxos de trabalho de configuração de gerenciamento de serviços.

- `JUMENTIX_DATABASE_DRIVER`
  - padrão: `InMemory`
  - valores suportados (conjunto canônico `DriverName`; o backend também aceita
    aliases comuns sem distinção entre maiúsculas e minúsculas, mas as grafias
    canônicas são o contrato):
    - `InMemory`
    - `IndexedDB`
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
  - usado por: `packages/database-client-factory/src/compileDatabaseClient.ts`

- `JUMENTIX_KEYVALUESTORAGE_DRIVER`
  - padrão: `redis` (qualquer valor diferente das grafias em memória seleciona Redis)
  - valores suportados: `inmemory`, `redis`
  - usado por: `packages/key-value-storage/src/compileKeyValueStorageClient.ts`

- `JUMENTIX_MESSAGE_MEDIATOR_ADAPTER`
  - padrão: `inmemory`
  - valores suportados: `inmemory`, `rabbitmq`, `bullmq`
  - usado por: `packages/message-mediator/src/compileMessageMediator.ts`

- `JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER`
  - padrão: vazio (adaptador Socket.IO na memória)
  - valores suportados: `cluster`, `redis-streams`
  - usado por: `apps/backend-template/src/interface/WebSocket/adapters/socket-io/socket-io.ts`

- `JUMENTIX_WEBSOCKET_CLUSTER_WORKERS`
  - contagem de trabalhadores opcional para modo de cluster Socket.IO.
  - padrão: contagem de núcleos da CPU.
  - usado por: `apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts`

- `JUMENTIX_WEBSOCKET_REDIS_URL`
  - URL de conexão Redis dedicada opcional para adaptador de escalonamento Socket.IO.
  - exemplo: `redis://127.0.0.1:6379/1`
  - usado por: `apps/backend-template/src/interface/WebSocket/adapters/socket-io/redisStreamsAdapter.ts`

- `JUMENTIX_REDIS_URL`
  - substituto de URL Redis global opcional usado pelo adaptador de escalabilidade WebSocket quando
    `JUMENTIX_WEBSOCKET_REDIS_URL` não está definido.
  - usado por: `apps/backend-template/src/interface/WebSocket/adapters/socket-io/redisStreamsAdapter.ts`

## Pontos de entrada de inicialização

- DESCANSO:
  - `apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts`
-WebSocket:
  - `apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts`
-gRPC:
  - `apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.ts`

Esses arquivos são os pontos de entrada oficiais do processo usados ​​pelos perfis do ecossistema PM2.
Scripts auxiliares de protocolo único também roteiam através desses pontos de entrada (`dev:http`, `prod:http`, `dev:websocket`, `dev:grpc`).

## Modelo de Processo PM2

Para ambientes VM, cada interface é executada em seu próprio processo PM2:

- Processo `API REST`
- Processo `API WebSocket`
- Processo `API gRPC`
- Processo de `Gestão de Serviços`

Perfis de tempo de execução:

- `API REST`
- `API WebSocket + API REST`
- `API gRPC + API REST`

## API de ambiente de execução de gerenciamento de serviços

O Service Management expõe pontos de extremidade de leitura/gravação do ambiente de tempo de execução:

- `GET /api/runtime/env?environment=dev|development|staging|ci|test`
- `POST /api/runtime/env`

O editor env altera apenas as chaves aprovadas deste contrato, preservando as proteções.

### Níveis de chaves e listas de permissão

As listas de leitura e gravação são conjuntos separados; cada chave pertence a exatamente um nível.
A classificação autoritativa por chave (com justificativas) está em
`.agents/requirements/software/126-service-management-ownership-and-public-contracts.md`.

- **Editável** (leitura + gravação) — seletores de topologia de tempo de execução:
  `JUMENTIX_HTTP_FRAMEWORK`, `JUMENTIX_REALTIME_API`,
  `JUMENTIX_REALTIME_API_PROTOCOL`, `JUMENTIX_REALTIME_API_DATABASE_DRIVER`,
  `JUMENTIX_DATABASE_DRIVER`, `JUMENTIX_KEYVALUESTORAGE_DRIVER`,
  `JUMENTIX_MESSAGE_MEDIATOR_ADAPTER`, `JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER`,
  `JUMENTIX_WEBSOCKET_REDIS_URL`.
- **Somente leitura** — endpoints de conexão e configuração não secreta:
  `JUMENTIX_DATABASE_NAME`, `JUMENTIX_ENABLE_BASIC_AUTH`, `JUMENTIX_JWT_ISSUER`,
  `JUMENTIX_JWT_AUDIENCE`, `JUMENTIX_REDIS_HOST`, `JUMENTIX_REDIS_PORT`,
  `JUMENTIX_REDIS_DATABASE`, `JUMENTIX_RABBITMQ_EXCHANGE`,
  `JUMENTIX_RABBITMQ_REQUEST_QUEUE`, `JUMENTIX_RABBITMQ_PREFETCH`,
  `JUMENTIX_CORS_ALLOWED_ORIGINS`, `JUMENTIX_AUTH_MAX_LOGIN_ATTEMPTS`,
  `JUMENTIX_AUTH_LOGIN_WINDOW_SECONDS`, `JUMENTIX_AUTH_LOCKOUT_SECONDS`.
- **Nunca exposta** (nem leitura nem gravação) — segredos e valores com credenciais:
  `JUMENTIX_JWT_TOKEN_SECRET_KEY`, `JUMENTIX_REDIS_PASSWORD`,
  `JUMENTIX_RABBITMQ_URL`.

GET retorna `{ environment, fileName, editableKeys, values }` onde `values`
cobre os níveis editável e somente leitura e `editableKeys` nomeia a lista de
permissão de gravação. POST ignora qualquer chave fora de `editableKeys`.

### Validação de enum

Chaves editáveis com conjunto enum aceitam apenas os valores canônicos listados em
[Chaves de tempo de execução](#chaves-de-tempo-de-execução); valores fora do enum
são rejeitados com a lista de aceitos e nada é escrito.
`JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER` também aceita vazio (padrão do backend).
`JUMENTIX_WEBSOCKET_REDIS_URL` aceita vazio ou uma URL `redis://`/`rediss://`
válida sem credenciais embutidas — valores com userinfo são rejeitados para que
nenhum segredo possa ser armazenado através do endpoint.

### Ambientes aceitos

- `dev` → `.env.dev`
- `development` → `.env.dev`
- `staging` → `.env.staging`
- `ci` → `.env.ci`
- `test` → `.env.ci`

Ambientes desconhecidos retornam `400` com a lista de aceitos; nenhum arquivo é escrito.

### Postura de segurança

- Bind padrão é `127.0.0.1` (apenas loopback).
- Token bearer opcional para mutações via `JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN`.
- Log de auditoria de mutações registra timestamp, ambiente e chaves alteradas (não valores).

### Contrato de erro

- Ambiente desconhecido: `400` com lista de aceitos.
- Arquivo de ambiente ausente: `400` com path resolvido.
- Payload JSON inválido: `400` distinguindo parse de falha de filesystem.
- Valor fora do enum ou com credenciais para uma chave editável: `400` nomeando a
  chave, o valor rejeitado e a lista de aceitos; nenhum arquivo é escrito.
- Mutação não autorizada: `401` quando token de auth está configurado.

## Guarda-corpos

- `JUMENTIX_HTTP_FRAMEWORK` não suportado deve falhar rapidamente.
- O bootstrap REST deve sempre resolver o framework através do carregador `start-rest-api`.
- A inicialização em tempo real não deve iniciar quando:
  - `JUMENTIX_REALTIME_API` não é `sim`, ou
  - `JUMENTIX_REALTIME_API_PROTOCOL` não corresponde ao ponto de entrada do adaptador.
- A persistência do ambiente de tempo de execução deve ser explícita e direcionada ao ambiente (`dev`, `staging`, `ci`).

## Exemplos Operacionais

RESTO apenas:

```bash
JUMENTIX_HTTP_FRAMEWORK=express
JUMENTIX_REALTIME_API=no
```

WebSocket + REST:

```bash
JUMENTIX_HTTP_FRAMEWORK=express
JUMENTIX_REALTIME_API=yes
JUMENTIX_REALTIME_API_PROTOCOL=websocket
JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER=cluster
JUMENTIX_WEBSOCKET_CLUSTER_WORKERS=4
```

WebSocket + REST (multihost via Redis Streams):

```bash
JUMENTIX_HTTP_FRAMEWORK=express
JUMENTIX_REALTIME_API=yes
JUMENTIX_REALTIME_API_PROTOCOL=websocket
JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER=redis-streams
JUMENTIX_WEBSOCKET_REDIS_URL=redis://127.0.0.1:6379/1
```

gRPC + REST:

```bash
JUMENTIX_HTTP_FRAMEWORK=express
JUMENTIX_REALTIME_API=yes
JUMENTIX_REALTIME_API_PROTOCOL=grpc
```

