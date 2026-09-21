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

## Commands (target)

- `jumentix init` — lean workspace per factory mode
- `jumentix add domain|service|frontend`
- `jumentix upgrade` / `jumentix doctor`
- Aliases: `jumentix-init`, `jumentix-bootstrap`

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

Root workspace assembly (`.jumentix/project.json`, Bun workspaces) is owned by
a later Issue (C7). Generation e2e in Docker is C12.

```bash
bun ./packages/cli-init/bin/jumentix.js init demo \
  --preset=users --non-interactive --mode=monolith --http=express --db=sqlite
```

## Normative docs

- `.agents/requirements/software/037-bootstrap-cli-scaffolding.md`
- `documentation/md/BOOTSTRAP-CLI-SCAFFOLDING.md` (+ pt-BR)

## Current package entrypoint

Factory command routing, source resolution, and backend service generation are
live. Root workspace assembly lands in later epic Issues; until then
`--mode=monolith` without `--from`/`--preset` still falls back to the legacy
monorepo clone.

```bash
bun ./packages/cli-init/bin/jumentix-init.js --help
bun run --cwd packages/cli-init test
```
