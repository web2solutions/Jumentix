<!--
Arquivo gerado automaticamente a partir de: apps/service-management/README.md
Idioma alvo: Português (Brasil)
-->
# Aplicativo de gerenciamento de serviços

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/XpertMinds/Jumentix/tree/dev.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/XpertMinds/Jumentix/tree/dev)
[![codecov](https://codecov.io/gh/XpertMinds/Jumentix/branch/dev/graph/badge.svg)](https://codecov.io/gh/XpertMinds/Jumentix)
[![Status do Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=Jumentix&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Jumentix)
[![Nó](https://img.shields.io/badge/node-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-6BA539?logo=openapiinitiative&logoColor=white)](../../spec/1.0.0.yml)
[![AsyncAPI](https://img.shields.io/badge/AsyncAPI-3.0-9146FF)](../../spec)
[![Licença](https://img.shields.io/github/license/XpertMinds/Jumentix)](../../LICENSE.md)
[![Cheiros de código](https://sonarcloud.io/api/project_badges/measure?project=Jumentix&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=Jumentix)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=Jumentix&metric=bugs)](https://sonarcloud.io/summary/new_code?id=Jumentix)
[![Vulnerabilidades](https://sonarcloud.io/api/project_badges/measure?project=Jumentix&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=Jumentix)
[![Commitizen amigável](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
![Feito no Brasil com Amor](https://img.shields.io/badge/made%20in-%F0%9F%87%A7%F0%9F%87%B7%20Brasil%20with%E2%9D%A4%EF%B8%8F-blue)
[![#StandWithUkraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://vshymanskyy.github.io/StandWithUkraine)
[![Abrir no Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/XpertMinds/Jumentix)

`service-management` é um aplicativo local com guias para configuração de engenharia e fluxos de trabalho de design neste modelo.

Uso detalhado de recursos:

- [Recursos e uso do designer de domínio](../../documentation/md/DOMAIN-DESIGNER-FEATURES-AND-USAGE.pt-BR.md)
- [Arquitetura de módulos e contrato da porta IDesignerStore](../../documentation/md/SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.pt-BR.md)
- [Garantias de paridade de contratos](../../documentation/md/SERVICE-MANAGEMENT-CONTRACT-PARITY.pt-BR.md)
- [Console de operações](../../documentation/md/SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.pt-BR.md)
- [Design system e shell PWA](../../documentation/md/SERVICE-MANAGEMENT-DESIGN-SYSTEM-PWA.pt-BR.md)
- [Adoção do Cana, migração e comportamento offline](../../documentation/md/SERVICE-MANAGEMENT-CANA-ADOPTION.pt-BR.md)
- [Documentação técnica de gerenciamento de serviços](./documentation/README.pt-BR.md)

## Guias

1. **Designer de Domínio**
   - MVP completo de modelagem de ER/domínio.
   - Retângulos de domínio, modelagem de entidades, design de relacionamento, exportação/importação OpenAPI, verificação de modelos.
   - Conectores de arrasto de relacionamento âncora a âncora nas bordas da entidade.
   - Editor de contexto limitado de domínio (incluindo dependências de pacotes e metadados de objetos de valor compartilhados).
   - Controles de posição de etiqueta de relacionamento (editor de deslocamento + redefinição) e controles de caminho de ponto de curvatura.
   - Editor agregado de raiz + invariantes com marcador AR visual em cartões de entidade.
   - Pré-visualização de comparação/migração de esquema com suporte a snapshot de linha de base.
   - Filtro de severidade de validação e portão de qualidade de exportação (bloqueio em questões críticas).
   - Editor de mapeamento RBAC por entidade/ação, alinhado ao contrato de autorização de tenant e RBAC (funções normalizadas; escopo de locatário derivado das funções).
   - Designer de contrato de evento/mensagem (`event`, `command`, `request`, `response`) com metadados de esquema de carga útil.
   - Modelos de entidade: `crudAggregate`, `eventSourced`, `referenceData`, `tenantOwned`.
   - Visualização da geração de código para esqueletos de modelo de domínio/repositório/caso de uso/controlador/manipulador.
   - Gerador de exemplo de solicitação/resposta do esquema da entidade.
   - Exportadores: JSON, OpenAPI 3.1, Markdown, JSON Schema, AsyncAPI 3.0 por transporte
     (`<version>.websocket.yml` / `<version>.grpc.yml`, convenções canônicas de
     `spec/asyncapi/`), proto gRPC (`async-api.proto`) e pacote padrão.
   - Controles de composição OpenAPI (`oneOf`, `allOf`, `anyOf`, externo `$ref`, discriminador) por entidade.
   - Exportação/importação de pacotes de domínio para compartilhamento de modelos reutilizáveis.
   - Navegação em minimapa e modo de desempenho em tela grande.
2. **Designer de interface de comunicação**
   - Registrar adaptadores de interface de entrada (`HTTP/REST`, `gRPC`, `WebSocket`, `SSE`).
   - Rastreie o mapeamento de estrutura/tempo de execução, ponto de entrada e controlador.
3. **Configuração do serviço**
   - Configurar tipo de serviço (`REST API`, `WebSocket API + REST API`, `gRPC API + REST API`),
   modelo de execução, provedor de nuvem, perfil de ativos estáticos e portas de tempo de execução.
   - As gravações são validadas (JUM-544): as portas devem ser inteiros entre 1–65535 e únicas
   entre os protocolos que o tipo de serviço selecionado realmente vincula, e a combinação
   modo de execução × provedor de nuvem deve existir na matriz de implantação do Requisito 059
   (lida da fonte legível por máquina compartilhada `src/model/deployCapabilityMatrix.js`).
   Perfis inválidos são relatados na superfície de status da guia e não são salvos.
   - A visualização do perfil de tempo de execução PM2 para implantações de VM lê os
     arquivos reais `pm2/ecosystem.*.cjs` através de `GET /api/runtime/pm2-ecosystem`
     (JUM-480): a lista de processos e o comando `pm2 start` sugerido derivam do
     arquivo de ecossistema do ambiente de visualização selecionado — nenhuma lista
     de processos ou invocação de gerenciador de pacotes é fixada em código, de modo
     que uma edição no ecossistema (ou a mudança de formato de invocação da migração
     para Bun) é refletida sem alteração no designer. Ambientes sem arquivo de
     ecossistema exibem um estado vazio explícito, nunca uma visualização
     silenciosamente em branco.
   - Editor de ambiente de tempo de execução multi-ambiente (JUM-480): o seletor de
     Environment carrega os valores do ambiente escolhido, o painel nomeia o arquivo
     env exato que a próxima gravação escreverá, e a resposta da gravação confirma o
     arquivo escrito.
   - Inclui editor de ambiente de tempo de execução para:
     - `JUMENTIX_HTTP_FRAMEWORK`
     - `JUMENTIX_REALTIME_API`
     - `JUMENTIX_REALTIME_API_PROTOCOL`
     - `JUMENTIX_REALTIME_API_DATABASE_DRIVER`
4. **Gerenciamento de implantação**
   - Registre alvos de implantação para VMs, servidores dedicados, EC2 e provedores de funções.
   - Cada alvo carrega os metadados por serviço do Requisito 059 (JUM-481):
     `serviceType`, `deployTarget`, `runtimeProtocol`, `databaseDriver`,
     `keyValueDriver` e `pm2Profile`. As adições são validadas contra a
     matriz de implantação lida da fonte legível por máquina compartilhada
     `src/model/deployCapabilityMatrix.js` — combinações sem linha na matriz,
     protocolos que o tipo de serviço não expõe e perfis PM2 em alvos
     serverless são rejeitados na superfície de status com a restrição
     nomeada. Alvos persistidos antes deste alinhamento migram no
     carregamento.
   - Ciclo de vida (JUM-546): os alvos são editáveis in-place e duplicáveis —
     uma duplicata é uma cópia profunda independente renomeada pela regra
     ` (copy)`. O portão de adição/edição também impõe as regras de campo:
     nome único, padrão de runtime nome-mais-versão (`nodejs22.x`) e região
     obrigatória em alvos de nuvem (opcional no servidor dedicado
     self-hosted, onde o campo carrega informação de host), com dicas de
     campo por tipo de alvo.

## Design System e Acessibilidade

O designer adota o design system Jumentix na camada de tokens (JUM-488) — é
uma SPA vanilla sem etapa de build, portanto a adoção significa tokens e
idiomas compartilhados, não importação de componentes React:

- `tokens.css` — cópia vendida das custom properties compartilhadas `--jtx-*`
  (fonte da verdade: `apps/jumentix-website/components/design-system/tokens.css`):
  rampas de cores, superfícies, linhas, raios, sombras, escala de espaçamento,
  movimento e as pilhas tipográficas Inter/IBM Plex Mono. Mudanças de tokens
  acontecem primeiro no arquivo do site e são espelhadas aqui.
- `styles.css` — cada valor cosmético (cor, tipografia, raio, sombra,
  espaçamento) resolve para um token `--jtx-*`. Permanecem literais apenas a
  geometria estrutural da qual a matemática do canvas depende (canvas de
  3200×2200, grade de 24px, domínios de 520px, entidades de 190px — fixada por
  `src/model/modelQueries.js` e sua suíte de unidade), além da densidade
  compacta dos inspetores. As regras em nível de elemento têm escopo em
  `.service-management-shell` para que a folha de estilo possa ser incorporada
  no Storybook do site sem vazamentos.
- A cobertura do Storybook vive no workspace do site
  (`apps/jumentix-website/components/service-management-designer/`), montando a
  marcação e as folhas de estilo reais do designer; o smoke do manifesto exige
  essas histórias.

Semântica de acessibilidade sobre a mesma marcação: tablist WAI-ARIA com
tabindex móvel e navegação por setas/Home/End (`src/ui/tabs.js`), `aria-pressed`
nos botões de alternância de visualização (sincronizado por `src/ui/canvas.js`),
nomes acessíveis em todos os controles, status de seleção em live region, link
de salto para o workspace do canvas e Espaço restaurado à ativação nativa de
botões. O caminho de teclado do canvas é estrutural: selecione entidades nas
listas da barra lateral, mova a seleção com as setas (Shift para passos
maiores) e exclua com Delete/Backspace.

## Correr

Este aplicativo é atendido via PM2:

- `apps/service-management/server.js`

Comandos:

- `pnpm run dev:service-management`
- `pnpm run dev` (inicia automaticamente o gerenciamento de serviço + perfil REST)

## Serviço Estático

`server.js` serve este SPA vanilla sem etapa de build a partir de um manifesto
de inicialização: uma lista de permissões dos arquivos que existiam quando o
processo foi iniciado. O manifesto é um mecanismo de segurança contra travessia
de caminhos — ele limita a superfície servível mesmo se a normalização de
caminhos tiver uma falha — portanto **a produção serve apenas o manifesto de
inicialização** e arquivos adicionados depois exigem uma reinicialização.

Em desenvolvimento isso seria um defeito (um arquivo editado manualmente e
adicionado após a inicialização retornaria 404 até a reinicialização), então o
modo de desenvolvimento revarre o manifesto **apenas em caso de ausência** —
nunca por requisição, o que transformaria cada 404 em uma varredura de
diretório — e a nova tentativa passa pela mesma validação de normalização e
contenção de um acesso do manifesto de inicialização.

A seleção de modo é configuração explícita, não inferida apenas de `NODE_ENV`:

- `JUMENTIX_SERVICE_MANAGEMENT_STATIC_MANIFEST_REFRESH=on-miss` — revarredura
  em caso de ausência (comportamento de desenvolvimento), independentemente de
  `NODE_ENV`.
- `JUMENTIX_SERVICE_MANAGEMENT_STATIC_MANIFEST_REFRESH=boot-only` — manifesto
  de inicialização congelado (comportamento de produção), independentemente de
  `NODE_ENV`.
- Não definido — o padrão deriva de `NODE_ENV`: `dev`/`development` =>
  `on-miss`, qualquer outro valor => `boot-only`.

## Shell PWA

O designer é um PWA instalável (JUM-489). O shell é composto por:

- `manifest.webmanifest` — nome, ícones (`icons/`), tema, exibição
  `standalone`, URL inicial/escopo `./`. Servido como
  `application/manifest+json`.
- `sw.js` — o service worker do app-shell. Um script CLÁSSICO (não um
  módulo), servido a partir da raiz do aplicativo para que seu escopo seja o
  aplicativo inteiro.
- `src/pwa/pwaShell.js` — registro no lado da página, o aviso de atualização
  e o caminho de recuperação, conectados por um pequeno módulo inline em
  `index.html` (deliberadamente fora do `script.js`: o shell nunca reordena a
  inicialização do designer).

### Estratégia de cache

O worker pré-armazena em cache APENAS o SHELL — HTML, CSS, o grafo de módulos
JS, o manifesto e os ícones — sob um nome de cache VERSIONADO
(`service-management-shell@<SHELL_VERSION>`), e serve essas entradas com
cache-first. O `SHELL_VERSION` (em `sw.js`) é incrementado a cada mudança do
shell, então uma atualização publicada nunca modifica o cache do qual a
versão em execução é servida, e o `activate` exclui todos os caches
`service-management-shell@*` obsoletos.

Dados da aplicação NUNCA são armazenados em cache aqui: respostas de `/api/`,
requisições não-GET e de origem cruzada passam direto para a rede e, offline,
falham naturalmente. A persistência pertence ao Cana (JUM-483/484 — sem
fallback); uma cópia de conveniência na Cache API seria um fallback pela
porta dos fundos.

A lista de pré-cache e o manifesto estático do servidor devem concordar sobre
o que é o shell (JUM-463): a suíte de unidade garante que cada entrada
pré-cacheada existe em disco, e o smoke de navegador requisita cada entrada
contra o servidor real.

### Fluxo de atualização

Um shell cache-first é um cache sem expiração que o usuário não consegue ver
— portanto o caminho de atualização é a substância, não um detalhe:

1. Uma atualização publicada (um `sw.js` alterado) é instalada e AGUARDA; o
   shell em execução continua servindo. Não há troca silenciosa no meio de
   uma edição.
2. A página exibe um aviso: "A new version of Service Management is
   available." — com "Reload to update", "Later" e "Reset app shell".
3. Somente em "Reload to update" a página envia `SKIP_WAITING`; o worker em
   espera é ativado, exclui caches obsoletos, assume os clientes, e a página
   recarrega no `controllerchange`. "Later" adia: o worker em espera continua
   lá no próximo carregamento, e o aviso retorna.

### Escopo offline e a fronteira de armazenamento

Com a rede desabilitada o SHELL carrega e permanece interativo — esse é todo
o contrato offline. A disponibilidade dos dados é domínio do Cana, não do
shell: o shell nunca mascara um banco de dados despejado como uma primeira
execução, e nunca apresenta dados em cache próprios.

O cache do service worker e o banco de dados Cana são armazenamentos
DIFERENTES, mas o "limpar dados do site" do navegador remove AMBOS. A
presença do shell nunca implica que os dados do designer estão seguros. A
ação "Reset app shell" é o caminho de recuperação que não exige conhecimento
de service worker: ela cancela o registro do worker, exclui APENAS os caches
`service-management-shell@*` e recarrega — os dados do Cana permanecem
intocados.

### Testes do PWA

- Unidade: `apps/backend-template/test/unit/service-management/pwaShell.test.ts`
  (handlers do worker, fluxo de atualização, recuperação — com fakes
  injetados).
- Smoke de navegador:
  `apps/backend-template/test/integration/ServiceManagement/pwaShell.browser.integration.test.ts`
  (tipos de conteúdo do manifesto/worker, concordância pré-cache↔manifesto
  estático, registro, carregamento offline do shell com o servidor parado, o
  fluxo completo de atualização com limpeza de caches obsoletos).

## API de ambiente de tempo de execução

Integrada em `apps/service-management/server.js`:

- `GET /api/runtime/env?environment=dev|development|staging|ci|test`
- `POST /api/runtime/env`
- `GET /api/runtime/pm2-ecosystem?environment=dev|development|staging|production|prod|ci|test`
  (somente leitura; fonte da visualização PM2 — relata os apps do arquivo real
  `pm2/ecosystem.*.cjs` do ambiente selecionado com comandos `pm2 start` por app
  derivados da definição do ecossistema, um estado explícito `exists: false`
  quando o arquivo está ausente, e o envelope 500 honesto quando o arquivo está
  ilegível ou quebrado)

O contrato completo (conjuntos de enum, semântica de escrita, higiene de resposta) está em
[Contratos de ambiente de tempo de execução](../../documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.pt-BR.md).

### Chaves Editáveis

- `JUMENTIX_HTTP_FRAMEWORK`
- `JUMENTIX_REALTIME_API`
- `JUMENTIX_REALTIME_API_PROTOCOL`
- `JUMENTIX_REALTIME_API_DATABASE_DRIVER`

Cada chave de ambiente pertence a exatamente um de três níveis: *editável* (legível e
gravável), *somente leitura* (visível no GET, nunca gravável) e *nunca exposta*
(segredos — ausente do GET e não gravável). A classificação autoritativa por chave
é mantida no
[Requisito 126](../../.agents/requirements/software/126-service-management-ownership-and-public-contracts.md).

### Mapeamento de ambiente

Os arquivos env ficam em `apps/backend-template/src/config/`:

- `dev` -> `apps/backend-template/src/config/.env.dev`
- `development` -> `apps/backend-template/src/config/.env.dev` (alias)
- `staging` -> `apps/backend-template/src/config/.env.staging`
- `ci` -> `apps/backend-template/src/config/.env.ci`
- `test` -> `apps/backend-template/src/config/.env.ci` (alias)

`environment` é um parâmetro real: a comparação é insensível a maiúsculas após
remoção de espaços, valores desconhecidos são rejeitados com `400` e a lista de
aceitos (nunca silenciosamente convertidos para `dev`) e, quando omitido, o padrão
é `NODE_ENV` ou `dev`. O diretório de configuração pode ser substituído com
`JUMENTIX_SERVICE_MANAGEMENT_CONFIG_DIR`; o servidor encerra na inicialização com
um erro se o diretório não existir.

### Postura de segurança

- Bind padrão é `127.0.0.1` (apenas loopback); substitua com
  `JUMENTIX_SERVICE_MANAGEMENT_HOST`, porta com
  `JUMENTIX_SERVICE_MANAGEMENT_PORT` (padrão `3200`).
- Quando `JUMENTIX_SERVICE_MANAGEMENT_AUTH_TOKEN` está definido, `POST
  /api/runtime/env` requer `Authorization: Bearer <token>` e retorna `401`
  caso contrário; quando não definido, a operação apenas em loopback é permitida
  sem token.
- Cada mutação é registrada com timestamp, ambiente e chaves alteradas (não
  valores).

### Contrato de erro

- Ambiente desconhecido: `400` nomeando o valor e a lista de aceitos; nenhum
  arquivo escrito.
- Corpo JSON malformado: `400` com a falha de parse em `details`.
- Arquivo env ausente: `400` com o path resolvido em `details`.
- Token bearer ausente/incorreto: `401` (`{ "error": "Unauthorized." }`).
