<!--
Arquivo gerado automaticamente a partir de: packages/cli-init/README.md
Idioma alvo: Português (Brasil)
-->
# @jumentix/cli-init

CLI geradora de fábrica do Jumentix (Requisito `037` v2).

## Comandos (alvo)

- `jumentix init` — workspace enxuto por modo de fábrica
- `jumentix add domain|service|frontend`
- `jumentix upgrade` / `jumentix doctor`
- Aliases: `jumentix-init`, `jumentix-bootstrap`

## Documentos normativos

- `.agents/requirements/software/037-bootstrap-cli-scaffolding.md`
- `documentation/md/BOOTSTRAP-CLI-SCAFFOLDING.md` (+ pt-BR)

## Entrada atual do pacote

Até as Issues JUM-844…854 do épico chegarem, o pacote ainda expõe o fluxo
legado de clone via `bin/jumentix-init.js`. O contrato acima é normativo.

```bash
bun ./packages/cli-init/bin/jumentix-init.js --help
bun run --cwd packages/cli-init test
```
