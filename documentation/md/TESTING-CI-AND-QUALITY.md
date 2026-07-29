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

Full-matrix release gate:

```bash
pnpm run ci:gate:strict
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

The strict gate is an explicit, fail-closed manifest with 21 required cells:

- lint, architecture, contract, release-governance, security, and API smoke checks
- unit tests, root and workspace builds/tests, and patch coverage
- the complete 15-target HTTP, Lambda, realtime, and Service Management integration matrix
- aggregate execution that reports every failing cell instead of stopping at the first failure

Integration targets use `--coverage=false`; unit tests remain the authoritative
coverage-producing stage. Empty, duplicate, malformed, missing-script, crashed, or
non-zero cells fail closed. Scope-aware execution, including docs-only changes, cannot
omit a cell at a delivery boundary.

Each integration target runs with `CI=true`. The default process timeout is 120 seconds;
the complete Express target has a 300-second override because its 22 suites and 171 tests
have a measured runtime close to the default limit under release-matrix load. This
target-specific headroom prevents `SIGTERM` from truncating an active HTTP response without
weakening the timeout for the other targets. Any timeout is reported as exit `124`, fails
the integration cell, and does not prevent the remaining targets from being reported.
Generated `dist` output is excluded from lint so a completed build cannot make the next
matrix run fail for scanning generated declarations.

Branch-aware enforcement:

```bash
pnpm run ci:gate:branch
```

The selector reads `JUMENTIX_QUALITY_GATE_TARGET`. A task branch runs `pnpm run
ci:gate:task`, which executes only changed unit tests or tests related to changed
implementation files. A `dev` target runs the complete `pnpm run test:unit` suite. A
`main` target runs `pnpm run ci:gate:strict`, including all 21 required cells. This
keeps task feedback focused, integration evidence complete, and release promotion strict.
Documentation-only task changes emit explicit `not-applicable` task evidence after validating
the changed Markdown files; they do not manufacture a passing test result.

Local enforcement:

- `.husky/pre-commit` synchronizes/stages `CHANGELOG.md`, then runs the task, `dev`, or `main` gate
- `.husky/pre-push` derives the pushed destination and runs the task, `dev`, or `main` gate
- `.husky/pre-merge-commit` runs the branch-aware gate on the merge destination
- `post-commit` is mutation-free (no auto-amend, no bypass flags)
- `.husky/commit-msg` runs commitlint (`@commitlint/config-conventional`)

Remote enforcement:

- CircleCI and GitHub Actions invoke `pnpm run ci:gate:branch`
- GitHub Actions passes the PR base branch or pushed branch explicitly and uploads branch-gate evidence even after failure
- Task-branch push events compare `origin/dev...HEAD`; hosted CI never uses the local staged-diff mode
- GitHub Actions uploads `artifacts/ci/full-test-matrix.json` for `main` work even after failure
- `.github/workflows/website.yml` independently runs Storybook build/smoke and website prepublish
  checks only when website-owned paths change
- Storybook is absent from `.github/workflows/test.yml` and the repository full matrix
- `ci:monorepo` remains a compatibility entrypoint but cannot select a reduced docs-only plan

SonarQube Cloud coverage import:

- Workflow: `.github/workflows/sonarqube-cloud.yml`
- Coverage source: `./coverage/lcov.info` (Jest LCOV)
- Scanner setting: `sonar.javascript.lcov.reportPaths=./coverage/lcov.info`
- Required repository secret: `SONAR_TOKEN`

### Integrated Tooling Overview

| Integration | Purpose | Where it is configured | What to run / requirements |
|------------|---------|-------------------------|-----------------------------|
| CircleCI | Branch-aware pipeline with coverage upload | `.circleci/config.yml` | Runs only for `dev` and `main`; selects unit gate for `dev` and full matrix for `main`, stores selected-gate evidence |
| GitHub Actions (tests) | Target-aware CI validation on push/PR | `.github/workflows/test.yml` | Uses Node `22.x`, selects by PR base/pushed branch, uploads selected-gate evidence and main matrix evidence |
| GitHub Actions (website) | Website-owned Storybook and publication readiness | `.github/workflows/website.yml` | Path-scoped to website inputs; runs Storybook build/smoke and prepublish checks independently |
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
- Installs `pnpm@9.15.3`, waits for Redis, selects the branch-aware gate, stores gate evidence, and uploads coverage with Codecov orb
- GitHub Actions is authoritative for PR-target detection; release promotions to `main` always receive the full-matrix gate there

#### GitHub Actions - Test Workflow

- Workflow file: `.github/workflows/test.yml`
- Triggers on:
  - `push` to `main` and `dev`
  - `pull_request` to `dev` and `main`
- Sets up Redis (with password), installs `pnpm`, and runs `pnpm run ci:gate:branch` with the PR base or pushed branch
- Uploads selected-gate evidence with `if: always()` and full-matrix evidence for `main`; docs-only changes do not bypass the selected gate

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
pnpm run ci:gate:strict
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
pnpm run ci:integration
```

### Troubleshooting (CI / SonarQube / Codecov)

For CI incidents and failing checks, see:

- [CI / SonarQube / Codecov Troubleshooting](./CI-TROUBLESHOOTING.md)
- [Realtime API Testing Guide](./REALTIME-API-TESTING.md)
