# Creating SPA/PWA with Jumentix

This guide describes how to use Jumentix to plan and deliver frontend applications (SPA/PWA) integrated with backend services.

## 1. Model Business Domains First

Use Domain Designer to define:

- domains and bounded contexts
- data entities and value objects
- relationships and constraints
- API and event contracts

This keeps frontend state and backend contracts aligned from the first iteration.

## 2. Define Communication Contracts

Use Communication Interface Designer to choose:

- REST-only consumption
- Realtime with WebSocket
- Realtime with gRPC (for Node-based backend consumers)

Contracts become the source for SDK/client integration.

## 3. Configure Service Runtime

In Service Configuration:

- choose service type (`RESTAPI`, `websocketAPI + RESTAPI`, `grpcAPI + RESTAPI`)
- configure runtime and deployment target
- edit env keys like `JUMENTIX_HTTP_FRAMEWORK`, `JUMENTIX_REALTIME_API`, `JUMENTIX_REALTIME_API_PROTOCOL`

## 4. Build Offline-Capable PWA

For PWA/offline-first architecture:

- use local IndexedDB in frontend
- sync with backend contracts asynchronously
- keep conflict strategies explicit (last-write-wins or domain-specific merge)

## 5. Validate Delivery Readiness

- contract checks from OpenAPI/AsyncAPI
- backend CI gates
- frontend build and offline smoke checks

## 6. Offline storage with Cana + designs

Validate a design document, then persist records with Cana:

<DocsPlayground runtime="designer-core" id="getting-started" />

<DocsPlayground runtime="cana" id="getting-started" />

## Next steps

1. [Getting started](/docs/jumentix/concepts/getting-started)
2. [Cana usage](/docs/jumentix/packages/cana/usage)
3. [designer-core usage](/docs/jumentix/packages/designer-core/usage)
4. [Packages map](/docs/jumentix/packages)

## References

- Packages: [/docs/jumentix/packages](/docs/jumentix/packages)
- Cana: [/docs/jumentix/packages/cana](/docs/jumentix/packages/cana)
