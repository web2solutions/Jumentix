# CI / SonarQube / Codecov Troubleshooting

This guide helps diagnose and fix the most common failures in local gates and CI pipelines.

## 1) `pnpm install` fails with `EBADENGINE`

Symptoms:
- install fails with `Unsupported engine`
- Node version does not satisfy project `engines.node`

Cause:
- local/runtime Node version is outside required range.

Fix:

```bash
nvm use
node -v
pnpm -v
pnpm run check-node-version
```

Expected:
- Node version satisfies `>=22.0.0 <23.0.0`

Related files:
- `package.json` (`engines.node`, `preinstall`)
- `.nvmrc`
- `.node-version`
- `.npmrc`
- `ci-cd/check-node-version.js`

## 2) `test:unit` fails with missing `.env.*` file

Symptoms:
- ENOENT while loading env file during Jest startup

Cause:
- current `NODE_ENV` does not map to an existing file in `apps/backend-template/src/config`.

Fix:

```bash
NODE_ENV=ci pnpm run test:unit
```

Ensure at least one valid file exists for CI fallback:
- `apps/backend-template/src/config/.env.ci`
- `apps/backend-template/src/config/.env.dev.example`

How this works:
- `jest.config.js` loads `ci-cd/loadEnvironment.js`
- `loadEnvironment.js` picks first available file by `NODE_ENV`

## 3) `ci:gate` fails at OpenAPI route resolution

Symptoms:
- check reports missing handlers for operationId
- check reports controller method not implemented

Fix:

```bash
pnpm run oas:check-routes
```

Checklist:
- each operation in `spec/*.yml` has `operationId`
- each runtime has handler at:
  - `apps/backend-template/src/modules/<Module>/interface/restapi/frameworks/<framework>/handlers/<operationId>.ts`
- controller implements methods invoked in those handlers

Related file:
- `ci-cd/check-oas-route-resolution.js`

## 4) SonarQube Cloud check fails

Symptoms:
- workflow fails in SonarQube scan step
- quality gate reports no coverage imported

Common causes:
- missing or invalid `SONAR_TOKEN`
- LCOV file not generated before scan

Fix:

```bash
pnpm run test:unit
ls coverage/lcov.info
```

Then confirm:
- repository secret `SONAR_TOKEN` is configured
- `sonar-project.properties` includes:
  - `sonar.javascript.lcov.reportPaths=./coverage/lcov.info`

Related files:
- `.github/workflows/sonarqube-cloud.yml`
- `sonar-project.properties`

## 5) Codecov status fails (project or patch)

Symptoms:
- PR check fails for project coverage and/or patch coverage

Cause:
- coverage below target
- `coverage/lcov.info` is empty because a smoke or integration target replaced the
  unit-test artifact

Current standard:
- project target: `95%`
- patch target: `95%`

Fix:

```bash
pnpm run test:unit
wc -l coverage/lcov.info
pnpm run test:integration:service-management
wc -l coverage/lcov.info
```

The LCOV line count must remain non-zero and unchanged after the integration target.
Integration and smoke runners must use `--coverage=false`; unit tests are the
authoritative coverage-producing stage. If LCOV is valid but coverage is below the
threshold, add or improve tests in the changed code paths.

Related files:
- `codecov.yml`
- `jest.config.js`
- `ci-cd/run-service-management-integration.js`

## 6) Husky hooks are not running locally

Symptoms:
- commit/push does not trigger lint/test checks

Cause:
- hooks not installed (or repository freshly cloned)

Fix:

```bash
pnpm run prepare
ls .husky
```

Expected hooks in this project:
- `pre-commit`
- `pre-push`
- `commit-msg`
- `post-commit`

## 7) Redis-dependent smoke/integration fails

Symptoms:
- connection/auth errors in smoke or mutex integration tests

Cause:
- Redis unavailable or wrong password/config.

Fix:

```bash
pnpm run docker:composeredis
pnpm run ci:smoke
```

If needed, verify env keys used by tests:
- `AAA_REDIS_PASSWORD`
- `AAA_JWT_TOKEN_SECRET_KEY`

## 8) Fast local diagnosis flow

Run this sequence to isolate failing gate stages quickly:

```bash
pnpm run lint
pnpm run deps:check-cycles
pnpm run arch:check-boundaries
pnpm run arch:check-users-legacy-imports
pnpm run test:unit
pnpm run oas:check-routes
pnpm run build:dev
pnpm run ci:smoke
```

This is the same order used by `pnpm run ci:gate`.
