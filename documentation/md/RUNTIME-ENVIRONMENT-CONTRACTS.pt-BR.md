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

### Localização dos arquivos env

Os arquivos env de tempo de execução ficam em `apps/backend-template/src/config/` (`.env.dev`,
`.env.staging`, `.env.ci`). O servidor resolve o diretório de configuração como
`JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR` (resolvido como absoluto) quando definido,
caso contrário `<repo-root>/apps/backend-template/src/config`, e falha fechado na
inicialização — mensagem no stderr nomeando o diretório ausente, código de saída `1` —
quando o diretório não existe.

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

As respostas distinguem falhas de parse, validação e filesystem através do campo
`details` do envelope de erro:

- Corpo JSON malformado (POST): `400 { "error": "Invalid payload.", "details": … }`.
- Ambiente não suportado: `400` cujo `details` nomeia o valor não suportado e a
  lista de aceitos — `{ "error": "Invalid environment request.", … }` no GET,
  `{ "error": "Invalid payload.", … }` no POST; nenhum arquivo é escrito.
- Arquivo env ausente: `400` cujo `details` carrega o path resolvido (internamente
  código de erro `ENV_FILE_NOT_FOUND`), de modo que uma instalação quebrada é
  identificável pela mensagem em vez de ser confundida com uma requisição malformada.
- Token bearer ausente ou incorreto: `401 { "error": "Unauthorized." }` quando o
  token de auth está configurado.

O Requisito 126 (JUM-543) especifica a divisão alvo na qual falhas de filesystem
surgem como uma classe de falha distinta e identificável em vez de compartilhar o
envelope de validação de payload; a UI apresenta essas falhas através de superfícies
de status não bloqueantes, não `window.alert`.

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

