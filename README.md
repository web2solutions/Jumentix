# Jumentix - Software Factory for Product Teams

[![CircleCI dev](https://dl.circleci.com/status-badge/img/gh/XpertMinds/Jumentix/tree/dev.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/XpertMinds/Jumentix/tree/dev)
[![CircleCI main](https://dl.circleci.com/status-badge/img/gh/XpertMinds/Jumentix/tree/main.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/XpertMinds/Jumentix/tree/main)
[![codecov](https://codecov.io/gh/XpertMinds/Jumentix/branch/dev/graph/badge.svg)](https://codecov.io/gh/XpertMinds/Jumentix)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_aaa-typescript-boilerplate&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=web2solutions_aaa-typescript-boilerplate)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_aaa-typescript-boilerplate&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=web2solutions_aaa-typescript-boilerplate)
[![Node](https://img.shields.io/badge/node-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-6BA539?logo=openapiinitiative&logoColor=white)](./spec/1.0.0.yml)
[![AsyncAPI](https://img.shields.io/badge/AsyncAPI-3.0-9146FF)](./spec)
[![License](https://img.shields.io/github/license/XpertMinds/Jumentix)](./LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/XpertMinds/Jumentix/dev)](https://github.com/XpertMinds/Jumentix/commits/dev)
[![#StandWithUkraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://vshymanskyy.github.io/StandWithUkraine)

Jumentix is a monorepo product that works as a software factory for engineering teams and product owners. It helps you go from idea to production-ready SaaS in days, not months, with a contract-first architecture, runtime flexibility, and enterprise-grade governance.

> **Canonical private repository:** `XpertMinds/Jumentix`.
> `web2solutions/aaa-typescript-boilerplate` is deprecated, read-only, and
> accepts no new modifications. Agent coordination is canonical in the private
> `XpertMinds/jumentix-agent-registry`; the former `web2solutions` registry is
> also deprecated and read-only. See Requirements `103` and `104`.

## Index

- [The Enterprise Delivery Gap](#the-enterprise-delivery-gap)
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
