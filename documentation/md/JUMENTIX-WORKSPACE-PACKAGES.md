# Jumentix Workspace Packages

This document tracks the package and application workspace map implemented in `dev`.

## Runtime and Architecture Packages

- `@jumentix/message-mediator`
- `@jumentix/key-value-storage`
- `@jumentix/persistence-contracts`
- `@jumentix/mutex-service`
- `@jumentix/external-persistence-core`
- `@jumentix/external-store-proxy`
- `@jumentix/external-db-repositories`
- `@jumentix/database-client-factory`
- `@jumentix/runtime-infra`
- `@jumentix/adapter-runtime-bootstrap`

## Developer/Product Packages

- `@jumentix/cli-init`
- `@jumentix/sdk-rest-client`
- `@jumentix/sdk-websocket-client`
- `@jumentix/sdk-grpc-client`
- `@jumentix/designer-core` - framework-free Service Management designer core (domain model,
  validation engine, exporters, importers, domain-package versioning) as browser-safe ESM with
  generated type declarations; publishable, dry-run-only per Requirement 070 (JUM-493).

## Shared Contract and Configuration Packages

- `@jumentix/shared-contracts` - shared OpenAPI/AsyncAPI canonical-spec resolution helpers used by
  the SDK packages (`loadCanonicalSpec`, `candidateSpecPaths`).
- `@jumentix/config-eslint`
- `@jumentix/config-jest`
- `@jumentix/config-ts`

The `config-*` workspaces are private migration placeholders. Their lifecycle scripts intentionally
report that migration is pending. Canonical executable configuration and API contracts remain in
the repository root and `spec/` until those migrations are implemented. `shared-contracts` owns a
real source module and its own test suite (Requirement 112) and is measured for coverage; it is no
longer a placeholder.

## App Workspaces

- `@jumentix/backend-template` - TypeScript backend application/template with REST, realtime, CLI,
  persistence, messaging, serverless, and PM2 composition.
- `@jumentix/service-management` - plain-JavaScript management server and UI; integration tests are
  delegated to the root runner.
- `@jumentix/website` - Next.js/Nextra/Mantine commercial and documentation website with bilingual
  content sync, Storybook, static checks, and Vercel commands.

## Notes

- SDK packages now have package-level source and build scripts.
- Legacy `sdk-clients/` remains as backward-compatible bridge that re-exports from `packages/sdk-*`.
- Compatibility bridge contract is documented in `documentation/md/SDK-COMPATIBILITY-BRIDGE.md`.
- CLI package now owns canonical bootstrap implementation.
- Root CLI entrypoint remains as compatibility wrapper.
- Package status, links, and per-package README files are indexed in `packages/README.md`.
- Bun 1.3.13 is the repository's internal engineering runtime and package manager. Node.js 22
  remains the declared consumer-facing compatibility target where packages expose Node runtime
  artifacts.
