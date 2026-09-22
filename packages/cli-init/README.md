# @jumentix/cli-init

Factory generator CLI for Jumentix (Requirement `037` v2).

## Version policy

- The CLI package version tracks the factory template cohort it scaffolds.
- Generated projects pin published `@jumentix/*` package versions (not `workspace:*`).
- Library packages continue to use repository `bumpPackage` / conventional commits for semver.
- Publish through the protected `npm-publish` GitHub Actions workflow on `main` after `bun run npm:packages:check` and `bun run release:dry-run:packages` are green. See `documentation/md/NPM-PACKAGE-PUBLISHING.md`.

```bash
npx @jumentix/cli-init init
```

## Commands

- `jumentix init` — lean workspace per factory mode
- `jumentix add domain|service|frontend`
- `jumentix upgrade` / `jumentix doctor`
- Aliases: `jumentix-init`, `jumentix-bootstrap`

Normative surface (flags, config, GenerationPlan, upgrade policy):
`documentation/md/BOOTSTRAP-CLI-SCAFFOLDING.md` (+ pt-BR). Factory modes:
`documentation/md/JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md`.

## Packaged templates

Committed seeds live under `templates/{backend,frontend}/`, rebuilt from
`apps/backend-template` and `apps/frontend`:

```bash
bun run cli:build-templates
bun run cli:check-template-freshness
```

Freshness is wired into `ci:gate`. Measured size after packaging
(`du -sh packages/cli-init/templates`): **5.0M** (backend ~3.8M, frontend ~1.2M),
with exclusions for `.agents`, `node_modules`, `coverage`, `dist`, `OASdoc`,
`AsyncAPIdoc`, Cypress artifacts, `template/` leftovers, `test/` suites (seeds
keep their suites in `apps/*`; packaging them here would register as unmapped
suites under Requirement 135), and `seed/*-large.json`.

## Source resolution (JUM-846)

`init --from` / `--preset` normalize every accepted source into one
**GenerationPlan** before any files are written:

| Source | Flag | Loader |
| --- | --- | --- |
| Designer suite export JSON | `--from=export.json` | `loadDesignerExportSource` |
| OpenAPI 3.x YAML/JSON | `--from=spec.yml` | `loadOasSource` |
| Catalog URL | `--from=https://…` | `loadCatalogSource` |
| Users preset | `--preset=users` (default when `--from` omitted) | `loadPresetSource` |

Mode is inferred from architecture (one service → `monolith`) unless `--mode`
is set. Validation fails closed with named exit-1 messages for: no core
service; entity without primary key; relation crossing a service boundary in
monolith mode; unsupported http/realtime interface; duplicate entity names
across domains.

The Users preset OAS ships under `fixtures/users-oas.yml` (or
`templates/backend/spec/1.0.0.yml` when packaged).

## Backend generation (JUM-847)

After a plan resolves, `generateBackend()` copies the packaged backend seed
into `<dir>/apps/<service>` per service:

- Renames the package to `@<project>/<service>` and pins `@jumentix/*` deps
- Writes `.env.dev` from plan `http` / `realtime` / `db`
- Drops unused HTTP integration suites and unused db compose files (runtime
  adapters under `src/` stay intact)
- Keeps Users + auth on every core slice; injects other designer domains via
  `buildHexagonalBundle` into `src/modules/<Domain>/…` and registers them in
  `src/modules/compositionRoot.ts`
- Writes the filtered per-service OAS under `spec/1.0.0.yml`

## Frontend generation (JUM-848)

For `hybrid` / `frontend` modes (or `--frontend`), `generateFrontend()` copies
the packaged frontend seed into `<dir>/apps/frontend`:

- Renames the package to `@<project>/frontend` and pins `@jumentix/*` deps
- Bakes the merged OAS into `src/contracts/openapi.json` (keeps the seed
  contract when the plan OAS has no paths)
- Generates one module per domain: entity CRUD configs (operations from OAS
  operation ids, `searchFields` from `x-list-capabilities`), views, dashboard
  registration, nav/i18n titles, and router home redirect
- Writes `.env` with Core/service URLs (`VITE_API_BASE_URL`, proxy targets)
- `--offline` keeps the Cana offline layer; without it the generator disables
  Cana boot and drops offline Cypress specs

## Workspace assembly (JUM-849)

After backend/frontend generation, `assembleWorkspace()` writes the Bun root:

- Root `package.json` with workspaces `apps/*` and fan-out scripts
  `dev|test|lint|build`
- `.gitignore`, `docker-compose.yml` (chosen db + Redis when realtime ≠ none)
- Generated `README.md` (how to run, ports, seeded accounts)
- `.jumentix/project.json` (cli version, template commit, mode, plan, timestamps)
- `.jumentix/manifest.json` (sha256 per generated file)
- `jumentix.init.json` (answers for `--config` round-trips)
- `--install` → `bun install` (creates `bun.lock`); `--git` → `git init` + first commit
- `.jumentix/service-profile.json` is removed when present (retired)

```bash
bun ./packages/cli-init/bin/jumentix.js init demo \
  --preset=users --non-interactive --mode=hybrid --frontend --offline \
  --http=express --db=sqlite --install --git
```

## Add commands (JUM-850)

Run inside a generated project (requires `.jumentix/project.json`):

| Command | Effect |
| --- | --- |
| `jumentix add domain <name> [--from …] [--service <id>]` | Inject hexagonal domain into Core (or `--service`) and refresh frontend modules when present |
| `jumentix add service <name> --domains a,b` | Create `apps/<name>` in services/hybrid mode and move domain ownership |
| `jumentix add frontend [--offline]` | Add `apps/frontend` to a backend-only project (mode → `hybrid`) |

Manifest drift is refused unless `--force`. Missing project metadata exits `1` with a clear message.

## Upgrade (JUM-851)

`jumentix upgrade [--dry-run] [--force]` three-way-merges the current template
cohort onto a generated project using `.jumentix/manifest.json` hashes and
baseline blobs under `.jumentix/objects/<sha256>`:

| Status | Meaning |
| --- | --- |
| updated | Unchanged locally → take template, or clean auto-merge |
| conflicted | Overlapping edits — conflict markers left in the file |
| skipped | No template change, or only local edits |
| added / removed | New template paths / retired paths (retired files kept) |

`--dry-run` prints the report without writing. Dirty git trees require `--force`.
A markdown report is written to `.jumentix/upgrade-<version>.md` when applied.

## Doctor (JUM-852)

`jumentix doctor` reports environment and project health:

| Area | Checks |
| --- | --- |
| environment | bun version (required), node ≥20 when present, docker availability |
| project | `.jumentix/project.json` + mode, template version vs CLI templates, expected `apps/*` directories, manifest drift |

Exit `0` when healthy, `1` for project blockers, `2` for environment blockers
(for example missing bun).

## Generation e2e matrix (JUM-854)

`test/e2e/run-generation-matrix.ts` drives a factory generation matrix
(monolith/express/sqlite, monolith/fastify/postgres, services, hybrid,
frontend-only, `--offline`). Default `bun test` always exercises the
non-Docker `monolith/express/sqlite` cell (generate into a tmp dir, verify
`apps/*`). Heavy Docker cells run only when `CLI_INIT_E2E_DOCKER=1` and Docker
is available; otherwise they skip with a named reason. Optional
`CLI_INIT_E2E_INSTALL=1` adds `bun install` after generation. Each cell records
runtime; failures name the command that failed.

```bash
bun run --cwd packages/cli-init test
CLI_INIT_E2E_DOCKER=1 bun run --cwd packages/cli-init test ./test/e2e
```

## Normative docs

- `.agents/requirements/software/037-bootstrap-cli-scaffolding.md`
- `documentation/md/BOOTSTRAP-CLI-SCAFFOLDING.md` (+ pt-BR)

## Current package entrypoint

Factory command routing, source resolution, backend/frontend generation, root
workspace assembly, `add domain|service|frontend`, `upgrade` (three-way merge),
`doctor` diagnostics, and the generation e2e matrix are live. Legacy
`--service-type` / bare monolith clone remains only as a compatibility path.

```bash
bun ./packages/cli-init/bin/jumentix.js --help
bun run --cwd packages/cli-init test
```
