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

- `AAA_HTTP_FRAMEWORK`
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

- `AAA_REALTIME_API`
  - padrão: `não`
  - valores suportados: `sim`, `não`
  - usado por:
    - `apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts`
    - `apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.ts`

- `AAA_REALTIME_API_PROTOCOL`
  - padrão: `websocket`
  - valores suportados: `websocket`, `grpc`
  - usado por:
    - `apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts`
    - `apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.ts`

- `AAA_REALTIME_API_DATABASE_DRIVER`
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

- `AAA_WEBSOCKET_SOCKETIO_ADAPTER`
  - padrão: vazio (adaptador Socket.IO na memória)
  - valores suportados: `cluster`, `redis-streams`
  - usado por: `apps/backend-template/src/interface/WebSocket/adapters/socket-io/socket-io.ts`

- `AAA_WEBSOCKET_CLUSTER_WORKERS`
  - contagem de trabalhadores opcional para modo de cluster Socket.IO.
  - padrão: contagem de núcleos da CPU.
  - usado por: `apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts`

- `AAA_WEBSOCKET_REDIS_URL`
  - URL de conexão Redis dedicada opcional para adaptador de escalonamento Socket.IO.
  - exemplo: `redis://127.0.0.1:6379/1`
  - usado por: `apps/backend-template/src/interface/WebSocket/adapters/socket-io/redisStreamsAdapter.ts`

- `AAA_REDIS_URL`
  - substituto de URL Redis global opcional usado pelo adaptador de escalabilidade WebSocket quando
    `AAA_WEBSOCKET_REDIS_URL` não está definido.
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

- `GET /api/runtime/env?environment=dev|staging|ci`
- `POST /api/runtime/env`

O editor env altera apenas as chaves aprovadas deste contrato, preservando as proteções.

## Guarda-corpos

- `AAA_HTTP_FRAMEWORK` não suportado deve falhar rapidamente.
- O bootstrap REST deve sempre resolver o framework através do carregador `start-rest-api`.
- A inicialização em tempo real não deve iniciar quando:
  - `AAA_REALTIME_API` não é `sim`, ou
  - `AAA_REALTIME_API_PROTOCOL` não corresponde ao ponto de entrada do adaptador.
- A persistência do ambiente de tempo de execução deve ser explícita e direcionada ao ambiente (`dev`, `staging`, `ci`).

## Exemplos Operacionais

RESTO apenas:

```bash
AAA_HTTP_FRAMEWORK=express
AAA_REALTIME_API=no
```

WebSocket + REST:

```bash
AAA_HTTP_FRAMEWORK=express
AAA_REALTIME_API=yes
AAA_REALTIME_API_PROTOCOL=websocket
AAA_WEBSOCKET_SOCKETIO_ADAPTER=cluster
AAA_WEBSOCKET_CLUSTER_WORKERS=4
```

WebSocket + REST (multihost via Redis Streams):

```bash
AAA_HTTP_FRAMEWORK=express
AAA_REALTIME_API=yes
AAA_REALTIME_API_PROTOCOL=websocket
AAA_WEBSOCKET_SOCKETIO_ADAPTER=redis-streams
AAA_WEBSOCKET_REDIS_URL=redis://127.0.0.1:6379/1
```

gRPC + REST:

```bash
AAA_HTTP_FRAMEWORK=express
AAA_REALTIME_API=yes
AAA_REALTIME_API_PROTOCOL=grpc
```

