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
  - padrão: `express`
  - valores atuais suportados:
    - `express`
    - `fastify`
    - `restify`
    - `cloudflare-workers`
    - `vercel-functions`
    - `loopback`
    - `sails-js`
    - `feathers`
    - `derby-js`
    - `adonis-js`
    - `total-js`
  - decisão sobre aliases (JUM-461): `derby-js` e `sails-js` são as grafias
    canônicas. Os aliases `derby` e `sails` NÃO são aceitos — o
    `RuntimeEnvironment.ts` falha imediatamente com eles. `hyper-express` foi
    removido do runtime (JUM-27) e também é rejeitado. O seletor do Service
    Management oferece exatamente os 11 valores canônicos acima; as opções da UI
    e a validação de enum do servidor devem sempre concordar.
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

- `JUMENTIX_DATABASE_DRIVER`
  - padrão: `InMemory`
  - valores suportados (a união `DriverName` em
    `packages/database-client-factory/src/compileDatabaseClient.ts`):
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
  - o driver do banco de dados PRINCIPAL da aplicação (persistência da REST API).
    Distinto de `JUMENTIX_REALTIME_API_DATABASE_DRIVER`: alterar um nunca afeta o
    outro. `IndexedDB` é o driver de navegador (Cana) e lança erro se selecionado
    para um processo server-side sem uma fábrica `indexedDbClient` conectada.
  - usado por: `packages/database-client-factory` (`compileDatabaseClient`), conectado em
    `apps/backend-template/src/infra/persistence/compileDatabaseClient.ts`

- `JUMENTIX_REALTIME_API_DATABASE_DRIVER`
  - padrão: `Mongo`
  - valores suportados:
    - `Mongo`
    - `PostgreSQL`
    - `MySQL`
    - `MS SQL`
    - `RDS`
    - `Aurora`
    - `Cassandra`
  - apenas o driver de banco de dados da API em TEMPO REAL (WebSocket/gRPC) — não
    altera o banco de dados principal da aplicação (`JUMENTIX_DATABASE_DRIVER`).
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

### API de visualização do ecossistema PM2 (JUM-480)

O Service Management também expõe um endpoint PM2 somente leitura, a fonte
única da visualização de perfil de tempo de execução do designer:

- `GET /api/runtime/pm2-ecosystem?environment=dev|development|staging|production|prod|ci|test`

O endpoint lê o arquivo real `pm2/ecosystem.*.cjs` do ambiente selecionado
(diretório configurável via `JUMENTIX_SERVICE_MANAGEMENT_PM2_DIR`, padrão
`<repo-root>/pm2`) e retorna `{ environment, fileName, path, exists, apps }`,
onde cada app carrega `{ name, script, interpreter, interpreterArgs, env,
command }`. `command` deriva da definição do ecossistema —
`pm2 start <caminho do ecossistema> --only <nome do app> --update-env` — nunca
uma string de gerenciador de pacotes embutida, de modo que a ferramenta Bun atual
não pode invalidar silenciosamente a visualização. O módulo do
ecossistema é carregado sem cache: editar um arquivo de ecossistema muda a
resposta sem reiniciar o servidor e sem alteração de código.

Os estados de falha e de borda seguem a mesma disciplina de honestidade da API
de arquivos env:

- Ambiente desconhecido: `400 { "error": "Invalid environment request.", … }`
  nomeando o valor e a lista aceita — nunca convertido silenciosamente para `dev`.
- Arquivo de ecossistema ausente (por exemplo `ci`, que não possui um): `200`
  com `exists: false` e lista `apps` vazia — um estado explícito que a UI
  renderiza como "sem ecossistema para este ambiente", não uma visualização
  silenciosamente vazia.
- Arquivo de ecossistema ilegível ou sintaticamente quebrado:
  `500 { "error": "PM2 ecosystem file operation failed.", "code", "path",
  "details" }`.

### Localização dos arquivos env

Os arquivos env de tempo de execução ficam em `apps/backend-template/src/config/` (`.env.dev`,
`.env.staging`, `.env.ci`). O servidor resolve o diretório de configuração como
`JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR` (resolvido como absoluto) quando definido,
caso contrário `<repo-root>/apps/backend-template/src/config`, e falha fechado na
inicialização — mensagem no stderr nomeando o diretório ausente, código de saída `1` —
quando o diretório não existe.

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
- `development` → `.env.dev` (alias)
- `staging` → `.env.staging`
- `ci` → `.env.ci`
- `test` → `.env.ci` (alias)

A comparação é insensível a maiúsculas após remoção de espaços. Ambientes
desconhecidos são explicitamente rejeitados — `400` com a lista de aceitos, nenhum
arquivo escrito, nunca silenciosamente convertidos para `dev`. Quando omitido, o
ambiente padrão é `NODE_ENV` ou `dev`.

### Classificação de chaves

Cada chave de ambiente pertence a exatamente um de três níveis, cada um com uma
razão declarada:

- **Editável** — seletores de topologia de tempo de execução (frameworks, drivers,
  adaptadores, alternâncias de protocolo); legível via GET e gravável via POST.
- **Somente leitura** — endpoints de conexão e configuração não secreta; visível
  no GET para que o designer reflita a realidade, nunca gravável via POST.
- **Nunca exposta** — segredos e valores portadores de credenciais; não devem
  aparecer na resposta do GET e não devem ser graváveis, pois a resposta cruza o
  mesmo limite de confiança que a escrita.

O conjunto editável atual são os quatro seletores de topologia listados em
[Chaves de tempo de execução](#chaves-de-tempo-de-execução) (`JUMENTIX_HTTP_FRAMEWORK`,
`JUMENTIX_REALTIME_API`, `JUMENTIX_REALTIME_API_PROTOCOL`,
`JUMENTIX_REALTIME_API_DATABASE_DRIVER`), e a superfície de leitura é limitada às
mesmas quatro. A classificação completa por chave dos arquivos env nesses níveis
chega via JUM-460; as decisões de classificação autoritativas — uma por chave, cada
uma com uma razão escrita — estão no
[Requisito 126](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md).
Toda adição ao conjunto editável é uma decisão de segurança.

### Conjuntos de enum e decisão de alias

Valores fora do enum aceito para cada chave (listados em
[Chaves de tempo de execução](#chaves-de-tempo-de-execução)) são rejeitados com a
lista de aceitos.

Decisão de alias (JUM-461): `derby`/`derby-js` e `sails`/`sails-js` são o mesmo
framework sob duas grafias. As grafias canônicas são `derby-js` e `sails-js` — as
formas aceitas por
`apps/backend-template/src/interface/runtime/RuntimeEnvironment.ts` — e o seletor
da UI oferece exatamente os valores que o servidor aceita: um valor que a UI oferece
deve ser um valor que o servidor aceita, e vice-versa. Separadamente,
`JUMENTIX_DATABASE_DRIVER` e `JUMENTIX_REALTIME_API_DATABASE_DRIVER` são chaves
distintas e devem ser rotuladas e editáveis separadamente na UI.

### Postura de segurança

- Bind padrão é `127.0.0.1` (apenas loopback); vincular a uma interface não
  loopback é um opt-in explícito via `JUMENTIX_SERVICE_MANAGEMENT_HOST`.
- A porta padrão é `3200`, substituível via `JUMENTIX_SERVICE_MANAGEMENT_PORT`.
- Quando `JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN` está definido, `POST
  /api/runtime/env` requer `Authorization: Bearer <token>` e rejeita qualquer
  outra coisa com `401 { "error": "Unauthorized." }`; quando não definido, a
  operação apenas em loopback é permitida sem token.
- Log de auditoria de mutações registra timestamp, ambiente e chaves alteradas (não valores).

### Contrato de erro

As respostas distinguem falhas de parse, validação e filesystem (entregue pelo
JUM-543; Requisito 126 §3):

- Corpo JSON malformado (POST): `400 { "error": "Invalid payload.", "details": … }`.
  O `try` de parse é restrito apenas ao `JSON.parse`, de modo que este envelope
  nunca pode relatar uma falha de filesystem.
- Ambiente não suportado: `400 { "error": "Invalid environment request.",
  "details": … }` cujo `details` nomeia o valor não suportado e a lista de
  aceitos — tanto no GET quanto no POST; nenhum arquivo é escrito.
- Falhas de filesystem — arquivo env ausente (código de erro
  `ENV_FILE_NOT_FOUND`), erros de permissão, disco cheio: `500 { "error":
  "Environment file operation failed.", "code": …, "path": …, "details": … }`,
  onde `code` é `ENV_FILE_NOT_FOUND` ou o código de erro do `fs` subjacente e
  `path` é o path resolvido do arquivo env. Uma instalação quebrada é uma
  classe de falha distinta e identificável — nunca `400 Invalid payload.`.
- Valor fora do enum ou com credenciais para uma chave editável: `400` nomeando a
  chave, o valor rejeitado e a lista de aceitos; nenhum arquivo é escrito.
- Token bearer ausente ou incorreto: `401 { "error": "Unauthorized." }` quando o
  token de auth está configurado.

A UI apresenta essas falhas através de superfícies de status não bloqueantes
com `aria-live` (uma região toast global mais uma linha de status inline no
painel de ambiente de runtime), não `window.alert`; o cliente renderiza
exatamente o que a API retorna — `error`, `details`, e na classe 500 também
`code` e `path` — sem remapeamento no cliente.

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
