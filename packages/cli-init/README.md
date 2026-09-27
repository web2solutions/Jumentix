# @jumentix/cli-init

The Jumentix CLI. It creates a project from your domain model or an OpenAPI
contract, adds domains, services and a frontend as the product grows, and
merges newer templates into the project without discarding your edits.

```bash
npx @jumentix/cli-init init my-product
cd my-product
bun install
bun run dev
```

Requires [Bun](https://bun.sh) 1.3.13 or newer. Docker is optional and only
used when the project runs a database server or Redis.

## Commands

| Command | What it does |
| --- | --- |
| `jumentix init [dir]` | Create a project (`--mode`, `--from`, `--preset`, `--http`, `--realtime`, `--db`, `--frontend`, `--offline`, `--git`, `--install`, `--config`, `--non-interactive`) |
| `jumentix add domain <name>` | Add a domain to a service and refresh the frontend modules |
| `jumentix add service <name> --domains a,b` | Split domains into a new service |
| `jumentix add frontend` | Add `apps/frontend` to a backend-only project |
| `jumentix upgrade [--dry-run]` | Three-way merge the installed CLI's templates into the project |
| `jumentix doctor` | Check the environment and the project |

The package installs the `jumentix` command (also `cli-init`, so
`npx @jumentix/cli-init` resolves). Every command has `--help`. Exit codes:
`0` success, `1` input or project problem, `2` environment problem.

Full reference, with every option, mode and example:
[CLI reference](https://jumentix-website.vercel.app/docs/jumentix/reference/cli).

## Versions

The CLI's version tracks the template set it generates. Generated projects pin
the published `@jumentix/*` versions that template set was built against, never
`workspace:*`.

## Developing this package

Everything below is for contributors to the Jumentix repository.

### Packaged templates

The seeds under `templates/{backend,frontend}/` are rebuilt from
`apps/backend-template` and `apps/frontend`, and `templates.manifest.json`
records the template commit and the `@jumentix/*` versions generated projects
pin:

```bash
bun run cli:build-templates
bun run cli:check-template-freshness
```

The freshness check runs in `ci:gate`. Packaging excludes `.agents`,
`node_modules`, `coverage`, `dist`, `OASdoc`, `AsyncAPIdoc`, Cypress artifacts,
`template/` leftovers, `test/` suites (the seeds keep their suites in `apps/*`)
and `seed/*-large.json`.

### Generation pipeline

1. **Source resolution** — `--from` / `--preset` normalize a Designer export
   (`loadDesignerExportSource`), an OpenAPI file (`loadOasSource`), a catalog URL
   (`loadCatalogSource`) or the Users preset (`loadPresetSource`,
   `fixtures/users-oas.yml`) into one `GenerationPlan`, validated fail-closed
   before any file is written.
2. **Backend generation** — `generateBackend()` copies the backend seed into
   `apps/<service>`, renames the package, pins `@jumentix/*`, writes `.env.dev`,
   drops unused HTTP suites and compose files, injects designer domains with
   `buildHexagonalBundle` and registers them in `compositionRoot.ts`.
3. **Frontend generation** — `generateFrontend()` copies the frontend seed into
   `apps/frontend`, bakes the merged OAS into `src/contracts/openapi.json`,
   generates one module per domain and writes `.env`; without `--offline` the
   Cana boot and offline Cypress specs are removed.
4. **Workspace assembly** — `assembleWorkspace()` writes the root
   `package.json`, `.gitignore`, `docker-compose.yml`, `README.md`,
   `.jumentix/project.json`, `.jumentix/manifest.json` (sha256 per file) and
   `jumentix.init.json`, then runs the optional `--install` / `--git` steps.

`add`, `upgrade` and `doctor` read `.jumentix/project.json` and
`.jumentix/manifest.json`; `upgrade` keeps baseline blobs under
`.jumentix/objects/<sha256>` for its three-way merge.

### Tests

`test/e2e/run-generation-matrix.ts` drives the generation matrix
(monolith/express/sqlite, monolith/fastify/postgres, services, hybrid,
frontend-only, `--offline`). The default run always exercises the non-Docker
`monolith/express/sqlite` cell; Docker cells run only with
`CLI_INIT_E2E_DOCKER=1` and skip with a named reason otherwise.
`CLI_INIT_E2E_INSTALL=1` adds `bun install` after generation.

```bash
bun run --cwd packages/cli-init test
CLI_INIT_E2E_DOCKER=1 bun run --cwd packages/cli-init test ./test/e2e
bun ./packages/cli-init/bin/jumentix.js --help
```

### Releases

Publishing is automated: a release on `main` publishes the package cohort to
npm (see `documentation/md/NPM-PACKAGE-PUBLISHING.md`). The normative surface
(flags, config, `GenerationPlan`, upgrade policy) is
`documentation/md/BOOTSTRAP-CLI-SCAFFOLDING.md`; factory modes are in
`documentation/md/JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md`.
