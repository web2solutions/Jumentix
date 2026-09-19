# Jumentix

Jumentix is an open-source software factory for teams building SaaS products. It provides contract-first foundations for APIs, realtime services, web applications, and modular product domains, so teams can concentrate on the product they are creating.

[![GitHub Actions dev](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml?query=branch%3Adev)
[![GitHub Actions main](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/web2solutions/Jumentix/actions/workflows/ci.yml?query=branch%3Amain)
[![Codecov dev](https://codecov.io/gh/web2solutions/Jumentix/branch/dev/graph/badge.svg)](https://app.codecov.io/github/web2solutions/Jumentix/tree/dev)
[![Codecov main](https://codecov.io/gh/web2solutions/Jumentix/branch/main/graph/badge.svg)](https://app.codecov.io/github/web2solutions/Jumentix/tree/main)
[![SonarCloud quality dev](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_Jumentix&metric=alert_status&branch=dev)](https://sonarcloud.io/summary/new_code?id=web2solutions_Jumentix&branch=dev)
[![SonarCloud reliability dev](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_Jumentix&metric=reliability_rating&branch=dev)](https://sonarcloud.io/summary/new_code?id=web2solutions_Jumentix&branch=dev)
[![SonarCloud quality main](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_Jumentix&metric=alert_status&branch=main)](https://sonarcloud.io/summary/new_code?id=web2solutions_Jumentix&branch=main)
[![SonarCloud reliability main](https://sonarcloud.io/api/project_badges/measure?project=web2solutions_Jumentix&metric=reliability_rating&branch=main)](https://sonarcloud.io/summary/new_code?id=web2solutions_Jumentix&branch=main)
[![Bun](https://img.shields.io/badge/bun-1.3.13-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-6BA539?logo=openapiinitiative&logoColor=white)](./spec/1.0.0.yml)
[![AsyncAPI](https://img.shields.io/badge/AsyncAPI-3.0-9146FF)](./spec)
[![License](https://img.shields.io/badge/license-AGPL--3.0-blue)](./LICENSE.md)

## What You Can Build

- REST, WebSocket, and gRPC APIs with reusable contracts.
- SaaS applications that can grow from modular domains into services.
- Product websites, operational tools, and domain design workflows.
- Deployable services for conventional servers, serverless platforms, and edge runtimes.

## Get Started

```bash
git clone https://github.com/web2solutions/Jumentix.git
cd Jumentix
bun install --frozen-lockfile
bun run dev:express
```

Choose a starting point in the guides below, then adapt the generated contracts and modules to your product.

## Guides and Documentation

- [Documentation hub](documentation/README.md)
- [Documentation hub in Portuguese](documentation/README.pt-BR.md)
- [Use the Service Manager and Domain Designer](./documentation/md/guides/USING-SERVICE-MANAGER-AND-DOMAIN-DESIGNER.md)
- [Create a SPA or PWA](./apps/service-management/documentation/guides/CREATING-SPA-PWA-WITH-JUMENTIX.md)
- [Create a REST API](./apps/backend-template/documentation/guides/CREATING-REST-API-WITH-JUMENTIX.md)
- [Create a realtime API](./apps/backend-template/documentation/guides/CREATING-REALTIME-API-WITH-JUMENTIX.md)
- [Create a SaaS monolith](./documentation/md/guides/CREATING-SAAS-MONOLITH-WITH-JUMENTIX.md)
- [Create SaaS microservices](./documentation/md/guides/CREATING-SAAS-MICROSERVICES-WITH-JUMENTIX.md)

## Coverage

### Development

[![Codecov Grid for dev](https://codecov.io/gh/web2solutions/Jumentix/branch/dev/graphs/tree.svg)](https://app.codecov.io/github/web2solutions/Jumentix/tree/dev)

### Main

[![Codecov Grid for main](https://codecov.io/gh/web2solutions/Jumentix/branch/main/graphs/tree.svg)](https://app.codecov.io/github/web2solutions/Jumentix/tree/main)

## Contributing

Contributions are welcome. Please read the [contributing guide](./documentation/md/CONTRIBUTING-AND-TOOLING.md), open an issue to discuss substantial changes, and submit focused pull requests.

## License

Jumentix is licensed under the [GNU Affero General Public License v3.0](./LICENSE.md).
