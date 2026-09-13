# Jumentix - Software Factory for Product Teams

[![GitHub Actions dev](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml?query=branch%3Adev)
[![GitHub Actions main](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml?query=branch%3Amain)
[![CircleCI dev](https://dl.circleci.com/status-badge/img/gh/web2solutions/Jumentix/tree/dev.svg?style=svg)](https://app.circleci.com/pipelines/github/web2solutions/Jumentix?branch=dev)
[![CircleCI main](https://dl.circleci.com/status-badge/img/gh/web2solutions/Jumentix/tree/main.svg?style=svg)](https://app.circleci.com/pipelines/github/web2solutions/Jumentix?branch=main)
[![Codecov dev](https://codecov.io/gh/web2solutions/Jumentix/branch/dev/graph/badge.svg)](https://app.codecov.io/gh/web2solutions/Jumentix/tree/dev)
[![Codecov main](https://codecov.io/gh/web2solutions/Jumentix/branch/main/graph/badge.svg)](https://app.codecov.io/gh/web2solutions/Jumentix/tree/main)
[![SonarCloud quality](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_Jumentix&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=web2solutions_Jumentix)
[![SonarCloud reliability](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_Jumentix&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=web2solutions_Jumentix)
[![SonarCloud coverage](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_Jumentix&metric=coverage)](https://sonarcloud.io/summary/new_code?id=web2solutions_Jumentix)
[![Bun](https://img.shields.io/badge/bun-1.3.13-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![Node compat](https://img.shields.io/badge/node%20compat-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-6BA539?logo=openapiinitiative&logoColor=white)](./spec/1.0.0.yml)
[![AsyncAPI](https://img.shields.io/badge/AsyncAPI-3.0-9146FF)](./spec)
[![Repository](https://img.shields.io/badge/repository-public-24292f?logo=github)](https://github.com/web2solutions/Jumentix)
[![License](https://img.shields.io/badge/license-see%20LICENSE-blue)](./LICENSE)
[![Run with Express](https://img.shields.io/badge/Run%20with-Express-gold?style=flat-square&logo=express&logoColor=000)](https://expressjs.com/)
[![Run with Fastify](https://img.shields.io/badge/Run%20with-Fastify-gold?style=flat-square&logo=fastify&logoColor=000)](https://fastify.dev/)
[![Run with Restify](https://img.shields.io/badge/Run%20with-Restify-gold?style=flat-square&logo=node.js&logoColor=000)](http://restify.com/)
[![Run with AdonisJS](https://img.shields.io/badge/Run%20with-AdonisJS-gold?style=flat-square&logo=adonisjs&logoColor=000)](https://adonisjs.com/)
[![Run with FeathersJS](https://img.shields.io/badge/Run%20with-FeathersJS-gold?style=flat-square&logo=feathersjs&logoColor=000)](https://feathersjs.com/)
[![Run with LoopBack](https://img.shields.io/badge/Run%20with-LoopBack-gold?style=flat-square&logo=loopback&logoColor=000)](https://loopback.io/)
[![Run with SailsJS](https://img.shields.io/badge/Run%20with-SailsJS-gold?style=flat-square&logo=sailsdotjs&logoColor=000)](https://sailsjs.com/)
[![Run with DerbyJS](https://img.shields.io/badge/Run%20with-DerbyJS-gold?style=flat-square&logo=javascript&logoColor=000)](https://derbyjs.com/)
[![Run with Total.js](https://img.shields.io/badge/Run%20with-Total.js-gold?style=flat-square&logo=javascript&logoColor=000)](https://www.totaljs.com/)
[![Run with Serverless](https://img.shields.io/badge/Run%20with-Serverless-gold?style=flat-square&logo=serverless&logoColor=000)](https://www.serverless.com/)
[![Run on Cloudflare Workers](https://img.shields.io/badge/Run%20on-Cloudflare%20Workers-gold?style=flat-square&logo=cloudflare&logoColor=000)](https://workers.cloudflare.com/)
[![Run on Vercel Functions](https://img.shields.io/badge/Run%20on-Vercel%20Functions-gold?style=flat-square&logo=vercel&logoColor=000)](https://vercel.com/docs/functions)
[![#StandWithUkraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://vshymanskyy.github.io/StandWithUkraine)

## Coverage and CI Map

| Required gate | `main` | `dev` |
| --- | :---: | :---: |
| GitHub Actions workflow | [![main GitHub Actions](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml?query=branch%3Amain) | [![dev GitHub Actions](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml?query=branch%3Adev) |
| CircleCI workflow | [![main CircleCI](https://dl.circleci.com/status-badge/img/gh/web2solutions/Jumentix/tree/main.svg?style=svg)](https://app.circleci.com/pipelines/github/web2solutions/Jumentix?branch=main) | [![dev CircleCI](https://dl.circleci.com/status-badge/img/gh/web2solutions/Jumentix/tree/dev.svg?style=svg)](https://app.circleci.com/pipelines/github/web2solutions/Jumentix?branch=dev) |
| Codecov coverage | [![main Codecov](https://codecov.io/gh/web2solutions/Jumentix/branch/main/graph/badge.svg)](https://app.codecov.io/gh/web2solutions/Jumentix/tree/main) | [![dev Codecov](https://codecov.io/gh/web2solutions/Jumentix/branch/dev/graph/badge.svg)](https://app.codecov.io/gh/web2solutions/Jumentix/tree/dev) |
| Branch-aware tests | `branch-gate` | `branch-gate` |
| Project + patch coverage | `coverage` | release-promotion only |
| Third-party security review | `third-party-review` | PR-only |

Feature, fix, docs and CI task PRs target `dev` and run the cheap layer-aware
gate selected from `test-map.json`; the target is ten minutes or less. Full
workspace, browser, coverage, website and database jobs are reserved for
`dev -> main` release promotions, `main` pushes and scheduled full runs.

Coverage is produced and enforced by the full-suite `coverage` job when the
release gate runs. GitHub Actions and CircleCI upload LCOV to Codecov when
`CODECOV_TOKEN` is configured. Codecov provides the file-by-file coverage map
for each long-lived branch:

- [Codecov file map for `dev`](https://app.codecov.io/gh/web2solutions/Jumentix/tree/dev)
- [Codecov file map for `main`](https://app.codecov.io/gh/web2solutions/Jumentix/tree/main)

The hard gate remains the repository-owned coverage check. Every run retains
Istanbul JSON and LCOV evidence. The hard minimums are:

| Statements | Lines | Functions | Branches | Changed lines |
| :---: | :---: | :---: | :---: | :---: |
| ≥ 99% | ≥ 99% | ≥ 99% | ≥ 90% | ≥ 99% |

[Open GitHub Actions runs and downloadable evidence](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml)

Jumentix is a monorepo product that works as a software factory for engineering teams and product owners. It helps you go from idea to production-ready SaaS in days, not months, with a contract-first architecture, runtime flexibility, and enterprise-grade governance.

> **Canonical public repository:** `web2solutions/Jumentix`.
> `web2solutions/aaa-typescript-boilerplate` is deprecated, read-only, and
> accepts no new modifications. Agent coordination is canonical in Firestore
> Database (Requirement `089`); the former `XpertMinds/jumentix-agent-registry`
> and `web2solutions` registries are deprecated and read-only. See Requirements
> `089`, `103` and `104`.

## Index

- [The Enterprise Delivery Gap](#the-enterprise-delivery-gap)
- [Coverage and CI Map](#coverage-and-ci-map)
- [Why Jumentix Wins](#why-jumentix-wins)
- [Business ROI](#business-roi)
- [Who Benefits](#who-benefits)
- [What You Can Launch](#what-you-can-launch)
- [Launch Playbooks](#launch-playbooks)
- [Adoption Paths](#adoption-paths)
- [Strategic Positioning](#strategic-positioning)
- [Technical Documentation](#technical-documentation)
- [Project Governance](#project-governance)

## The Enterprise Delivery Gap

Enterprise teams rarely fail because of ideas. They fail because too much time is spent rebuilding the same platform foundation: architecture decisions, contracts, adapters, CI/CD, security controls, and deployment plumbing.

Jumentix eliminates this waste. Your team starts from a production-grade software factory and invests time where revenue is created: product differentiation.

## Why Jumentix Wins

- **Faster time-to-market**: go from idea to production architecture in days.
- **Lower delivery risk**: strict quality, security, and governance gates are built-in.
- **Scalable by design**: start modular, evolve to microservices without rewriting everything.
- **Contract-first operations**: APIs and realtime channels stay aligned with business models.
- **Cloud/runtime flexibility**: deploy where your business needs, not where your boilerplate is locked.

## Business ROI

| Metric | Typical custom foundation | With Jumentix |
| --- | --- | --- |
| Platform bootstrap time | High and unpredictable | Reduced and standardized |
| Architecture consistency | Varies by squad | Consistent across teams |
| Rework during scale phase | Frequent | Significantly lower |
| Compliance/quality readiness | Late-stage effort | Built into delivery flow |
| Onboarding for new engineers | Slow | Faster due to repeatable patterns |

## Who Benefits

- **Product Owners**: validate and launch SaaS offerings faster.
- **CTOs and Engineering Managers**: standardize architecture and execution across squads.
- **Platform Teams**: enforce quality, coverage, and security policy with reusable foundations.
- **Developers**: spend less time wiring infrastructure and more time shipping features.

## What You Can Launch With Jumentix

- Enterprise REST APIs
- Realtime APIs (WebSocket and gRPC)
- Backend services as functions
- Modular SaaS monoliths ready for decomposition
- Microservice ecosystems with shared contracts and governance
- Commercial product websites with live GitHub-backed changelog visibility

## Launch Playbooks

- [Using the Service Manager and the Domain Designer](./documentation/md/guides/USING-SERVICE-MANAGER-AND-DOMAIN-DESIGNER.md)
- [Creating SPA/PWA with Jumentix](./apps/service-management/documentation/guides/CREATING-SPA-PWA-WITH-JUMENTIX.md)
- [Creating a REST API with Jumentix](./apps/backend-template/documentation/guides/CREATING-REST-API-WITH-JUMENTIX.md)
- [Creating a Realtime API with Jumentix](./apps/backend-template/documentation/guides/CREATING-REALTIME-API-WITH-JUMENTIX.md)
- [Creating a SaaS Monolith with Jumentix](./documentation/md/guides/CREATING-SAAS-MONOLITH-WITH-JUMENTIX.md)
- [Creating SaaS Microservices with Jumentix](./documentation/md/guides/CREATING-SAAS-MICROSERVICES-WITH-JUMENTIX.md)

## Adoption Paths

- Start with one mission-critical API and prove delivery speed gains.
- Expand to a full SaaS monolith with shared frontend/backend workflows.
- Scale to multiple domain services with standardized contracts and governance.
- Establish Jumentix as the internal enterprise delivery platform.

## Strategic Positioning

Jumentix is not just a template repository. It is an extensible software factory product for building, scaling, and operating enterprise applications with consistent technical quality.

## Technical Documentation

Technical development documentation is intentionally separated from this commercial README.

- [Documentation Hub (EN)](documentation/README.md)
- [Hub de Documentação (PT-BR)](documentation/README.pt-BR.md)

## Project Governance

Task management source of truth:

- [Linear - Jumentix](https://linear.app/jumentix)
