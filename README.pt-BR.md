<!--
Arquivo gerado automaticamente a partir de: README.md
Idioma alvo: Português (Brasil)
-->
# Jumentix – Fábrica de Software para Equipes de Produto

[![GitHub Actions dev](https://github.com/XpertMinds/Jumentix/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/XpertMinds/Jumentix/actions/workflows/ci.yml?query=branch%3Adev)
[![GitHub Actions main](https://github.com/XpertMinds/Jumentix/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/XpertMinds/Jumentix/actions/workflows/ci.yml?query=branch%3Amain)
[![Codecov dev](https://codecov.io/gh/XpertMinds/Jumentix/branch/dev/graph/badge.svg?flag=project)](https://app.codecov.io/gh/XpertMinds/Jumentix/tree/dev)
[![Codecov main](https://codecov.io/gh/XpertMinds/Jumentix/branch/main/graph/badge.svg?flag=project)](https://app.codecov.io/gh/XpertMinds/Jumentix/tree/main)
[![Status do Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=Jumentix&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Jumentix)
[![Classificação de Segurança](https://sonarcloud.io/api/project_badges/measure?project=Jumentix&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Jumentix)
[![Cobertura Sonar](https://sonarcloud.io/api/project_badges/measure?project=Jumentix&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Jumentix)
[![Bun](https://img.shields.io/badge/bun-1.3.13-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Compatibilidade Node](https://img.shields.io/badge/node%20compat-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-6BA539?logo=openapiinitiative&logoColor=white)](./spec/1.0.0.yml)
[![AsyncAPI](https://img.shields.io/badge/AsyncAPI-3.0-9146FF)](./spec)
[![Repositório](https://img.shields.io/badge/repository-private-24292f?logo=github)](https://github.com/XpertMinds/Jumentix)
[![Licença](https://img.shields.io/badge/license-see%20LICENSE-blue)](./LICENSE)
[![Rode com Express](https://img.shields.io/badge/Rode%20com-Express-gold?style=flat-square&logo=express&logoColor=000)](https://expressjs.com/)
[![Rode com Fastify](https://img.shields.io/badge/Rode%20com-Fastify-gold?style=flat-square&logo=fastify&logoColor=000)](https://fastify.dev/)
[![Rode com Restify](https://img.shields.io/badge/Rode%20com-Restify-gold?style=flat-square&logo=node.js&logoColor=000)](http://restify.com/)
[![Rode com AdonisJS](https://img.shields.io/badge/Rode%20com-AdonisJS-gold?style=flat-square&logo=adonisjs&logoColor=000)](https://adonisjs.com/)
[![Rode com FeathersJS](https://img.shields.io/badge/Rode%20com-FeathersJS-gold?style=flat-square&logo=feathersjs&logoColor=000)](https://feathersjs.com/)
[![Rode com LoopBack](https://img.shields.io/badge/Rode%20com-LoopBack-gold?style=flat-square&logo=loopback&logoColor=000)](https://loopback.io/)
[![Rode com SailsJS](https://img.shields.io/badge/Rode%20com-SailsJS-gold?style=flat-square&logo=sailsdotjs&logoColor=000)](https://sailsjs.com/)
[![Rode com DerbyJS](https://img.shields.io/badge/Rode%20com-DerbyJS-gold?style=flat-square&logo=javascript&logoColor=000)](https://derbyjs.com/)
[![Rode com Total.js](https://img.shields.io/badge/Rode%20com-Total.js-gold?style=flat-square&logo=javascript&logoColor=000)](https://www.totaljs.com/)
[![Rode com Serverless](https://img.shields.io/badge/Rode%20com-Serverless-gold?style=flat-square&logo=serverless&logoColor=000)](https://www.serverless.com/)
[![Rode na Cloudflare Workers](https://img.shields.io/badge/Rode%20na-Cloudflare%20Workers-gold?style=flat-square&logo=cloudflare&logoColor=000)](https://workers.cloudflare.com/)
[![Rode na Vercel Functions](https://img.shields.io/badge/Rode%20na-Vercel%20Functions-gold?style=flat-square&logo=vercel&logoColor=000)](https://vercel.com/docs/functions)
[![#StandWithUkraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://vshymanskyy.github.io/StandWithUkraine)

## Mapa de cobertura e CI

| Gate obrigatório | `main` | `dev` |
| --- | :---: | :---: |
| Workflow GitHub Actions | [![GitHub Actions main](https://github.com/XpertMinds/Jumentix/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/XpertMinds/Jumentix/actions/workflows/ci.yml?query=branch%3Amain) | [![GitHub Actions dev](https://github.com/XpertMinds/Jumentix/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/XpertMinds/Jumentix/actions/workflows/ci.yml?query=branch%3Adev) |
| Cobertura de projeto no Codecov | [![Codecov main](https://codecov.io/gh/XpertMinds/Jumentix/branch/main/graph/badge.svg?flag=project)](https://app.codecov.io/gh/XpertMinds/Jumentix/tree/main) | [![Codecov dev](https://codecov.io/gh/XpertMinds/Jumentix/branch/dev/graph/badge.svg?flag=project)](https://app.codecov.io/gh/XpertMinds/Jumentix/tree/dev) |
| Testes por branch | `branch-gate` | `branch-gate` |
| Cobertura de projeto + patch | `coverage` | somente promoção de release |
| Review de segurança third-party | `third-party-review` | somente PR |

PRs de feature, fix, docs e CI miram `dev` e rodam o gate barato sensível a
camadas selecionado por `test-map.json`; o alvo é dez minutos ou menos. Jobs
completos de workspace, browser, cobertura, website e banco ficam reservados
para promoções de release `dev -> main`, pushes em `main` e execuções completas
agendadas.

A cobertura é produzida e aplicada pelo job GitHub Actions `coverage` quando a suite
completa roda. O workflow envia LCOV ao Codecov com a flag `project` quando
`CODECOV_TOKEN` está configurado. O Codecov fornece o mapa de cobertura arquivo
a arquivo para cada branch longa:

- [Mapa de arquivos Codecov para `dev`](https://app.codecov.io/gh/XpertMinds/Jumentix/tree/dev)
- [Mapa de arquivos Codecov para `main`](https://app.codecov.io/gh/XpertMinds/Jumentix/tree/main)

O gate rígido continua sendo a cobertura pertencente ao repositório. Cada
execução retém evidências Istanbul JSON e LCOV. Os mínimos são:

| Statements | Linhas | Funções | Branches | Linhas alteradas |
| :---: | :---: | :---: | :---: | :---: |
| ≥ 99% | ≥ 99% | ≥ 99% | ≥ 90% | ≥ 99% |

[Abrir execuções GitHub Actions e evidências para download](https://github.com/XpertMinds/Jumentix/actions/workflows/ci.yml)

Jumentix é um produto monorepo que funciona como uma fábrica de software para equipes de engenharia e proprietários de produtos. Ele ajuda você a passar da ideia ao SaaS pronto para produção em dias, não meses, com uma arquitetura que prioriza o contrato, flexibilidade de tempo de execução e governança de nível empresarial.

> **Repositório privado canônico:** `XpertMinds/Jumentix`.
> `web2solutions/aaa-typescript-boilerplate` está obsoleto, é somente leitura e
> não aceita novas modificações. A coordenação de agentes é canônica no
> Firestore Database (Requisito `089`); os antigos registries em
> `XpertMinds/jumentix-agent-registry` e `web2solutions` estão obsoletos e são
> somente leitura. Consulte os Requisitos `089`, `103` e `104`.

## Índice

- [A lacuna de entrega empresarial](#the-enterprise-delivery-gap)
- [Mapa de cobertura e CI](#mapa-de-cobertura-e-ci)
- [Por que Jumentix vence](#why-jumentix-wins)
- [ROI do negócio](#roi do negócio)
- [Quem se beneficia](#quem-beneficia)
- [O que você pode lançar](#o que você pode lançar)
- [Lançar manuais](#launch-playbooks)
- [Caminhos de adoção](#caminhos de adoção)
- [Posicionamento Estratégico](#posicionamento estratégico)
- [Documentação Técnica](#documentação-técnica)
- [Governança do Projeto](#governança do projeto)

## A lacuna de entrega empresarial

As equipes empresariais raramente falham por causa de ideias. Eles falham porque é gasto muito tempo reconstruindo a mesma base de plataforma: decisões de arquitetura, contratos, adaptadores, CI/CD, controles de segurança e encanamento de implantação.

Jumentix elimina esse desperdício. Sua equipe começa em uma fábrica de software de nível de produção e investe tempo onde a receita é gerada: diferenciação do produto.

## Por que Jumentix vence

- **Tempo de lançamento no mercado mais rápido**: passe da ideia à arquitetura de produção em dias.
- **Menor risco de entrega**: portões rigorosos de qualidade, segurança e governança estão integrados.
- **Escalável por design**: comece modular, evolua para microsserviços sem reescrever tudo.
- **Operações que priorizam o contrato**: APIs e canais em tempo real permanecem alinhados aos modelos de negócios.
- **Flexibilidade em nuvem/tempo de execução**: implante onde sua empresa precisa, não onde seu padrão está bloqueado.

## ROI do negócio

| Métrica | Fundação personalizada típica | Com Jumentix |
| --- | --- | --- |
| Tempo de inicialização da plataforma | Alto e imprevisível | Reduzido e padronizado |
| Consistência da arquitetura | Varia de acordo com o time | Consistente entre equipes |
| Retrabalho durante fase de escala | Frequente | Significativamente inferior |
| Preparação para conformidade/qualidade | Esforço de fase final | Integrado ao fluxo de entrega |
| Integração para novos engenheiros | Lento | Mais rápido devido a padrões repetíveis |

## Quem se beneficia

- **Proprietários de produtos**: valide e lance ofertas de SaaS com mais rapidez.
- **CTOs e gerentes de engenharia**: padronize a arquitetura e a execução entre as equipes.
- **Equipes de plataforma**: aplique políticas de qualidade, cobertura e segurança com bases reutilizáveis.
- **Desenvolvedores**: gastem menos tempo conectando a infraestrutura e mais tempo enviando recursos.

## O que você pode lançar com Jumentix

- APIs REST empresariais
- APIs em tempo real (WebSocket e gRPC)
- Serviços de back-end como funções
- Monólitos SaaS modulares prontos para decomposição
- Ecossistemas de microsserviços com contratos e governança compartilhados
- Sites de produtos comerciais com visibilidade de changelog ao vivo apoiada pelo GitHub

## Lançar manuais

- [Criando SPA/PWA com Jumentix](./apps/service-management/documentation/guides/CREATING-SPA-PWA-WITH-JUMENTIX.md)
- [Criando uma API REST com Jumentix](./apps/backend-template/documentation/guides/CREATING-REST-API-WITH-JUMENTIX.md)
- [Criando uma API em tempo real com Jumentix](./apps/backend-template/documentation/guides/CREATING-REALTIME-API-WITH-JUMENTIX.md)
- [Criando um monólito SaaS com Jumentix](./documentation/md/guides/CREATING-SAAS-MONOLITH-WITH-JUMENTIX.md)
- [Criando microsserviços SaaS com Jumentix](./documentation/md/guides/CREATING-SAAS-MICROSERVICES-WITH-JUMENTIX.md)

## Caminhos de adoção

- Comece com uma API de missão crítica e comprove ganhos na velocidade de entrega.
- Expanda para um monólito SaaS completo com fluxos de trabalho de front-end/backend compartilhados.
- Dimensione para vários serviços de domínio com contratos e governança padronizados.
- Estabelecer Jumentix como plataforma interna de entrega empresarial.

## Posicionamento Estratégico

Jumentix não é apenas um repositório de modelos. É um produto extensível de fábrica de software para construir, dimensionar e operar aplicativos empresariais com qualidade técnica consistente.

## Documentação Técnica

A documentação de desenvolvimento técnico é intencionalmente separada deste README comercial.

- [Hub de Documentação (EN)](documentation/README.md)
- [Hub de Documentação (PT-BR)](documentation/README.pt-BR.md)

## Governança do Projeto

Fonte da verdade sobre gerenciamento de tarefas:

- [Linear - Jumentix](https://linear.app/jumentix)
