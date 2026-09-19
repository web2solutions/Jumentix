# Jumentix

Jumentix e uma fabrica de software de codigo aberto para equipes que criam produtos SaaS. Ela oferece fundacoes orientadas por contratos para APIs, servicos em tempo real, aplicacoes web e dominios modulares, para que a equipe concentre sua energia no produto.

[![GitHub Actions dev](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml?query=branch%3Adev)
[![GitHub Actions main](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml?query=branch%3Amain)
[![Codecov dev](https://codecov.io/gh/web2solutions/Jumentix/branch/dev/graph/badge.svg)](https://app.codecov.io/github/web2solutions/Jumentix/tree/dev)
[![Codecov main](https://codecov.io/gh/web2solutions/Jumentix/branch/main/graph/badge.svg)](https://app.codecov.io/github/web2solutions/Jumentix/tree/main)
[![Qualidade SonarCloud dev](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_Jumentix&metric=alert_status&branch=dev)](https://sonarcloud.io/summary/new_code?id=web2solutions_Jumentix&branch=dev)
[![Confiabilidade SonarCloud dev](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_Jumentix&metric=reliability_rating&branch=dev)](https://sonarcloud.io/summary/new_code?id=web2solutions_Jumentix&branch=dev)
[![Qualidade SonarCloud main](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_Jumentix&metric=alert_status&branch=main)](https://sonarcloud.io/summary/new_code?id=web2solutions_Jumentix&branch=main)
[![Confiabilidade SonarCloud main](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_Jumentix&metric=reliability_rating&branch=main)](https://sonarcloud.io/summary/new_code?id=web2solutions_Jumentix&branch=main)
[![Bun](https://img.shields.io/badge/bun-1.3.13-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-6BA539?logo=openapiinitiative&logoColor=white)](./spec/1.0.0.yml)
[![AsyncAPI](https://img.shields.io/badge/AsyncAPI-3.0-9146FF)](./spec)
[![Licenca](https://img.shields.io/badge/licenca-AGPL--3.0-blue)](./LICENSE.pt-BR.md)

## O Que Voce Pode Criar

- APIs REST, WebSocket e gRPC com contratos reutilizaveis.
- Aplicacoes SaaS que evoluem de dominios modulares para servicos.
- Sites de produto, ferramentas operacionais e fluxos de design de dominio.
- Servicos para servidores convencionais, plataformas serverless e runtimes de edge.

## Comece Agora

```bash
git clone https://github.com/web2solutions/Jumentix.git
cd Jumentix
bun install --frozen-lockfile
bun run dev:express
```

Escolha um ponto de partida nos guias abaixo e adapte os contratos e modulos gerados ao seu produto.

## Guias e Documentacao

- [Central de documentacao](documentation/README.pt-BR.md)
- [Documentation hub in English](documentation/README.pt-BR.md)
- [Use o Service Manager e o Domain Designer](./documentation/md/guides/USING-SERVICE-MANAGER-AND-DOMAIN-DESIGNER.pt-BR.md)
- [Crie uma SPA ou PWA](./apps/service-management/documentation/guides/CREATING-SPA-PWA-WITH-JUMENTIX.pt-BR.md)
- [Crie uma API REST](./apps/backend-template/documentation/guides/CREATING-REST-API-WITH-JUMENTIX.pt-BR.md)
- [Crie uma API em tempo real](./apps/backend-template/documentation/guides/CREATING-REALTIME-API-WITH-JUMENTIX.pt-BR.md)
- [Crie um monolito SaaS](./documentation/md/guides/CREATING-SAAS-MONOLITH-WITH-JUMENTIX.pt-BR.md)
- [Crie microsservicos SaaS](./documentation/md/guides/CREATING-SAAS-MICROSERVICES-WITH-JUMENTIX.pt-BR.md)

## Cobertura

### Desenvolvimento

[![Codecov Grid para dev](https://codecov.io/gh/web2solutions/Jumentix/branch/dev/graphs/tree.svg)](https://app.codecov.io/github/web2solutions/Jumentix/tree/dev)

### Main

[![Codecov Grid para main](https://codecov.io/gh/web2solutions/Jumentix/branch/main/graphs/tree.svg)](https://app.codecov.io/github/web2solutions/Jumentix/tree/main)

## Contribuindo

Contribuicoes sao bem-vindas. Leia o [guia de contribuicao](./documentation/md/CONTRIBUTING-AND-TOOLING.pt-BR.md), abra uma issue para discutir mudancas substanciais e envie pull requests focados.

## Licenca

Jumentix e distribuido sob a [GNU Affero General Public License v3.0](./LICENSE.pt-BR.md).
