# Testing, CI, and Quality Gates

## Testing

Run full test suite:

```bash
pnpm test
```

Run unit tests:

```bash
pnpm run test:unit
```

Run integration tests:

```bash
pnpm run test:integration
```

Run realtime integration tests:

```bash
pnpm run test:integration:realtime
```

Run Redis-backed multi-instance realtime integration:

```bash
pnpm run test:integration:realtime:redis-streams
```

Run database driver smoke tests:

```bash
pnpm run test:smoke:db:all
```

Run realtime smoke tests:

```bash
pnpm run test:smoke:realtime
pnpm run smoke:realtime:redis-streams
```

`test:smoke:db:all` orchestrates each driver-specific smoke command, including
automatic `docker compose up/down` for container-backed databases.

Container-backed smoke shortcuts:

```bash
pnpm run smoke:db:postgresql
pnpm run smoke:db:mysql
pnpm run smoke:db:mssql
pnpm run smoke:db:oracle
pnpm run smoke:db:mongodb
pnpm run smoke:db:cassandra
pnpm run smoke:db:dynamodb
pnpm run smoke:db:firebase
pnpm run smoke:db:aurora
pnpm run smoke:db:rds
```

Per runtime:

```bash
pnpm run test:integration:express
pnpm run test:integration:fastify
pnpm run test:integration:restify
pnpm run test:integration:lambda
pnpm run test:integration:hyper-express
```

## CI and Quality Gates

Main gate:

```bash
pnpm run ci:gate
```

Included checks:

- `lint`
- core import cycle check
- hexagonal boundary check
- users legacy import check
- workspace package quality check (required script contracts and no placeholder test scripts)
- release governance check (required release scripts, semver validity, publish metadata for non-private packages)
- unit tests
- OpenAPI route resolution check
- build
- integration smoke
- minimum coverage threshold (99% global via Jest + Codecov status)

Local enforcement:

- `.husky/pre-commit` runs `pnpm run changelog:update && git add CHANGELOG.md && pnpm run lint && pnpm run test:unit`
- `.husky/pre-push` runs `pnpm run ci:gate:strict`
- `post-commit` is mutation-free (no auto-amend, no bypass flags)
- `.husky/commit-msg` runs commitlint (`@commitlint/config-conventional`)
- `.husky/post-commit` updates `CHANGELOG.md` from Git history and auto-amends the commit when needed

SonarQube Cloud coverage import:

- Workflow: `.github/workflows/sonarqube-cloud.yml`
- Coverage source: `./coverage/lcov.info` (Jest LCOV)
- Scanner setting: `sonar.javascript.lcov.reportPaths=./coverage/lcov.info`
- Required repository secret: `SONAR_TOKEN`

### Integrated Tooling Overview

| Integration | Purpose | Where it is configured | What to run / requirements |
|------------|---------|-------------------------|-----------------------------|
| CircleCI | Main pipeline for lint + tests + architecture checks + smoke + upload coverage | `.circleci/config.yml` | Installs with `pnpm`, runs `pnpm run ci:monorepo` |
| GitHub Actions (tests) | Secondary CI validation on push/PR | `.github/workflows/test.yml` | Uses Node `22.x`, installs with `pnpm`, runs scope-aware `pnpm run ci:monorepo -- <changed-files>` |
| GitHub Actions (SonarQube Cloud) | Static analysis + quality gate + coverage import | `.github/workflows/sonarqube-cloud.yml`, `sonar-project.properties` | Requires `SONAR_TOKEN`; runs `pnpm run test:unit` first |
| Codecov | Coverage status checks for project and patch | `codecov.yml` | Target is `95%` for project and patch |
| Jest coverage gate | Local hard gate to prevent low-coverage merges | `jest.config.js` | Global thresholds: `lines/statements >= 95%`, `branches/functions >= 80%` |
| Husky | Local Git hooks for quality checks | `.husky/*` | Installed by `pnpm run prepare` |
| Commitlint + Commitizen | Conventional commits and guided commit flow | `commitlint.config.js`, `package.json` | `pnpm run commit` |
| Changelog sync automation | Keeps `CHANGELOG.md` aligned with Git history | `ci-cd/update-changelog.js`, `.husky/post-commit` | `pnpm run changelog:update`, `pnpm run changelog:check` |
| Release governance check | Enforces release script contracts and package publish metadata | `ci-cd/check-release-governance.js` | `pnpm run release:governance:check` |
| OpenAPI route resolution check | Ensures each operationId maps to handlers and controller methods | `ci-cd/check-oas-route-resolution.js` | `pnpm run oas:check-routes` |
| Hexagonal boundary check | Blocks controller-layer violations | `ci-cd/check-hexagonal-boundaries.js` | `pnpm run arch:check-boundaries` |
| Core import cycle check | Prevents cyclic dependencies in core namespaces | `ci-cd/check-core-import-cycles.js` | `pnpm run deps:check-cycles` |
| Legacy namespace check | Blocks new imports from old Users namespaces | `ci-cd/check-users-legacy-imports.js` | `pnpm run arch:check-users-legacy-imports` |

### CI Platforms and Responsibilities

#### CircleCI

- Pipeline file: `.circleci/config.yml`
- Uses `cimg/node:22.23` plus `redis:latest`
- Installs `pnpm@9.15.3`, runs `pnpm install --no-frozen-lockfile`, waits for Redis, executes `pnpm run ci:monorepo`, uploads coverage with Codecov orb
- This is the primary all-in-one gate

#### GitHub Actions - Test Workflow

- Workflow file: `.github/workflows/test.yml`
- Triggers on:
  - `push` to `main` and `dev`
  - `pull_request` to `main`
- Sets up Redis (with password), installs `pnpm`, computes changed files against `main`, runs `pnpm run ci:monorepo -- <changed-files>`
- Uses docs-only lightweight checks or strict gate + affected app/package flow depending on delta scope

#### GitHub Actions - SonarQube Cloud Workflow

- Workflow file: `.github/workflows/sonarqube-cloud.yml`
- Triggers on:
  - `push` to `main` and `dev`
  - `pull_request` to `main`
- Installs dependencies, runs unit tests with coverage, then executes SonarQube scan action
- Scanner reads `./coverage/lcov.info` as configured in `sonar-project.properties`

### Coverage Policy (Strict Standard)

- Codecov enforces:
  - project coverage target: `95%`
  - patch coverage target: `95%`
- Jest enforces local gate before merge:
  - `lines >= 99%`
  - `statements >= 99%`
  - `branches >= 90%`
  - `functions >= 99%`
- Commits and PRs are expected to respect these thresholds before approval.

### Node 22 Runtime Enforcement

The project is locked to Node 22:

- `package.json` -> `"engines": { "node": ">=22.0.0 <23.0.0" }`
- `.npmrc` -> `engine-strict=true`
- `preinstall` script -> `pnpm run check-node-version`
- `ci-cd/check-node-version.js` validates `process.version` against `engines.node`
- `.nvmrc` and `.node-version` are both pinned to `22.0.0`

Recommended local setup:

```bash
nvm use
node -v
pnpm -v
```

### Environment and Secrets in CI

Common variables used by tests and workflows:

- `AAA_JWT_TOKEN_SECRET_KEY`
- `AAA_REDIS_PASSWORD`
- `SONAR_TOKEN` (required only for SonarQube scan step)

Environment bootstrap during tests:

- `jest.config.js` uses `setupFiles: ["./ci-cd/loadEnvironment.js"]`
- `ci-cd/loadEnvironment.js` loads the first existing file from:
  - `dev`: `.env.dev`, `.env.dev.example`, `.env.ci`
  - `ci`: `.env.ci`, `.env.dev.example`
  - `prod`: `.env.prod`
  - `staging`: `.env.staging`
- For CI safety, it sets `AAA_JWT_TOKEN_SECRET_KEY=ci_jwt_secret_key` if missing.

### Quality Gate Commands (Local Equivalent of CI)

Run full gate:

```bash
pnpm run ci:gate
```

Run targeted checks:

```bash
pnpm run deps:check-cycles
pnpm run arch:check-boundaries
pnpm run arch:check-users-legacy-imports
pnpm run arch:check-workspace-boundaries
pnpm run workspace:check-quality
pnpm run workspace:check-coverage-policy
pnpm run release:governance:check
pnpm run oas:check-routes
pnpm run test:unit
pnpm run ci:smoke
```

### Troubleshooting (CI / SonarQube / Codecov)

For CI incidents and failing checks, see:

- [CI / SonarQube / Codecov Troubleshooting](./CI-TROUBLESHOOTING.md)
- [Realtime API Testing Guide](./REALTIME-API-TESTING.md)
