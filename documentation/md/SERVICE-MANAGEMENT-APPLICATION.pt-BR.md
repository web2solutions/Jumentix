<!--
Arquivo gerado automaticamente a partir de: documentation/md/SERVICE-MANAGEMENT-APPLICATION.md
Idioma alvo: Português (Brasil)
-->
# Aplicativo de gerenciamento de serviços

O aplicativo estático `domaindesigner` anterior foi consolidado em:

- `aplicativos/gerenciamento de serviço/`

Agora é um conjunto com guias para design do ciclo de vida do serviço.

Arquivos principais de implementação:

- `apps/service-management/index.html`
- `apps/service-management/script.js`
- `apps/service-management/src/state/designerState.js`
- `apps/service-management/src/state/designerSync.js`
- `apps/service-management/src/store/IDesignerStore.js`
- `apps/service-management/src/store/CanaDesignerStore.js`
- `apps/service-management/src/store/designerStoreFactory.js`
- `apps/service-management/src/store/canaMigration.js`
- `apps/service-management/styles.css`
- `apps/service-management/server.js`

As camadas de módulos, o padrão de injeção e o contrato da porta de
armazenamento `IDesignerStore` estão documentados em
[Arquitetura de módulos do Service Management](./SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md).
O que as exportações de contrato garantem — e as verificações que o comprovam —
está documentado em
[Garantias de paridade de contratos do Service Management](./SERVICE-MANAGEMENT-CONTRACT-PARITY.pt-BR.md).
O console de operações — Service Configuration, o editor de ambiente de
runtime, a prévia do ecossistema PM2 e o Deploy Management, com a matriz de
capacidades compartilhada do Requisito 059 e as regras de ciclo de vida — está
documentado em
[Console de operações do Service Management](./SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.pt-BR.md).
A adoção do Cana pelo lado do usuário — onde os dados do designer vivem, a
migração unidirecional, a matriz offline/de estados e por que a exportação é o
único caminho de recuperação — está documentada em
[Adoção do Cana no Service Management, migração e comportamento offline](./SERVICE-MANAGEMENT-CANA-ADOPTION.pt-BR.md).

## Guias

1. **Designer de Domínio**
   - MVP completo de modelagem ER incluindo:
     - ciclo de vida e inspetor de domínio/entidade
     - âncoras de relacionamento, controles de dobra/caminho, estilo de roteamento
     - metadados de contexto limitado
     - agregado + invariantes
     - RBAC por entidade/ação
     - contratos de mensagens (`evento/comando/solicitação/resposta`)
     - Composição OpenAPI (`oneOf/allOf/anyOf`, referências externas, discriminador)
     - diferença de esquema + dicas de migração
     - exemplos de solicitação/resposta
     - visualização de código hexagonal (renderiza exatamente o que o pacote padrão emite)
     - visualização do esqueleto do código
     - fluxos de exportação/importação (JSON, OAS, Markdown, JSON Schema, AsyncAPI por
       transporte (`<version>.websocket.yml` / `<version>.grpc.yml` seguindo as convenções
       canônicas de `spec/asyncapi/`), proto gRPC (`async-api.proto`), pacote, pacote padrão)
     - modo minimapa e tela grande
2. **Designer de interface de comunicação**
   - Registra adaptadores de interface de entrada e mapeamentos de controladores:
     -HTTP/REST
     -gRPC
     -WebSocket
     - SSE
3. **Configuração do serviço**
   - Captura o perfil de tempo de execução e a forma de implantação:
     - tipo de serviço (`API REST`, `API WebSocket + API REST`, `API gRPC + API REST`)
     - modo de execução
     - provedor de nuvem
     - comportamento de ativos estáticos
     - portas de tempo de execução (`REST`, `WebSocket`, `gRPC`)
   - Mostra visualização de perfil orientado a PM2 para orquestração de tempo de execução de VM,
     lida dos arquivos reais `pm2/ecosystem.*.cjs` via `GET /api/runtime/pm2-ecosystem`
     (JUM-480) — sem lista de processos ou comando de gerenciador de pacotes fixado em código.
   - Inclui controles de ambiente de tempo de execução com um modelo de três níveis:
     - **Editável** (seletores de topologia de leitura/gravação):
       `JUMENTIX_HTTP_FRAMEWORK`, `JUMENTIX_REALTIME_API`,
       `JUMENTIX_REALTIME_API_PROTOCOL`, `JUMENTIX_REALTIME_API_DATABASE_DRIVER`,
       `JUMENTIX_DATABASE_DRIVER`, `JUMENTIX_KEYVALUESTORAGE_DRIVER`,
       `JUMENTIX_MESSAGE_MEDIATOR_ADAPTER`, `JUMENTIX_WEBSOCKET_SOCKETIO_ADAPTER`,
       `JUMENTIX_WEBSOCKET_REDIS_URL`.
     - **Somente leitura** (endpoints de conexão e configuração não secreta,
       exibidos mas não graváveis): host/porta/database do Redis,
       exchange/fila/prefetch do RabbitMQ, nome do banco de dados, issuer/audience
       do JWT, origens CORS e chaves de política de autenticação.
     - **Nunca exposta** (nem exibida nem gravável): segredos como
       `JUMENTIX_JWT_TOKEN_SECRET_KEY`, `JUMENTIX_REDIS_PASSWORD` e
       `JUMENTIX_RABBITMQ_URL`.
   - Valores editáveis são validados contra os conjuntos enum de
     `documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`; valores fora do enum são
     rejeitados com a lista de aceitos e nada é escrito.
   - O editor de ambiente de tempo de execução tem como alvo o arquivo de ambiente selecionado:
    - `dev` -> `apps/backend-template/src/config/.env.dev`
    - `staging` -> `apps/backend-template/src/config/.env.staging`
    - `ci` -> `apps/backend-template/src/config/.env.ci`
     `apps/backend-template/src/config/`:
    - `dev` -> `.env.dev` (`development` é um alias)
    - `staging` -> `.env.staging`
    - `ci` -> `.env.ci` (`test` é um alias)
4. **Gerenciamento de implantação**
   - Rastreia alvos de implantação e metadados de implantação em tempo de execução.
   - Cada alvo carrega o contrato de metadados por serviço do Requisito 059
     (JUM-481): `serviceType`, `deployTarget`, `runtimeProtocol`,
     `databaseDriver`, `keyValueDriver`, `pm2Profile`, além de nome, região
     e runtime.
   - As adições são validadas contra a matriz de implantação do Requisito 059
     lida da fonte legível por máquina compartilhada
     `src/model/deployCapabilityMatrix.js`: combinações tipo de serviço ×
     alvo de implantação sem linha na matriz, protocolos que o tipo de serviço
     não expõe e perfis PM2 em alvos serverless (ou ausentes em alvos
     gerenciados por PM2) são rejeitados na superfície de status não
     bloqueante com a restrição violada nomeada. Alvos legados persistidos
     antes deste alinhamento migram no carregamento.
   - Ciclo de vida (JUM-546): os alvos são editáveis in-place e duplicáveis —
     uma duplicata é uma cópia profunda independente renomeada pela regra
     ` (copy)`. O portão de adição/edição também impõe as regras de campo:
     nome obrigatório e único; padrão de runtime nome-mais-versão
     (`nodejs22.x`); e região obrigatória em alvos de nuvem (opcional no
     servidor dedicado self-hosted, onde o campo carrega informação de host).
     Dicas por tipo de alvo orientam o formulário, e toda rejeição nomeia a
     razão na superfície de status.

Guia de uso detalhado:

- [Recursos e uso do Designer de Domínio](./DOMAIN-DESIGNER-FEATURES-AND-USAGE.md)

## Correr

Servido por PM2:

- `bun run dev:service-management`
- o perfil dev padrão (`bun run dev`) também inicia o `service-management` através do PM2.

O estado do aplicativo persiste no Cana (IndexedDB). A migração unidirecional
do JUM-484 moveu o payload legado do `localStorage` do navegador no boot —
cópia de bytes, mesmas chaves fixadas, sem fallback para localStorage. O
JUM-485 mantém as abas abertas consistentes: cada aba assina os eventos de
escrita ordenados do Cana, os conecta através de um `BroadcastChannel`
compartilhado e reconcilia as mudanças remotas com o histórico local de
undo/redo, as edições pendentes e a seleção atual (o undo permanece somente
local e mudanças remotas não são desfazíveis).

O designer também é um PWA instalável (JUM-489): `manifest.webmanifest`, um
service worker clássico de app-shell (`sw.js`) com cache versionado e
limpável, e um aviso de atualização visível ao usuário — sem troca silenciosa
no meio de uma edição. O shell armazena em cache apenas
HTML/CSS/JS/manifesto/ícones; os dados da aplicação permanecem com o store do
designer (linha do Cana), nunca no service worker. A estratégia completa —
fluxo de atualização, escopo offline, fronteira de armazenamento e caminho de
recuperação — está documentada no
[README do aplicativo Service Management — Shell PWA](../../apps/service-management/README.pt-BR.md#shell-pwa).

Caminho de desenvolvimento recomendado:

1. `bun run dev:service-management`
2. Abra o URL de gerenciamento de serviço local
3. Modelo de domínios/entidades
4. Execute exportações (OAS/AsyncAPI por transporte/proto gRPC/esquema JSON/pacote)
5. Use artefatos gerados como contratos para implementação de API

## API Runtime Env (integrada)

- `GET /api/runtime/env?environment=dev|development|staging|ci|test`
- `POST /api/runtime/env`
- `GET /api/runtime/pm2-ecosystem?environment=dev|development|staging|production|prod|ci|test`

O servidor persiste chaves de tempo de execução aprovadas para arquivos em `apps/backend-template/src/config/`.
O contrato autoritativo — ambientes aceitos, classificação de chaves, conjuntos
de enum, semântica de escrita — é
[Contratos de ambiente de tempo de execução](./RUNTIME-ENVIRONMENT-CONTRACTS.pt-BR.md).

### O que H1 torna confiável

- **Localização fixa dos arquivos env.** Os arquivos env ficam em
  `apps/backend-template/src/config/` (substituível via
  `JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR`); o servidor falha fechado na
  inicialização quando o diretório está ausente em vez de silenciosamente servir
  padrões.
- **Parâmetro `environment` real.** Apenas `dev`, `development`, `staging`,
  `ci` e `test` são aceitos (insensível a maiúsculas após remoção de espaços);
  valores desconhecidos são explicitamente rejeitados com a lista de aceitos,
  nunca convertidos para `dev`.
- **Superfície de chaves classificada.** Cada chave de ambiente é exatamente uma
  de *editável*, *somente leitura* ou *nunca exposta* (segredos); as decisões de
  classificação por chave estão no
  [Requisito 126](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md).
- **Endpoint protegido.** Bind loopback por padrão, token bearer opcional para
  mutações e um log de auditoria de cada mutação.
- **Erros distinguíveis.** Falhas de parse, validação e filesystem são
  diferenciadas na resposta de erro (veja abaixo).

### Postura de segurança

- Bind padrão é `127.0.0.1` (apenas loopback).
- Vincular a todas as interfaces requer opt-in explícito via `JUMENTIX_SERVICE_MANAGEMENT_HOST=0.0.0.0`.
- Token bearer opcional para requisições de mutação via `JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN`.
- Cada mutação é registrada com timestamp, ambiente e chaves alteradas (não valores).

### Contrato de erro

- Ambiente desconhecido: `400` cujo `details` nomeia o valor e a lista de
  aceitos, nenhum arquivo escrito.
- Diretório de configuração ausente na inicialização: servidor encerra com erro claro.
- Arquivo de ambiente ausente ou outra falha de filesystem (permissões, disco
  cheio): `500 { "error": "Environment file operation failed.", "code": …,
  "path": …, "details": … }` — `code` é `ENV_FILE_NOT_FOUND` ou o código de
  erro do `fs` subjacente, `path` o path resolvido do arquivo env (JUM-543).
- Payload JSON malformado: `400 { "error": "Invalid payload.", "details": … }`
  com a falha de parse em `details` — diferenciado de falhas de filesystem,
  que surgem como a classe 500 acima, nunca como erro de payload.
- Mutação não autorizada: `401 { "error": "Unauthorized." }` quando token de auth está configurado.

## Fluxo de edição em tempo de execução

1. Selecione o ambiente em Configuração de Serviço.
2. Clique em `Load Environment` para ler os valores atuais do arquivo env.
3. Altere as chaves de tempo de execução no formulário.
4. Clique em `Salvar ambiente` para persistir os valores.
5. Reinicie o perfil PM2 se a alteração do tempo de execução afetar os processos ativos.

## Notas

- O editor de ambiente de tempo de execução limita intencionalmente as atualizações às chaves aprovadas (proteção).
- Combinações de tempo de execução não suportadas são bloqueadas pela validação de inicialização no bootstrap.

## Modelos de contêiner

Os modelos de contêiner de nível de serviço são fornecidos em:

- `apps/backend-template/docker/services/`

Perfis orquestrados:

- `apps/backend-template/docker-compose-service-templates.yml`

## Testes

Fumaça de integração:

```bash
bun run test:integration:service-management
```

Fumaça da unidade para presença de recurso de roteiro:

```bash
NODE_ENV=dev bun x jest apps/backend-template/test/unit/service-management/mvp.roadmap.features.test.ts --runInBand
```

