<!--
Arquivo gerado automaticamente a partir de: apps/service-management/README.md
Idioma alvo: Português (Brasil)
-->
# Aplicativo de gerenciamento de serviços

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/XpertMinds/Jumentix/tree/dev.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/XpertMinds/Jumentix/tree/dev)
[![codecov](https://codecov.io/gh/XpertMinds/Jumentix/branch/dev/graph/badge.svg)](https://codecov.io/gh/XpertMinds/Jumentix)
[![Status do Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_aaa-typescript-boilerplate&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=web2solutions_aaa-typescript-boilerplate)
[![Vulnerabilidades conhecidas](https://snyk.io/test/github/XpertMinds/Jumentix/badge.svg)](https://snyk.io/test/github/XpertMinds/Jumentix)
[![Nó](https://img.shields.io/badge/node-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-6BA539?logo=openapiinitiative&logoColor=white)](../../spec/1.0.0.yml)
[![AsyncAPI](https://img.shields.io/badge/AsyncAPI-3.0-9146FF)](../../spec)
[![Licença](https://img.shields.io/github/license/XpertMinds/Jumentix)](../../LICENSE)
[![Cheiros de código](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_aaa-typescript-boilerplate&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=web2solutions_aaa-typescript-boilerplate)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_aaa-typescript-boilerplate&metric=bugs)](https://sonarcloud.io/summary/new_code?id=web2solutions_aaa-typescript-boilerplate)
[![Vulnerabilidades](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_aaa-typescript-boilerplate&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=web2solutions_aaa-typescript-boilerplate)
[![Commitizen amigável](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
![Feito no Brasil com Amor](https://img.shields.io/badge/made%20in-%F0%9F%87%A7%F0%9F%87%B7%20Brasil%20with%E2%9D%A4%EF%B8%8F-blue)
[![#StandWithUkraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://vshymanskyy.github.io/StandWithUkraine)
[![Abrir no Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/XpertMinds/Jumentix)

`service-management` é um aplicativo local com guias para configuração de engenharia e fluxos de trabalho de design neste modelo.

Uso detalhado de recursos:

- [Recursos e uso do designer de domínio](../../documentation/md/DOMAIN-DESIGNER-FEATURES-AND-USAGE.md)
- [Documentação técnica de gerenciamento de serviços](./documentation/README.md)

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
   - Editor de mapeamento RBAC por entidade/ação com sinalizadores de escopo de locatário.
   - Designer de contrato de evento/mensagem (`event`, `command`, `request`, `response`) com metadados de esquema de carga útil.
   - Modelos de entidade: `crudAggregate`, `eventSourced`, `referenceData`, `tenantOwned`.
   - Visualização da geração de código para esqueletos de modelo de domínio/repositório/caso de uso/controlador/manipulador.
   - Gerador de exemplo de solicitação/resposta do esquema da entidade.
   - Exportadores: JSON, OpenAPI 3.1, Markdown, JSON Schema, AsyncAPI e pacote padrão.
   - Controles de composição OpenAPI (`oneOf`, `allOf`, `anyOf`, externo `$ref`, discriminador) por entidade.
   - Exportação/importação de pacotes de domínio para compartilhamento de modelos reutilizáveis.
   - Navegação em minimapa e modo de desempenho em tela grande.
2. **Designer de interface de comunicação**
   - Registrar adaptadores de interface de entrada (`HTTP/REST`, `gRPC`, `WebSocket`, `SSE`).
   - Rastreie o mapeamento de estrutura/tempo de execução, ponto de entrada e controlador.
3. **Configuração do serviço**
   - Configurar tipo de serviço (`REST API`, `WebSocket API + REST API`, `gRPC API + REST API`),
   modelo de execução, provedor de nuvem, perfil de ativos estáticos e portas de tempo de execução.
   - Inclui visualização do perfil de tempo de execução PM2 para implantações de VM.
   - Inclui editor de ambiente de tempo de execução para:
     - `AAA_HTTP_FRAMEWORK`
     - `AAA_REALTIME_API`
     - `AAA_REALTIME_API_PROTOCOL`
     - `AAA_REALTIME_API_DATABASE_DRIVER`
4. **Gerenciamento de implantação**
   - Registre alvos de implantação para VMs, servidores dedicados, EC2 e provedores de funções.

## Correr

Este aplicativo é atendido via PM2:

- `/Users/eduardoalmeida/apps/apps/apps/aaa-typescript-boilerplate/apps/service-management/server.js`

Comandos:

- `pnpm run dev:service-management`
- `pnpm run dev` (inicia automaticamente o gerenciamento de serviço + perfil REST)

## API de ambiente de tempo de execução

- `GET /api/runtime/env?environment=dev|staging|ci`
- `POST /api/runtime/env`

### Chaves Editáveis

- `AAA_HTTP_FRAMEWORK`
- `AAA_REALTIME_API`
- `AAA_REALTIME_API_PROTOCOL`
- `AAA_REALTIME_API_DATABASE_DRIVER`

### Mapeamento de ambiente

- `dev` -> `src/config/.env.dev`
- `staging` -> `src/config/.env.staging`
- `ci` -> `src/config/.env.ci`
