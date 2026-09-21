<!--
Arquivo gerado automaticamente a partir de: packages/cli-init/README.md
Idioma alvo: Português (Brasil)
-->
# @jumentix/cli-init

CLI geradora de fábrica do Jumentix (Requisito `037` v2).

## Política de versão

- A versão do pacote da CLI acompanha o cohort de templates da fábrica que ela gera.
- Projetos gerados fixam versões publicadas de `@jumentix/*` (não `workspace:*`).
- Pacotes de biblioteca continuam usando `bumpPackage` / conventional commits do repositório para semver.
- Publique pelo workflow protegido `npm-publish` do GitHub Actions em `main` depois que `bun run npm:packages:check` e `bun run release:dry-run:packages` estiverem verdes. Veja `documentation/md/NPM-PACKAGE-PUBLISHING.pt-BR.md`.

```bash
npx @jumentix/cli-init init
```

## Comandos (alvo)

- `jumentix init` — workspace enxuto por modo de fábrica
- `jumentix add domain|service|frontend`
- `jumentix upgrade` / `jumentix doctor`
- Aliases: `jumentix-init`, `jumentix-bootstrap`

## Templates empacotados

Seeds commitados em `templates/{backend,frontend}/`, reconstruídos a partir de
`apps/backend-template` e `apps/frontend`:

```bash
bun run cli:build-templates
bun run cli:check-template-freshness
```

A verificação de frescor entra em `ci:gate`. Tamanho medido após o empacotamento
(`du -sh packages/cli-init/templates`): **5.0M** (backend ~3.8M, frontend ~1.2M),
com exclusões de `.agents`, `node_modules`, `coverage`, `dist`, `OASdoc`,
`AsyncAPIdoc`, artefatos Cypress, leftovers de `template/`, suites em `test/`
(permanecem em `apps/*`; empacotá-las aqui registraria suites fora do
`test-map` sob o Requisito 135) e `seed/*-large.json`.

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
