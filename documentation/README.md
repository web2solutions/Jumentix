# Jumentix Documentation Hub

> Canonical private repository: `XpertMinds/Jumentix`. See
> [Canonical Repository Migration](./md/CANONICAL-REPOSITORY-MIGRATION.md).

This documentation is organized by audience and is synchronized against the repository `dev`
baseline. A documented capability is current only when its referenced implementation, manifest, or
contract exists in `dev`; planned work must be identified explicitly as planned.

## Repository Component Map

- **Applications**
  - [Backend Template](../apps/backend-template/README.md): REST, WebSocket, gRPC, CLI, persistence,
    messaging, serverless, and PM2 runtime composition.
  - [Service Management](../apps/service-management/README.md): management UI/server and service
    definition workflows.
  - [Jumentix Website](../apps/jumentix-website/README.md): commercial and bilingual documentation
    site, content synchronization, Storybook, and Vercel delivery.
- **Reusable packages**
  - [Complete package catalog](../packages/README.md), including runtime, persistence, messaging,
    SDK, private configuration, and reserved contract workspaces.
- **Compatibility and contracts**
  - [Legacy SDK compatibility layer](../sdk-clients/README.md).
  - [OpenAPI and AsyncAPI sources](../spec/).
- **Automation and delivery**
  - [Tooling scripts](../tooling/README.md).
  - [Creator documentation](./creators/README.md) for CI, governance, release, and maintenance.

## Consumer Documentation (public-facing)

For teams and product owners using Jumentix to build software:

- [Consumer Documentation Index](./consumers/README.md)

## Creator Documentation (maintainers/internal)

For engineers maintaining and evolving Jumentix:

- [Creator Documentation Index](./creators/README.md)

## Component Technical Hubs

- [Backend Template Documentation](../apps/backend-template/documentation/README.md)
- [Service Management Documentation](../apps/service-management/documentation/README.md)
- [Jumentix Website](../apps/jumentix-website/README.md)
- [Jumentix Website Technical Docs](../apps/jumentix-website/documentation/README.md)
- [Workspace Packages](../packages/README.md)
- [Tooling](../tooling/README.md)

## Contract and Runtime References

- [OpenAPI Spec](../spec/1.0.0.yml)
- [Events and Messages Map](./md/EVENTS-AND-MESSAGES-MAP.md)
- [Error Contracts and Responses](./md/ERROR-CONTRACTS-AND-RESPONSES.md)
- [Tenant and RBAC Authorization Contract](./md/TENANT-RBAC-AUTHORIZATION-CONTRACT.md)
- [Runtime Environment Contracts](./md/RUNTIME-ENVIRONMENT-CONTRACTS.md)
- [WebSocket AsyncAPI](../spec/asyncapi/1.0.0.websocket.yml)
- [gRPC AsyncAPI](../spec/asyncapi/1.0.0.grpc.yml)

## Documentation Integrity

Run these checks from the repository root after documentation changes:

```bash
pnpm run docs:consumers:package-scripts
pnpm run website:test:prepublish
pnpm run ci:gate:task
```

The package-script generator is authoritative for the consumer command reference. The website
prepublish gate synchronizes Markdown sources and validates routes/content. The task gate selects
the documentation-appropriate repository checks for a docs-only branch.
