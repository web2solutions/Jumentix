# Requirement 106 - Local Bun for All Tests; Node Reserved for CI

- Status: Active
- Nature: NFR (testing runtime, developer experience)
- Source: Linear project `Hexagonal Test Pyramid — Bun unit + Node integration + layer-aware gates` (`7f9e4a32-3b2c-4b0a-86e0-7430bb31076d`)
- Complements: Requirement `105`

## Requirement

1. **Local default runtime is Bun for every suite type** — unit, integration, smoke, contract, platform and package workspace verification. Developers MUST be able to run the full local surface with `bun test` / `bun run test*` without invoking Node/Jest as the primary runner.
2. **Node/Jest is CI-only.** Suites that still require Node for compatibility are invoked on Node exclusively when `CI=true` or `JUMENTIX_TEST_RUNTIME=node`. Local scripts MUST NOT default to `jest` / `bunx jest`.
3. **Manifest honesty.** `test-map.json` records:
   - `runner: "bun"` as the local/default runner for suites executed under Bun;
   - optional `ciRunner: "node"` for suites the CI matrix may still execute under Node/Jest.
   A suite MUST NOT silently remain on Jest locally.
4. **Package scripts.** Root `test`, `tdd`, `test:integration:*`, `test:smoke:*` and related developer scripts resolve to Bun locally. CI-oriented Node entry points, when present, are explicit (`*:ci` suffix and/or the env switch in §2) and are outside the local DX contract.
5. **Out of scope for this requirement.** Making GitHub Actions / CircleCI jobs green, provisioning Redis/DB matrices, and repairing remote CI infra are **not** acceptance criteria of Requirement `106` or of the Hexagonal Test Pyramid project delivery that implements it. Those belong to CI operations ownership.
6. **False-green resistance still applies.** Switching the local runner to Bun does not relax Requirements `065` / `105` evidence rules (empty plans fail closed; quarantine needs Linear refs; skipped/pending is not green).

## Evidence

- `.agents/requirements/software/106-local-bun-all-tests-node-ci-only.md`
- `ci-cd/lib/test-runtime.js`
- `ci-cd/run-unit-tests.js`
- `ci-cd/run-integration-tests.js`
- `ci-cd/run-suite.js`
- root `package.json` test / tdd / integration / smoke scripts
- `test-map.json` (`runner` / `ciRunner`)
- `documentation/md/HEXAGONAL-TEST-PYRAMID.md` (+ pt-BR)
