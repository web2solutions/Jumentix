# Contract tests (JUM-440)

This directory is the canonical home for contract-layer suites.

Current gate entry point: `bun run test:contract` → `ci-cd/run-contract-tests.js`
(`oas:check-routes`, `serverless:check-handlers`), registered in `test-map.json` under layer `contracts`.

Add OAS/AsyncAPI assertion suites here as they are authored; keep `runner: "bun"`.
