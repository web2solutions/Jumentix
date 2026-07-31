# Platform-dependent suites — Node pin inventory (JUM-439)

## Purpose

Make the Node/CI boundary explicit and fail-closed. Locally these suites still run under Bun (Req 106); Node execution is CI-only.

## Inventory

| Suite / surface | Why platform-dependent | Local (`runner`) | CI (`ciRunner`) | Tier |
| --- | --- | --- | --- | --- |
| `test/integration/mutex/*` | Real Redis | bun | node | nightly |
| `realtime/socketio.redis-streams.multi-instance.test.ts` | Multi-instance Redis Streams | bun | node | nightly |
| `test/smoke/database/*` | DB driver matrix / docker | bun | node | nightly |
| HTTP framework integration (`Express`…`Total-JS`) | Framework + Nest harness quirks | bun | node | gate |
| Restify | Historically Node-major sensitive | bun | node | gate |

## Former silent skips (removed as the source of truth)

`jest.config.js` previously omitted mutex / redis-streams unless `RUN_REDIS_INTEGRATION=1`, and omitted Restify/mutex.restify when `nodeMajor > 22`. That produced greens that said nothing about those suites.

Honest replacement:

1. Suites are always present in `test-map.json`.
2. Expensive infra suites use `tier: "nightly"` (`bun run test:nightly`).
3. CI may set `JUMENTIX_TEST_RUNTIME=node` / `*:ci` scripts; local defaults stay Bun.
4. Timeouts are fail-closed in `ci-cd/run-integration-tests.js` (120s default; Express/Fastify 300s; Restify 600s).

## Evidence

- `test-map.json` (`tier`, `ciRunner`, `timeoutMs`)
- `ci-cd/run-nightly-tier.js`
- `ci-cd/lib/test-runtime.js`
