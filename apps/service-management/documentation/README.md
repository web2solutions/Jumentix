# Service Management Documentation Hub

`apps/service-management` is the engineering workspace UI for designing domains, interfaces, runtime configuration, and deployment targets.

## Index

- Guides
  - [Creating SPA/PWA with Jumentix](./guides/CREATING-SPA-PWA-WITH-JUMENTIX.md)
- Core references
  - [Service Management Application](../../../documentation/md/SERVICE-MANAGEMENT-APPLICATION.md)
  - [Service Management Module Architecture and IDesignerStore Port Contract](../../../documentation/md/SERVICE-MANAGEMENT-MODULE-ARCHITECTURE.md)
  - [Service Management Contract Parity Guarantees](../../../documentation/md/SERVICE-MANAGEMENT-CONTRACT-PARITY.md)
  - [Service Management Operations Console](../../../documentation/md/SERVICE-MANAGEMENT-OPERATIONS-CONSOLE.md)
  - [Service Management Design System and PWA Shell](../../../documentation/md/SERVICE-MANAGEMENT-DESIGN-SYSTEM-PWA.md)
  - [Service Management Cana Adoption, Migration and Offline Behaviour](../../../documentation/md/SERVICE-MANAGEMENT-CANA-ADOPTION.md)
  - [Domain Designer Features and Usage](../../../documentation/md/DOMAIN-DESIGNER-FEATURES-AND-USAGE.md)
  - [Domain Data Entities](../../../documentation/md/DOMAIN-DATA-ENTITIES.md)
  - [Runtime Environment Contracts](../../../documentation/md/RUNTIME-ENVIRONMENT-CONTRACTS.md)

## What This Component Delivers

- Visual domain and ER modeling with bounded context organization.
- Communication interface planning (REST/realtime/gRPC/SSE).
- Service runtime configuration and environment editing.
- Deployment target planning for VM/function-based platforms.

## Architecture Snapshot

- Frontend workspace with tabbed tools for domain design, interface planning, and runtime/deploy configuration.
- Reads and updates active `.env` profiles through Service Management backend endpoints.
- Keeps generated modeling artifacts aligned with backend contract expectations.

## Integration Examples

Run Service Management as standalone tool:

```bash
bun run dev:service-management
```

Run full local profile (Service Management + REST profile via PM2):

```bash
bun run dev
```

## Run

```bash
bun run dev:service-management
```

or full development profile:

```bash
bun run dev
```
