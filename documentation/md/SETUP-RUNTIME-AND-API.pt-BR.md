<!--
Arquivo gerado automaticamente a partir de: documentation/md/SETUP-RUNTIME-AND-API.md
Idioma alvo: Português (Brasil)
-->
# Configuração, tempo de execução e API

## Tempo de execução e pilha necessária

- Node.js `22.x` e npm
- Datilografado
- Brincadeira
- Redis (suporte mutex, local opcional via Docker)
- RabbitMQ ou BullMQ/Redis (opcional, para adaptador `MessageMediator`)
- Tipificações OpenAPI
- analisador YAML
- PM2

## Configurar

Instale dependências:

```bash
pnpm install
```

Execute o Redis (se necessário):

```bash
pnpm run docker:composeredis
```

Execute serviços de mensagens (RabbitMQ + Redis) com Docker:

```bash
pnpm run docker:composemessaging
```

Execute apenas RabbitMQ (útil quando o Redis já está em execução):

```bash
pnpm run docker:composerabbit
```

## Adaptador Mediador de Mensagens

O mediador pode ser selecionado através da variável de ambiente:

```bash
AAA_MESSAGE_MEDIATOR_ADAPTER=inmemory # default
AAA_MESSAGE_MEDIATOR_ADAPTER=rabbitmq
AAA_MESSAGE_MEDIATOR_ADAPTER=bullmq
```

Variáveis ​​​​necessárias do RabbitMQ:

```bash
AAA_RABBITMQ_URL=amqp://guest:guest@127.0.0.1:5672
AAA_RABBITMQ_EXCHANGE=app.events
AAA_RABBITMQ_REQUEST_QUEUE=app.requests
AAA_RABBITMQ_PREFETCH=10
```

Variáveis ​​​​necessárias do BullMQ:

```bash
AAA_BULLMQ_REDIS_HOST=127.0.0.1
AAA_BULLMQ_REDIS_PORT=6379
AAA_BULLMQ_REDIS_DB=1
AAA_BULLMQ_REQUEST_QUEUE=app.requests
```

## Documentação da API

- IU: <http://localhost:3000/OASdoc/>
- JSON: <http://localhost:3000/docs/1.0.0>
- UI AsyncAPI: <http://localhost:3000/AsyncAPIdoc/>
- Índice JSON AsyncAPI: <http://localhost:3000/docs/asyncapi/versions>

Para perfis de VM, os serviços são orquestrados por meio do PM2.
`REST`, `WebSocket` e `gRPC` são executados como processos/portas separados em perfis combinados.
Inicie o perfil PM2 selecionado antes de abrir URLs de documentação.

## Perfis de tempo de execução PM2 (VM)

A seleção do adaptador de tempo de execução é orientada pelo ambiente por meio de:

```bash
AAA_HTTP_FRAMEWORK=express
AAA_REALTIME_API=no
AAA_REALTIME_API_PROTOCOL=websocket
AAA_REALTIME_API_DATABASE_DRIVER=Mongo
```

Contrato de tempo de execução detalhado:

- [Contratos de ambiente de tempo de execução](./RUNTIME-ENVIRONMENT-CONTRACTS.md)

Pontos de entrada de inicialização usados ​​pelo PM2:

- `apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts`
- `apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts`
- `apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.ts`

Resumo do comportamento:

- `start-rest-api.ts` resolve `AAA_HTTP_FRAMEWORK` e inicia o adaptador HTTP configurado.
- `start-websocket-api.ts` inicia somente quando `AAA_REALTIME_API=yes` e `AAA_REALTIME_API_PROTOCOL=websocket`.
- `start-grpc-api.ts` inicia somente quando `AAA_REALTIME_API=yes` e `AAA_REALTIME_API_PROTOCOL=grpc`.

Dev (inicia automaticamente `service-management`):

```bash
pnpm run pm2:start:dev:restapi
pnpm run pm2:start:dev:websocket-rest
pnpm run pm2:start:dev:grpc-rest
```

Encenação:

```bash
pnpm run pm2:start:staging:restapi
pnpm run pm2:start:staging:websocket-rest
pnpm run pm2:start:staging:grpc-rest
```

Produção:

```bash
pnpm run pm2:start:prod:restapi
pnpm run pm2:start:prod:websocket-rest
pnpm run pm2:start:prod:grpc-rest
```

Operações PM2:

```bash
pnpm run pm2:list
pnpm run pm2:logs
pnpm run pm2:stop:all
pnpm run pm2:delete:all
```

O Service Management pode ler e persistir esses valores de ambiente de tempo de execução por meio de:

- `GET /api/runtime/env?environment=dev|staging|ci`
- `POST /api/runtime/env`

Exemplo de carga útil `POST /api/runtime/env`:

```json
{
  "environment": "dev",
  "values": {
    "AAA_HTTP_FRAMEWORK": "express",
    "AAA_REALTIME_API": "yes",
    "AAA_REALTIME_API_PROTOCOL": "websocket",
    "AAA_REALTIME_API_DATABASE_DRIVER": "Mongo"
  }
}
```

Exemplo de carga útil de resposta:

```json
{
  "environment": "dev",
  "fileName": ".env.dev",
  "values": {
    "AAA_HTTP_FRAMEWORK": "express",
    "AAA_REALTIME_API": "yes",
    "AAA_REALTIME_API_PROTOCOL": "websocket",
    "AAA_REALTIME_API_DATABASE_DRIVER": "Mongo"
  }
}
```

## Comandos de inicialização de adaptador único (via PM2)

Adaptadores HTTP (todos roteados através do carregador `start-rest-api` com `AAA_HTTP_FRAMEWORK`):

```bash
pnpm run dev:express
pnpm run dev:fastify
pnpm run dev:restify
pnpm run dev:hyper-express
pnpm run dev:cloudflare-workers
pnpm run dev:vercel-functions
pnpm run dev:loopback
pnpm run dev:sails-js
pnpm run dev:feathers
pnpm run dev:derby-js
pnpm run dev:adonis-js
pnpm run dev:total-js
```

Comandos genéricos do carregador REST:

```bash
# uses AAA_HTTP_FRAMEWORK from env file (default express)
pnpm run dev:http
pnpm run prod:http
```

Estilo de carregador direto equivalente:

```bash
AAA_HTTP_FRAMEWORK=fastify pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-fastify --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env
AAA_HTTP_FRAMEWORK=cloudflare-workers pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-cloudflare-workers --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env
```

Perfis de serviço combinados:

```bash
pnpm run dev:websocket
pnpm run dev:grpc
pnpm run test:integration:service-management
```

Modo de desenvolvimento sem servidor:

```bash
pnpm run dev:serverless
```

CLI de automação do desenvolvedor:

```bash
pnpm run dev:cli
```

Aplicativo de gerenciamento de serviços (servido por PM2):

```bash
pnpm run dev:service-management
```

![modo de desenvolvimento sem servidor](../images/sls.png "modo de desenvolvimento sem servidor")

## Comandos de produção

Todos os comandos do adaptador `prod:*` agora inicializam através do PM2 e roteiam através do carregador `start-rest-api`.
Use perfis `pm2:start:prod:*` para orquestração REST/WebSocket/gRPC separada.

## Cobertura de manipuladores Lambda

O adaptador de usuários/autenticação do AWS Lambda agora fornece manipuladores para todas as operações de usuários/autenticação OpenAPI:

- `login`
- `sair`
- `registrar`
- `atualizarUserPassword`
- `criar`
- `obter tudo`
- `deleteOne`
- `atualizar`
- `getOneById`
- `atualizar senha`
- `criarE-mail`
- `atualizarE-mail`
- `deleteEmail`
- `criarDocumento`
- `atualizarDocumento`
- `excluirDocumento`
- `criarTelefone`
- `atualizarTelefone`
- `deleteTelefone`

## Notas de implementação do adaptador

- `Cloudflare Workers` usa um despachante de busca sem servidor e reutiliza contratos de operação lambda.
- `Vercel Functions` usa encapsulamento de função de solicitação/resposta (sem inicialização do servidor Express).
- Os adaptadores `LoopBack`, `Sails`, `Feathers`, `Derby`, `Adonis` e `Total` são executados com bootstraps/adaptadores de servidor nativos da estrutura.
- A resolução do manipulador HTTP em `RestAPI` ainda recorre aos manipuladores de operação `express` quando um manipulador específico da estrutura não está presente intencionalmente, preservando a paridade do contrato de endpoint.
