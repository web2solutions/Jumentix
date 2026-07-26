# Spec Features and Workflows Catalog

This catalog maps Jumentix capabilities to the required spec artifacts and implementation boundaries.

Use this as the planning entrypoint before code changes.

## Capability Group A - Backend Service Factory

Includes:

1. REST API services
2. WebSocket + REST fallback services
3. gRPC + REST fallback services
4. Function-oriented deployments (Lambda, Vercel Functions, Cloudflare Workers)

Required specs:

1. `spec/1.0.0.yml` for HTTP contracts
2. `spec/asyncapi/1.0.0.websocket.yml` and/or `spec/asyncapi/1.0.0.grpc.yml`
3. Error contracts in `documentation/md/ERROR-CONTRACTS-AND-RESPONSES.md`
4. Runtime/env contracts in `documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md`

Mandatory checks:

1. Route/handler resolution checks
2. Unit + integration + smoke tests for affected adapters
3. Coverage threshold checks

## Capability Group B - Domain and Data Evolution

Includes:

1. New domain creation
2. Data entity/model changes
3. Value object changes (Document, Address, Phone, Email, etc.)
4. Relationship and RBAC/tenancy updates

Required specs:

1. OpenAPI schemas and port objects (`spec/1.0.0.yml`)
2. Domain model/entity docs (`documentation/md/DOMAIN-DATA-ENTITIES.md`, `documentation/md/domains/**/*`)
3. Event/message docs when behavior is asynchronous (`documentation/md/EVENTS-AND-MESSAGES-MAP.md`)
4. Agents requirements updates for NFR impact

Mandatory checks:

1. Domain/model unit tests
2. Endpoint integration tests
3. Contract alignment checks

## Capability Group C - Realtime Integration

Includes:

1. Socket.IO handlers and message contracts
2. gRPC handlers and request/response contracts
3. Cross-node resilience using Redis/cluster adapters

Required specs:

1. AsyncAPI contract files
2. Realtime adapter docs:
   - `documentation/md/adapters/realtime/WEBSOCKET-API.md`
   - `documentation/md/adapters/realtime/GRPC-API.md`
3. Realtime contract docs:
   - `documentation/md/contracts/WEBSOCKET-REALTIME-CONTRACTS.md`
   - `documentation/md/contracts/GRPC-REALTIME-CONTRACTS.md`

Mandatory checks:

1. Realtime unit tests where applicable
2. Multi-instance integration tests
3. Realtime smoke tests

## Capability Group D - Persistence and External Drivers

Includes:

1. In-memory official adapter behavior
2. SQL drivers through Sequelize
3. Mongo through Mongoose
4. DynamoDB/Cassandra/Firebase/Aurora/RDS/Oracle adapters
5. Store abstraction through `IStore` and `IDatabaseClient`

Required specs:

1. Persistence contracts in `packages/persistence-contracts`
2. Runtime driver selection contracts (`AAA_DATABASE_DRIVER`)
3. Database adapter docs in `documentation/md/adapters/databases/*`
4. Smoke validation matrix docs in `documentation/md/DATABASE-DRIVERS-SMOKE-TESTS.md`

Mandatory checks:

1. Driver smoke tests
2. Integration checks for critical repositories
3. Runtime bootstrap checks

## Capability Group E - Service Management and Developer Automation

Includes:

1. Service Management app tabs/workflows
2. Domain Designer MVP
3. Communication Interface Designer scope
4. Service configuration and deploy management workflows
5. CLI-init scaffold automation

Required specs:

1. Service management docs in `apps/service-management/documentation/*`
2. CLI contracts and docs in `packages/cli-init/*`
3. Monorepo execution and migration docs

Mandatory checks:

1. Workflow validation scripts
2. Docs sync with README indexes
3. Governance traceability against project board items

## Capability Group F - Governance, Compliance, and Release

Includes:

1. Coverage and CI thresholds
2. Security and PCI controls
3. Project task governance rules
4. Release/versioning controls

Required specs:

1. `.agents/requirements/*`
2. `.agents/NFR-REGISTRY.md`
3. `documentation/md/JUMENTIX-PROJECT-GOVERNANCE.md`
4. `documentation/md/JUMENTIX-RELEASE-AND-VERSIONING-STRATEGY.md`

Mandatory checks:

1. `ci:gate` and monorepo CI checks
2. Coverage policy gates
3. Security scans/gates
4. Governance linkage evidence in PR

## Capability Group G - Product Website and Documentation Portal

Includes:

1. Commercial product and use-case pages
2. Markdown-backed technical documentation
3. Canonical and backward-compatible documentation routes
4. Search, sidebar, table of contents, feedback, edit links, and responsive navigation
5. Vercel build and release automation

Required specs:

1. `.agents/requirements/069-jumentix-website-commercial-static-vercel-governance.md`
2. `apps/jumentix-website/documentation/CONTENT-PIPELINE.md`
3. `apps/jumentix-website/documentation/VERCEL-DEPLOYMENT.md`
4. Website UX audit and information architecture under
   `apps/jumentix-website/documentation/research`

Mandatory checks:

1. Website typecheck and production build
2. Prepublish route and invalid-content marker checks
3. Browser verification of layout, navigation, links, and responsive states
4. Vercel production smoke validation
5. Storybook coverage for reusable website components

## Workflow Definition (Spec-First)

For every capability group:

1. Define or update spec artifacts first.
2. Validate architecture and NFR boundaries.
3. Implement only approved spec scope.
4. Prove conformance with tests/checks.
5. Publish governance evidence and docs sync.
