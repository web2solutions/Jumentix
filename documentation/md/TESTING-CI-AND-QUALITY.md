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

The selector reads `JUMENTIX_QUALITY_GATE_TARGET` and the PR flag
(`GITHUB_EVENT_NAME=pull_request`, `JUMENTIX_CI_IS_PULL_REQUEST` or
`AAA_CI_IS_PULL_REQUEST`). A task branch runs
`bun run ci:gate:task`, which executes only changed unit tests or tests related
to changed implementation files. A direct `dev` push runs the complete
`bun run test:unit` suite. A PR targeting `dev` runs `bun run ci:gate:task`
plus lightweight review. A release-promotion PR to `main` or any `main` path
runs `bun run ci:gate:strict`, the full local non-coverage matrix. This keeps
task feedback focused, `dev` delivery cheap, and release promotion strict.
Documentation-only task changes emit explicit `not-applicable` task evidence after validating
the changed Markdown files; they do not manufacture a passing test result.

Local enforcement:

- `.husky/pre-commit` synchronizes/stages `CHANGELOG.md`, then runs the task, `dev`, or `main` gate
- `.husky/pre-push` derives the pushed destination and runs the task, `dev`, or `main` gate
- `.husky/pre-merge-commit` runs the branch-aware gate on the merge destination
- `post-commit` is mutation-free (no auto-amend, no bypass flags)
- `.husky/commit-msg` runs commitlint (`@commitlint/config-conventional`)

Remote enforcement:

- GitHub Actions invokes `bun run ci:gate:branch`
- GitHub Actions passes the PR base branch or pushed branch explicitly, marks PR events, and stores branch-gate evidence even after failure
- GitHub Actions owns full coverage production (plus Codecov upload and SonarCloud scan) for pushes to `dev` and `main`, `dev -> main` promotions, and scheduled full runs; local gates and task PRs to `dev` stay fast and diagnostic
- Task-branch push events compare `origin/dev...HEAD`; hosted CI never uses the local staged-diff mode
- GitHub Actions stores `artifacts/ci/full-test-matrix.json` when the branch gate selects the full matrix
- `.github/workflows/ci.yml` independently runs Storybook build/smoke and website prepublish checks only for release/full contexts
- Storybook is absent from the repository full matrix
- `ci:monorepo` remains a compatibility entrypoint but cannot select a reduced docs-only plan

#### Hosted job matrix by context (JUM-786)

`ci-cd/classify-ci-context.js` (`JOBS_BY_CONTEXT`) and the job-level `if:` guards in
`.github/workflows/ci.yml` must agree. Heavy jobs (`workspace-builds`,
`workspace-tests`, `integration`, `coverage`, `website`, `database-matrix`) run
only for release/`main`/scheduled contexts (Requirements `087`/`113`). They
**intentionally skip** on task-branch pushes, PRs to `dev`, and cheap `dev`
pushes — a skip there is not a pass.

| Context | Hosted jobs that run | Branch-gate script + preflight |
| --- | --- | --- |
| Task-branch push | `branch-gate` | `ci:gate:task` + lint, `test:integrity`, `arch:check-workspace-boundaries`, `build:dev` |
| PR to `dev` | `branch-gate`, `third-party-review` | same task gate + preflight |
| Push to `dev` | `branch-gate` | `test:unit` + lint, integrity, workspace boundaries, `build:dev` |
| Release PR to `main` / push to `main` / schedule / `workflow_dispatch` | full list (`FULL_JOBS`) | `ci:gate:strict` (+ integrity, workspace boundaries, `build:dev` preflight) |

`build:dev` (`tsc -p tsconfig.build.json`) typechecks backend/package TypeScript
owned by the root compiler. `apps/frontend/**` is excluded: that workspace owns
`vue-tsc` (`bun run --cwd apps/frontend typecheck`). Service-management unit
tests are excluded like backend-template tests (JUM-785).

Workspace-boundary and `build:dev` steps are **preflight of every branch-gate
path since JUM-786**, so a red `ci:gate` step cannot hide behind skipped heavy
jobs on a PR to `dev`.

SonarQube Cloud coverage import:

- Workflow: `.github/workflows/ci.yml`
- Coverage source: `./coverage/lcov.info` (Jest LCOV)
- Scanner setting: `sonar.javascript.lcov.reportPaths=./coverage/lcov.info`
- Required GitHub Actions secret: `SONAR_TOKEN`

### Integrated Tooling Overview

| Integration | Purpose | Where it is configured | What to run / requirements |
|------------|---------|-------------------------|-----------------------------|
| GitHub Actions (branch gate) | Target-aware CI validation on push/PR | `.github/workflows/ci.yml` | Uses pinned Bun, selects by PR base/pushed branch, stores selected-gate evidence |
| GitHub Actions (coverage) | Repository-owned project and patch coverage | `.github/workflows/ci.yml` | Enforces `coverage:check` and `coverage:patch`, then retains JSON/LCOV evidence |
| GitHub Actions (Codecov) | Coverage dashboard publishing | `.github/workflows/ci.yml` | Requires `CODECOV_TOKEN`; uploads LCOV through `codecov/codecov-action@v5` after local thresholds pass |
| GitHub Actions (third-party review) | Fail-closed secret and static-analysis review | `.github/workflows/ci.yml` | Runs pinned Gitleaks/Semgrep and retains SARIF evidence |
| GitHub Actions (website) | Website-owned Storybook and publication readiness | `.github/workflows/ci.yml` | Runs Storybook build/smoke and prepublish checks independently |
| GitHub Actions (SonarQube Cloud) | Static analysis + quality gate + coverage import | `.github/workflows/ci.yml`, `sonar-project.properties` | Requires `SONAR_TOKEN`; imports retained LCOV after coverage passes |
| Repository coverage gate | Local hard gate to prevent low-coverage merges | `jest.config.js`, `ci-cd/check-coverage-thresholds.js` | Statements/lines/functions/branches 98%, changed lines 99%; branches under a dated floor (JUM-721) |
| Test integrity gate | Blocks suites that assert nothing, assert only on mocks, sleep as synchronisation, or sit outside the map | `ci-cd/check-test-integrity.js`, `ci-cd/run-branch-quality-gate.js` | `bun run test:integrity`; preflight of every branch-gate path (JUM-683) |
| Workspace boundaries + `build:dev` | Fail-closed architecture and root TypeScript emit before cheap gates | `ci-cd/check-workspace-boundaries.js`, `tsconfig.build.json`, `ci-cd/run-branch-quality-gate.js` | `bun run arch:check-workspace-boundaries` + `bun run build:dev`; preflight of every branch-gate path (JUM-786) |
| Husky | Local Git hooks for quality checks | `.husky/*` | Installed by `bun run prepare` |
| Commitlint + Commitizen | Conventional commits and guided commit flow | `commitlint.config.js`, `package.json` | `bun run commit` |
| Changelog sync automation | Keeps `CHANGELOG.md` aligned with Git history | `ci-cd/update-changelog.js`, `.husky/post-commit` | `bun run changelog:update`, `bun run changelog:check` |
| Release governance check | Enforces release script contracts and package publish metadata | `ci-cd/check-release-governance.js` | `bun run release:governance:check` |
| OpenAPI route resolution check | Ensures each operationId maps to handlers and controller methods | `ci-cd/check-oas-route-resolution.js` | `bun run oas:check-routes` |
| Hexagonal boundary check | Blocks controller-layer violations | `ci-cd/check-hexagonal-boundaries.js` | `bun run arch:check-boundaries` |
| Core import cycle check | Prevents cyclic dependencies in core namespaces | `ci-cd/check-core-import-cycles.js` | `bun run deps:check-cycles` |
| Legacy namespace check | Blocks new imports from old Users namespaces | `ci-cd/check-users-legacy-imports.js` | `bun run arch:check-users-legacy-imports` |
| Ownership placement (Req 137) | Suite and tooling homes match the code they assert; shrink-only allow-list must stay empty at steady state | `ci-cd/check-workspace-ownership-placement.js`, `ci-cd/ownership-placement-allowlist.json`, `ci-cd/test/check-workspace-ownership-placement.test.ts` | `bun run arch:check-ownership-placement`; wired into `ci:gate` and branch preflight |

### Suite homes (Requirement 137)

| Home | Asserts | Notes |
| --- | --- | --- |
| `apps/<A>/test/**` | `apps/<A>` | Consumer `@jumentix/*` wiring is allowed. Deep `packages/*/src` clones and `@src/` from Service Management are not (Req 126). `apps/service-management-api` may compose backend-template via `@src` by design. |
| `packages/<P>/test/**` | `packages/<P>` only | No app dual-home clones. |
| `ci-cd/test/**` | Root `ci-cd/**` monorepo gates, runners, test-map, release tooling | Gate fixtures may name other workspaces in prose without counting as foreign SUTs. |

Component-specific scripts live under `apps/<A>/scripts/` or `packages/<P>/scripts/` (or `bin/`). Root `package.json` keeps every public script name and delegates. New suites for a package or app go under that workspace's `test/`; new monorepo gate proof suites go under `ci-cd/test/`. After a move, run `bun run test-map:generate` and `bun run arch:check-ownership-placement`.

The allow-list at `ci-cd/ownership-placement-allowlist.json` is shrink-only. Steady state is `[]`. A stale entry (suite missing on disk) fails closed.

### CI Platforms and Responsibilities

#### Active hosted provider

GitHub Actions is active by Requirement 113, CircleCI is enabled as the secondary public CI provider, and the workflow runs on GitHub-hosted `ubuntu-latest` runners. It runs on
`dev`, `main`, and pull requests, with Sonar filtered to the two long-lived
branches. Codecov publishing runs after the repository-owned coverage gate and
never replaces it as the merge authority.

### Coverage Policy (Strict Standard)

- The repository-owned coverage workflow enforces project and patch coverage.
- The authority is `ci-cd/check-coverage-thresholds.js`, which reads the merged
  unit + browser report. It enforces four metrics before merge:
  - `statements >= 98%`
  - `lines >= 98%`
  - `functions >= 98%`
  - `branches >= 98%`
- `branches` is the one metric not yet at its threshold. The measured figure sits
  in `ACCEPTED_BELOW_THRESHOLD` as a **dated floor, owned by JUM-721**, and the
  entry is a ratchet, not a waiver: coverage at or above the floor passes, below
  it fails, and reaching 98% while the entry is still listed also fails. The
  floor moved from 93.278% to 95.902% during JUM-681; each move is recorded in
  the note beside it, with the behaviour the newly covered branches were hiding.
- Raising or lowering any of the four thresholds is a governance decision under
  Requirements 020 and 063.
- Commits and PRs are expected to respect these thresholds before approval.

### Test Integrity Gate (Requirements 134 and 135)

`ci-cd/check-test-integrity.js` enforces the mechanical half of "no flaky
tests, no fake tests":

1. every test declares that it asserts — **per test since JUM-702**, counting a
   declaration made once in a `beforeEach`/`beforeAll` of an enclosing
   `describe`;
2. no suite asserts only that a mock was called;
3. no fixed sleep is used as synchronisation;
4. no suite sits outside `test-map.json`.

It runs as a **preflight of every branch-gate path since JUM-683** — the task
gate, the unit gate and the strict matrix — beside lint and for the same reason:
it reads the suites without running them, and a tree whose tests assert nothing
has nothing to learn from running them. It was in the `ci:gate` script before
that, which no CI job invokes.

Its three registers (`ACCEPTED_SLEEPS`, `ACCEPTED_MOCK_ONLY`,
`ACCEPTED_NO_ASSERTIONS`) are **empty**. They are kept rather than deleted: the
injectable options are what let the suite exercise every failure path, and the
stale-entry checks — an entry naming a file that no longer offends is itself a
failure — are what make the next exception as auditable as these were.

### Bun Runtime and Node Compatibility Enforcement

The project is locked to Bun for internal engineering workflows and keeps Node 22 as the
consumer-facing compatibility target:

- `package.json` -> `"packageManager": "bun@1.3.13"`
- `package.json` -> `"engines": { "bun": ">=1.3.13", "node": ">=22.0.0 <23.0.0" }`
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
bun run arch:check-ownership-placement
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
