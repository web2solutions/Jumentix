<!--
Arquivo gerado automaticamente a partir de: documentation/md/REALTIME-API-TESTING.md
Idioma alvo: Português (Brasil)
-->
# Guia de teste de API em tempo real

Este documento define a matriz de teste oficial para interfaces em tempo real (`WebSocketAPI` e `gRPCAPI`).

## Escopo

Interfaces cobertas:

- `apps/backend-template/src/interface/WebSocket/WebSocketAPI.ts`
- `apps/backend-template/src/interface/gRPC/gRPCAPI.ts`
- Adaptadores horizontais Socket.IO:
  - `cluster`
  - `redis-streams`

## Matriz de teste

## 1) Testes unitários

WebSocket:

- `apps/backend-template/test/unit/interface/WebSocket/WebSocketAPI.test.ts`
- `apps/backend-template/test/unit/interface/WebSocket/adapters/start-websocket-api.test.ts`
- `apps/backend-template/test/unit/interface/WebSocket/adapters/socket-io.bootstrap.test.ts`
- `apps/backend-template/test/unit/interface/WebSocket/clusterAdapter.test.ts`
- `apps/backend-template/test/unit/interface/WebSocket/redisStreamsAdapter.test.ts`

gRPC:

- `apps/backend-template/test/unit/interface/gRPC/gRPCAPI.test.ts`
- `apps/backend-template/test/unit/interface/gRPC/adapters/start-grpc-api.test.ts`
- `apps/backend-template/test/unit/interface/gRPC/adapters/grpc.bootstrap.test.ts`

Núcleo compartilhado em tempo real:

- `apps/backend-template/test/unit/interface/Async/RealtimeAPIBase.test.ts`

Correr:

```bash
bun run test:unit
```

## 2) Testes de integração

Integração em nível de protocolo:

- `apps/backend-template/test/integration/realtime/websocket.basic.integration.test.ts`
- `apps/backend-template/test/integration/realtime/grpc.basic.integration.test.ts`

Integração de várias instâncias do Redis:

- `apps/backend-template/test/integration/realtime/socketio.redis-streams.multi-instance.test.ts`

Execute integrações básicas em tempo real:

```bash
bun run test:integration:realtime
```

Execute a integração de várias instâncias do Redis (requer Redis):

```bash
bun run test:integration:realtime:redis-streams
```

## 3) Testes de fumaça

Fumaça local em tempo real:

- `apps/backend-template/test/smoke/realtime/RealtimeApis.smoke.test.ts`

Correr:

```bash
bun run test:smoke:realtime
```

Fumaça Redis ponta a ponta (Docker + multi-instância + limpeza):

```bash
bun run smoke:realtime:redis-streams
```

## Comportamento do IC

- Integração básica em tempo real e testes de fumaça podem ser executados sem Redis externo.
- O teste de múltiplas instâncias apoiado por Redis é controlado por `RUN_REDIS_INTEGRATION=1`.
- A política de ignorar Jest exclui apenas `socketio.redis-streams.multi-instance.test.ts` quando a integração do Redis está desativada.

## Notas Operacionais

1. Mantenha os testes em tempo real `--coverage=false` para scripts de fumaça/integração.
2. Mantenha portas fixas determinísticas para arquivos de teste isolados.
3. Sempre feche os clientes de soquete e pare as instâncias do servidor em `afterAll`.
4. Atualize este arquivo e os requisitos `.agents` sempre que o comportamento do transporte em tempo real mudar.


