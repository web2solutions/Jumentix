# Testing, CI, and Quality Gates

## Testing

Run full test suite:

```bash
bun run test
```

Run unit tests:

```bash
bun run test:unit
```

Run integration tests:

```bash
bun run test:integration
```

Run realtime integration tests:

```bash
bun run test:integration:realtime
```

Run Redis-backed multi-instance realtime integration:

```bash
bun run test:integration:realtime:redis-streams
```

Run database driver smoke tests:

```bash
bun run test:smoke:db:all
```

Run realtime smoke tests:

```bash
bun run test:smoke:realtime
bun run smoke:realtime:redis-streams
```

`test:smoke:db:all` orchestrates each driver-specific smoke command, including
automatic `docker compose up/down` for container-backed databases.

Container-backed smoke shortcuts:

```bash
bun run smoke:db:postgresql
bun run smoke:db:mysql
bun run smoke:db:mssql
bun run smoke:db:oracle
bun run smoke:db:mongodb
bun run smoke:db:cassandra
bun run smoke:db:dynamodb
bun run smoke:db:firebase
bun run smoke:db:aurora
bun run smoke:db:rds
```

Per runtime:

```bash
bun run test:integration:express
bun run test:integration:fastify
bun run test:integration:restify
bun run test:integration:lambda
```

## CI and Quality Gates

Main gate:

```bash
bun run ci:gate
```

Full-matrix release gate:

```bash
bun run ci:gate:strict
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
- minimum project and patch coverage thresholds owned by repository scripts

The strict gate is an explicit, fail-closed manifest with 23 required cells:

- lint, architecture, contract, release-governance, security, and API smoke checks
- canonical provider-integration contract validation
- unit tests, root and workspace builds/tests, and patch coverage
- the complete 15-target HTTP, Lambda, realtime, and Service Management integration matrix
- aggregate execution that reports every failing cell instead of stopping at the first failure

Integration targets use `--coverage=false`; unit tests remain the authoritative
coverage-producing stage. Empty, duplicate, malformed, missing-script, crashed, or
non-zero cells fail closed. Scope-aware execution, including docs-only changes, cannot
omit a cell at a delivery boundary.

Each integration target runs with `CI=true`. The default process timeout is 120 seconds.
The complete Express and Fastify targets have explicit 300-second
overrides because their full HTTP suites have reached or approached the process deadline
under release-matrix load. Complete Restify alone has a finite 600-second process budget
after an extreme-load run reached the former 300-second ceiling while the preceding unit
phase took 327.115 seconds. In one strict run, Fastify also crossed
the 120-second boundary after its assertions. This target-specific headroom prevents `SIGTERM` from
truncating an active HTTP response or cleanup without weakening the timeout for smaller
targets; an explicitly supplied runner timeout remains authoritative. Any timeout is reported
as exit `124`, fails the integration cell, and does not prevent the remaining targets from
being reported.

Restify additionally runs with a 15-second Jest per-test timeout. Under sustained strict-matrix
load, authenticated Restify requests have measured 5.4–5.8 seconds, beyond Jest's generic
5-second default. The target-specific budget lets those real requests settle instead of
canceling their assertions while leaving HTTP handles active. It does not add retries, skip
tests, weaken assertions, or change the separate finite 600-second process deadline. Express,
Fastify, and every other integration target retain their existing per-test defaults.

Fastify and Restify integration files bind their HTTP server once to an ephemeral loopback
port, reuse that listener for every Supertest request in the file, and close it explicitly in
`afterAll`. This prevents Supertest from repeatedly opening and closing the same native server,
which can otherwise cross responses or leave parser/listener handles behind under sustained
matrix load. The listener lifecycle uses no fixed port, retry, skipped assertion, or forced
process exit.

Generated `dist` output is excluded from lint so a completed build cannot make the next
matrix run fail for scanning generated declarations.

Branch-aware enforcement:

```bash
bun run ci:gate:branch
```

The selector reads `JUMENTIX_QUALITY_GATE_TARGET`. A task branch runs `bun run ci:gate:task`, which executes only changed unit tests or tests related to changed
implementation files. A `dev` target runs the complete `bun run test:unit` suite. A
`main` target runs `bun run ci:gate:strict`, including all 23 required cells. This
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

- GitHub Actions invokes `bun run ci:gate:branch`; CircleCI is retired by Requirement 113
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
| GitHub Actions (tests) | Target-aware CI validation on push/PR | `.github/workflows/test.yml` | Uses pinned Bun, selects by PR base/pushed branch, uploads selected-gate evidence and main matrix evidence |
| GitHub Actions (coverage) | Repository-owned project and patch coverage | `.github/workflows/coverage.yml` | Enforces `coverage:check` and `coverage:patch`, then retains JSON/LCOV evidence |
| GitHub Actions (third-party review) | Fail-closed secret and static-analysis review | `.github/workflows/third-party-review.yml` | Runs pinned Gitleaks/Semgrep and publishes findings through pinned Reviewdog |
| GitHub Actions (website) | Website-owned Storybook and publication readiness | `.github/workflows/website.yml` | Path-scoped to website inputs; runs Storybook build/smoke and prepublish checks independently |
| GitHub Actions (SonarQube Cloud) | Static analysis + quality gate + coverage import | `.github/workflows/sonarqube-cloud.yml`, `sonar-project.properties` | Requires `SONAR_TOKEN`; produces LCOV before scanning |
| Repository coverage gate | Local hard gate to prevent low-coverage merges | `jest.config.js`, `ci-cd/check-coverage-thresholds.js` | Statements/lines/functions 99%, branches 90%, changed lines 99% |
| Husky | Local Git hooks for quality checks | `.husky/*` | Installed by `bun run prepare` |
| Commitlint + Commitizen | Conventional commits and guided commit flow | `commitlint.config.js`, `package.json` | `bun run commit` |
| Changelog sync automation | Keeps `CHANGELOG.md` aligned with Git history | `ci-cd/update-changelog.js`, `.husky/post-commit` | `bun run changelog:update`, `bun run changelog:check` |
| Release governance check | Enforces release script contracts and package publish metadata | `ci-cd/check-release-governance.js` | `bun run release:governance:check` |
| OpenAPI route resolution check | Ensures each operationId maps to handlers and controller methods | `ci-cd/check-oas-route-resolution.js` | `bun run oas:check-routes` |
| Hexagonal boundary check | Blocks controller-layer violations | `ci-cd/check-hexagonal-boundaries.js` | `bun run arch:check-boundaries` |
| Core import cycle check | Prevents cyclic dependencies in core namespaces | `ci-cd/check-core-import-cycles.js` | `bun run deps:check-cycles` |
| Legacy namespace check | Blocks new imports from old Users namespaces | `ci-cd/check-users-legacy-imports.js` | `bun run arch:check-users-legacy-imports` |

### CI Platforms and Responsibilities

#### Retired hosted providers

CircleCI and Codecov are retired by Requirement 113. Their paid private-repository
features are replaced by tracked GitHub Actions and repository-owned coverage scripts.

#### GitHub Actions - Test Workflow

- Workflow file: `.github/workflows/test.yml`
- Triggers on:
  - `push` to `main` and `dev`
  - `pull_request` to `dev` and `main`
- Sets up Redis (with password), installs pinned Bun, and runs `bun run ci:gate:branch` with the PR base or pushed branch
- Uploads selected-gate evidence with `if: always()` and full-matrix evidence for `main`; docs-only changes do not bypass the selected gate

#### GitHub Actions - SonarQube Cloud Workflow

- Workflow file: `.github/workflows/sonarqube-cloud.yml`
- Triggers on:
  - `push` to `main` and `dev`
  - `pull_request` to `main`
- Installs dependencies, runs unit tests with coverage, then executes SonarQube scan action
- Scanner reads `./coverage/lcov.info` as configured in `sonar-project.properties`

### Coverage Policy (Strict Standard)

- The repository-owned coverage workflow enforces project and patch coverage.
- Jest enforces the local gate before merge:
  - `lines >= 99%`
  - `statements >= 99%`
  - `branches >= 90%`
  - `functions >= 99%`
- Commits and PRs are expected to respect these thresholds before approval.

### Bun Runtime and Node Compatibility Enforcement

The project is locked to Bun for internal engineering workflows and keeps Node 22 as the
consumer-facing compatibility target:

- `package.json` -> `"packageManager": "bun@1.3.14"`
- `package.json` -> `"engines": { "bun": ">=1.3.14", "node": ">=22.0.0 <23.0.0" }`
- `bunfig.toml` keeps Bun as the script runner boundary.
- `ci-cd/check-bun-version.js` validates the active Bun toolchain.
- `ci-cd/check-node-version.js` is exposed through `compat:check-node-version` for Node compatibility checks.
- `.nvmrc` and `.node-version` are both pinned to `22.0.0`

Recommended local setup:

```bash
bun --version
bun run check-bun-version
bun run compat:check-node-version
```

### Environment and Secrets in CI

Common variables used by tests and workflows:

- `JUMENTIX_JWT_TOKEN_SECRET_KEY`
- `JUMENTIX_REDIS_PASSWORD`
- `SONAR_TOKEN` (required only for SonarQube scan step)

Environment bootstrap during tests:

- `jest.config.js` uses `setupFiles: ["./ci-cd/loadEnvironment.js"]`
- `ci-cd/loadEnvironment.js` loads the first existing file from:
  - `dev`: `.env.dev`, `.env.dev.example`, `.env.ci`
  - `ci`: `.env.ci`, `.env.dev.example`
  - `prod`: `.env.prod`
  - `staging`: `.env.staging`
- For CI safety, it sets `JUMENTIX_JWT_TOKEN_SECRET_KEY=ci_jwt_secret_key` if missing.

### Quality Gate Commands (Local Equivalent of CI)

Run full gate:

```bash
bun run ci:gate:strict
```

Run targeted checks:

```bash
bun run deps:check-cycles
bun run arch:check-boundaries
bun run arch:check-users-legacy-imports
bun run arch:check-workspace-boundaries
bun run workspace:check-quality
bun run workspace:check-coverage-policy
bun run release:governance:check
bun run oas:check-routes
bun run test:unit
bun run ci:smoke
bun run ci:integration
```

### Troubleshooting (CI / SonarQube / repository coverage)

For CI incidents and failing checks, see:

- [CI / SonarQube / repository coverage troubleshooting](./CI-TROUBLESHOOTING.md)
- [Realtime API Testing Guide](./REALTIME-API-TESTING.md)
