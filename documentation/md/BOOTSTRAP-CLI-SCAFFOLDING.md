# Factory Generator CLI (`@jumentix/cli-init`)

Requirement `037` (v2) defines `@jumentix/cli-init` as the **factory generator**:
it produces a lean Bun workspace for one factory mode instead of cloning the
entire monorepo.

Workspace ownership:

- `packages/cli-init` owns the CLI implementation, packaged templates, and
  freshness gate.
- Root `bin/jumentix-bootstrap.js` delegates to the package for compatibility.

Install and invoke:

```bash
npx @jumentix/cli-init init
# or from a checkout:
bun ./packages/cli-init/bin/jumentix.js --help
```

Aliases `jumentix-init` and `jumentix-bootstrap` remain. Legacy `--service-type`
invocations map to `init --mode monolith` with a deprecation notice.

Cross-check this document against `jumentix --help` and `jumentix <command> --help`.
Exit codes: `0` ok, `1` user/project error, `2` environment failure (doctor may
also use `1`/`2` as below).

## Commands

| Command | Purpose |
| --- | --- |
| `jumentix init [dir]` | Create a lean workspace |
| `jumentix add domain\|service\|frontend` | Extend an existing generated project |
| `jumentix upgrade` | Template three-way merge (`--dry-run` supported) |
| `jumentix doctor` | Environment and project diagnostics |
| `jumentix help` | Show top-level usage |

### `init` flags

| Flag | Values / notes |
| --- | --- |
| `--mode` | `monolith` \| `services` \| `hybrid` \| `frontend` |
| `--from` | Designer export JSON, OAS 3.x YAML/JSON, or catalog URL |
| `--preset` | `users` (default when `--from` is omitted) |
| `--http` | `express` \| `fastify` \| `restify` |
| `--realtime` | `none` \| `websocket` \| `grpc` |
| `--db` | `sqlite` \| `postgres` \| `mysql` \| `mongo` \| `inmemory` |
| `--frontend` | Include `apps/frontend` (hybrid path) |
| `--offline` | Keep Cana offline layer on the frontend |
| `--git` | `git init` + first commit after assembly |
| `--install` | Run `bun install` after assembly |
| `--config` | Path to `jumentix.init.json` answers |
| `--non-interactive` | Require every answer from flags/config (no prompts) |

Example (Users preset, hybrid, offline):

```bash
bun ./packages/cli-init/bin/jumentix.js init demo \
  --preset=users --non-interactive --mode=hybrid --frontend --offline \
  --http=express --db=sqlite --install --git
```

### Modes (map to factory matrix)

| `--mode` | Factory matrix row | Layout |
| --- | --- | --- |
| `monolith` | Modular Monolith (Backend) | One Core service; all domains in-process |
| `services` | Multi-service Backend Group | Core (Users + auth) + domain services |
| `hybrid` | Hybrid Backend + Frontend | Backend apps + `apps/frontend` |
| `frontend` | Frontend-only SPA/PWA Offline | `apps/frontend` consuming contracts |

Mode is inferred from architecture (one service → `monolith`) unless `--mode`
is set. See
[JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md).

### Config file (`jumentix.init.json`)

`--config` / generated round-trip file is a JSON object with optional keys:

```json
{
  "mode": "hybrid",
  "from": "./export.json",
  "preset": "users",
  "http": "express",
  "realtime": "none",
  "db": "sqlite",
  "frontend": true,
  "offline": true,
  "git": true,
  "install": true,
  "projectName": "demo",
  "nonInteractive": true
}
```

`--non-interactive` fails closed when a required answer is missing from flags
or this file.

## GenerationPlan sources

`init --from` / `--preset` normalize every accepted source into one
**GenerationPlan** before any files are written:

| Source | Flag | Loader |
| --- | --- | --- |
| Designer suite export JSON | `--from=export.json` | `loadDesignerExportSource` |
| OpenAPI 3.x YAML/JSON | `--from=spec.yml` | `loadOasSource` |
| Catalog URL | `--from=https://…` | `loadCatalogSource` |
| Users preset | `--preset=users` | `loadPresetSource` |

Validation fails closed with named exit-`1` messages for: no core service;
entity without primary key; relation crossing a service boundary in monolith
mode; unsupported http/realtime interface; duplicate entity names across
domains.

The Users preset OAS ships under `fixtures/users-oas.yml` (or
`templates/backend/spec/1.0.0.yml` when packaged).

## Templates and freshness

Templates are committed under `packages/cli-init/templates/{backend,frontend}/`
and rebuilt with `packages/cli-init/scripts/build-templates.js` from
`apps/backend-template` and `apps/frontend`.

```bash
bun run cli:build-templates
bun run cli:check-template-freshness
```

Freshness gate fails closed when packaged templates drift from seeds. Script:
`packages/cli-init/scripts/check-template-freshness.js` (wired into `ci:gate`).

## Workspace assembly pipeline

1. **Source resolution** — build `GenerationPlan` from `--from` / `--preset`.
2. **Backend generation** — lean `apps/<service>` slices from the packaged seed:
   renamed `@<project>/<service>`, `.env.dev` from plan interfaces/db, unused
   integration suites / db compose files pruned, Users + auth retained on core,
   designer domains injected via `buildHexagonalBundle` into
   `src/modules/<Domain>/…` with registration in `compositionRoot.ts`.
3. **Frontend generation** (hybrid/frontend or `--frontend`) — `apps/frontend`
   with merged OAS in `src/contracts/openapi.json`, one module per domain,
   `.env` with Core/service URLs, optional Cana via `--offline`.
4. **Workspace assembly** — Bun root: `package.json` with workspaces `apps/*`
   and fan-out `dev|test|lint|build`, `.gitignore`, `docker-compose.yml` for the
   chosen database (+ Redis when realtime is enabled), generated `README.md`,
   `.jumentix/project.json`, `.jumentix/manifest.json`, `jumentix.init.json`.
   Optional `--install` / `--git`.

## Generated-project contract

Every generated workspace includes:

| Artifact | Role |
| --- | --- |
| `.jumentix/project.json` | Plan + mode + template cohort; consumed by `add` / `upgrade` / `doctor` |
| `.jumentix/manifest.json` | sha256 of generated files (upgrade merge) |
| `.jumentix/objects/<sha256>` | Baseline blobs for three-way merge |
| `jumentix.init.json` | Answers for `--config` round-trips |

`.jumentix/service-profile.json` is retired and removed when present.

Runtime dependencies are published `@jumentix/*` packages pinned to the CLI
version (not `workspace:*`). Generated projects must pass their own
`lint` / `test` / `build` and boot in Docker.

## `add` (extend)

Run inside a generated project (requires `.jumentix/project.json`):

| Command | Effect |
| --- | --- |
| `jumentix add domain <name> [--from …] [--service <id>]` | Inject hexagonal domain into Core (or `--service`); refresh frontend modules when present |
| `jumentix add service <name> --domains a,b` | Create `apps/<name>` in services/hybrid mode; move domain ownership |
| `jumentix add frontend [--offline]` | Add `apps/frontend` to a backend-only tree (mode → `hybrid`) |

Manifest drift is refused unless `--force`. Missing project metadata exits `1`.

## `upgrade` policy

`jumentix upgrade [--dry-run] [--force]` three-way-merges the current template
cohort using `.jumentix/manifest.json` hashes and `.jumentix/objects/<sha256>`
baselines:

| Status | Meaning |
| --- | --- |
| `updated` | Unchanged locally → take template, or clean auto-merge |
| `conflicted` | Overlapping edits — conflict markers left in the file |
| `skipped` | No template change, or only local edits |
| `added` / `removed` | New template paths / retired paths (retired files kept) |

`--dry-run` reports without writing. Dirty git requires `--force`. Applied
upgrades write `.jumentix/upgrade-<version>.md`.

## `doctor`

`jumentix doctor` prints environment and project diagnostics:

| Area | Checks |
| --- | --- |
| environment | bun version (required), node ≥20 when present, docker availability |
| project | `.jumentix/project.json` + mode, template version vs packaged `templates.manifest.json`, expected `apps/*`, manifest drift |

Exit `0` when healthy, `1` for project blockers, `2` for environment blockers.

## Generation e2e matrix

`packages/cli-init/test/e2e/run-generation-matrix.ts` exercises factory cells
(monolith/express/sqlite, monolith/fastify/postgres, services, hybrid,
frontend-only, `--offline`). Default `bun test` always runs the non-Docker
`monolith/express/sqlite` cell. Heavy Docker cells run only when
`CLI_INIT_E2E_DOCKER=1` and Docker is available; otherwise they skip with a
named reason. Optional `CLI_INIT_E2E_INSTALL=1` runs `bun install` after
generation.

```bash
bun run --cwd packages/cli-init test
CLI_INIT_E2E_DOCKER=1 bun run --cwd packages/cli-init test ./test/e2e
```

## Local development

```bash
bun run --cwd packages/cli-init test
bun run --cwd packages/cli-init lint
bun run --cwd packages/cli-init typecheck
node packages/cli-init/bin/jumentix.js --help
```

## Related docs

- Package README: `packages/cli-init/README.md` (+ pt-BR)
- Factory modes: [JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md)
- Requirement: `.agents/requirements/software/037-bootstrap-cli-scaffolding.md`
- Public on-ramp: website Getting started (`apps/jumentix-website/content/jumentix/concepts/getting-started.mdx`)
