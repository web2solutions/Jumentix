# Creating SaaS Microservices with Jumentix

Use this path when domain scale, team autonomy, and traffic profiles demand service-level decomposition.

## Responsibility in context

- **Owns:** Topology guidance for microservices SaaS
- **Used with:** shared-contracts, SDKs, message-mediator, REST/realtime guides
- **Not responsible for:** Single-process modular monolith details (see monolith guide)

## Glossary

- **Guide** — a journey document; follow steps in order before jumping to package API maps.
- **Composition root** — startup code that wires env → adapters → use-cases.

## What it is

Split into contract-communicating microservices without losing shared domain rules.

## Recommended Strategy

1. Start modular and contract-first from day one.
2. Identify extraction candidates by domain ownership and operational profile.
3. Move generic adapters/contracts to reusable workspace packages.
4. Keep communication contract-based (message mediator/events/requests-responses).

## Evolution Path from Monolith

1. Stabilize domain boundaries in the modular monolith.
2. Extract one bounded context at a time.
3. Keep API contracts backward compatible during migration.
4. Gradually isolate persistence and deployment pipelines per service.

## Operational Pattern

- REST + realtime interfaces based on service responsibilities.
- Independent CI gates and test suites per service package/app.
- PM2/containers/functions according to runtime needs.

## Product and Engineering Benefits

- Independent release cadence by domain.
- Horizontal scaling on hotspot services.
- Better ownership and clearer team boundaries.

## Related Docs

- [Message and Event Contracts](/docs/jumentix/reference/events-messages)
- [Jumentix Workspace Packages](/docs/jumentix/packages)
- [Architecture and Structure](/docs/jumentix/concepts/architecture)


## Next steps

1. [Getting started](/docs/jumentix/concepts/getting-started)
2. [REST](/docs/jumentix/guides/rest-api)

## Junior checklist (“I can …”)

- [ ] I can explain the goal of this guide in one sentence
- [ ] I completed the first success path without guessing jargon
- [ ] I know the single next docs page to open
