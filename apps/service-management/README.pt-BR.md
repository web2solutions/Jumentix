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
   - Inclui visualização do perfil de tempo de execução PM2 para implantações de VM.
   - Inclui editor de ambiente de tempo de execução para:
     - `JUMENTIX_HTTP_FRAMEWORK`
     - `JUMENTIX_REALTIME_API`
     - `JUMENTIX_REALTIME_API_PROTOCOL`
     - `JUMENTIX_REALTIME_API_DATABASE_DRIVER`
4. **Gerenciamento de implantação**
   - Registre alvos de implantação para VMs, servidores dedicados, EC2 e provedores de funções.

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

## API de ambiente de tempo de execução

Integrada em `apps/service-management/server.js`:

- `GET /api/runtime/env?environment=dev|development|staging|ci|test`
- `POST /api/runtime/env`

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
