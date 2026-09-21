# @jumentix/cli-init

Factory generator CLI for Jumentix (Requirement `037` v2).

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

## Normative docs

- `.agents/requirements/software/037-bootstrap-cli-scaffolding.md`
- `documentation/md/BOOTSTRAP-CLI-SCAFFOLDING.md` (+ pt-BR)

## Current package entrypoint

Until epic Issues JUM-844…854 land, the package still exposes the legacy clone
flow via `bin/jumentix-init.js`. The contract above is normative.

```bash
bun ./packages/cli-init/bin/jumentix-init.js --help
bun run --cwd packages/cli-init test
```
