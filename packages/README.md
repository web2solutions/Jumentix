# Jumentix Workspace Packages

This folder contains reusable npm packages shared across Jumentix applications.

## Package Index

### Runtime and persistence

- [`@jumentix/adapter-runtime-bootstrap`](./adapter-runtime-bootstrap/README.md) - shared adapter runtime composition.
- [`@jumentix/cana`](./cana/README.md) - IndexedDB offline database adapter with consumer docs and playgrounds.
- [`@jumentix/database-client-factory`](./database-client-factory/README.md) - database client compilation by selected driver.
- [`@jumentix/external-db-repositories`](./external-db-repositories/README.md) - reusable external database repositories.
- [`@jumentix/external-persistence-core`](./external-persistence-core/README.md) - base external-persistence contracts and implementations.
- [`@jumentix/external-store-proxy`](./external-store-proxy/README.md) - native database client to `IStore` bridges.
- [`@jumentix/key-value-storage`](./key-value-storage/README.md) - key-value contracts and in-memory/Redis adapters.
- [`@jumentix/mutex-service`](./mutex-service/README.md) - reusable mutex compiler and runtime adapter.
- [`@jumentix/persistence-contracts`](./persistence-contracts/README.md) - shared `IDatabaseClient` and `IStore` abstractions.
- [`@jumentix/runtime-infra`](./runtime-infra/README.md) - runtime environment and infrastructure helpers.

### Messaging, bootstrap, and contracts

- [`@jumentix/cli-init`](./cli-init/README.md) - bootstrap CLI for project structures.
- [`@jumentix/message-mediator`](./message-mediator/README.md) - event and request/response mediator.
- [`@jumentix/shared-contracts`](./shared-contracts/README.md) - shared canonical OpenAPI/AsyncAPI spec resolution helpers.

### SDK clients

- [`@jumentix/sdk-rest-client`](./sdk-rest-client/README.md) - REST SDK client.
- [`@jumentix/sdk-websocket-client`](./sdk-websocket-client/README.md) - WebSocket SDK client.
- [`@jumentix/sdk-grpc-client`](./sdk-grpc-client/README.md) - gRPC SDK client.

### Service Management

- [`@jumentix/designer-core`](./designer-core/README.md) - framework-free designer core (model, validation, exporters, importers, domain-package versioning); browser-safe ESM, dry-run-only publish.

### Private workspace configuration

- [`@jumentix/config-eslint`](./config-eslint/README.md) - reserved shared ESLint configuration.
- [`@jumentix/config-jest`](./config-jest/README.md) - reserved shared Jest configuration.
- [`@jumentix/config-ts`](./config-ts/README.md) - reserved shared TypeScript configuration.

Packages described as **reserved** are intentionally private placeholders in the current `dev`
baseline. Their scripts report that the migration wave is pending; they must not be documented as
published or production-ready.

## Usage Pattern

Each package has its own English and Portuguese README, scripts, and ownership boundaries. Import
packages from applications instead of duplicating adapter logic in each app. The canonical runtime
is Bun 1.3.13 for internal engineering workflows, with Node.js 22 kept as the explicit
consumer-facing compatibility target where packages expose Node runtime artifacts.

## Related Docs

- [Jumentix Workspace Packages (Architecture)](/docs/jumentix/concepts/architecture)
- [SDK Compatibility Bridge](/docs/jumentix/packages)
