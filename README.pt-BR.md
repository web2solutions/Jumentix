<!--
Arquivo gerado automaticamente a partir de: README.md
Idioma alvo: Português (Brasil)
-->
# Jumentix – Fábrica de Software para Equipes de Produto

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/web2solutions/aaa-typescript-boilerplate/tree/dev.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/web2solutions/aaa-typescript-boilerplate/tree/dev)
[![codecov](https://codecov.io/gh/web2solutions/aaa-typescript-boilerplate/branch/dev/graph/badge.svg)](https://codecov.io/gh/web2solutions/aaa-typescript-boilerplate)
[![Status do Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_aaa-typescript-boilerplate&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=web2solutions_aaa-typescript-boilerplate)
[![Classificação de segurança](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_aaa-typescript-boilerplate&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=web2solutions_aaa-typescript-boilerplate)
[![Vulnerabilidades conhecidas](https://snyk.io/test/github/web2solutions/aaa-typescript-boilerplate/badge.svg)](https://snyk.io/test/github/web2solutions/aaa-typescript-boilerplate)
[![Nó](https://img.shields.io/badge/node-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-6BA539?logo=openapiinitiative&logoColor=white)](./spec/1.0.0.yml)
[![AsyncAPI](https://img.shields.io/badge/AsyncAPI-3.0-9146FF)](./spec)
[![Licença](https://img.shields.io/github/license/web2solutions/aaa-typescript-boilerplate)](./LICENSE)
[![Última confirmação](https://img.shields.io/github/last-commit/web2solutions/aaa-typescript-boilerplate/dev)](https://github.com/web2solutions/aaa-typescript-boilerplate/commits/dev)
[![#StandWithUkraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://vshymanskyy.github.io/StandWithUkraine)

Jumentix é um produto monorepo que funciona como uma fábrica de software para equipes de engenharia e proprietários de produtos. Ele ajuda você a passar da ideia ao SaaS pronto para produção em dias, não meses, com uma arquitetura que prioriza o contrato, flexibilidade de tempo de execução e governança de nível empresarial.

## Índice

- [A lacuna de entrega empresarial](#the-enterprise-delivery-gap)
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
