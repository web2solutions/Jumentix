# @jumentix/cli-init

Factory generator CLI for Jumentix (Requirement `037` v2).

## Commands (target)

- `jumentix init` — lean workspace per factory mode
- `jumentix add domain|service|frontend`
- `jumentix upgrade` / `jumentix doctor`
- Aliases: `jumentix-init`, `jumentix-bootstrap`

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
