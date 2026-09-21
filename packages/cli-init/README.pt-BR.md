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

## Resolução de fontes (JUM-846)

`init --from` / `--preset` normalizam cada fonte aceita em um
**GenerationPlan** antes de escrever arquivos:

| Fonte | Flag | Loader |
| --- | --- | --- |
| Export JSON do designer | `--from=export.json` | `loadDesignerExportSource` |
| OpenAPI 3.x YAML/JSON | `--from=spec.yml` | `loadOasSource` |
| URL de catálogo | `--from=https://…` | `loadCatalogSource` |
| Preset Users | `--preset=users` (padrão sem `--from`) | `loadPresetSource` |

O modo é inferido da arquitetura (um serviço → `monolith`) salvo `--mode`.
Validação falha fechada com mensagens nomeadas (exit 1): sem serviço core;
entidade sem chave primária; relação cruzando fronteira de serviço em
monolith; interface http/realtime não suportada; nomes de entidade
duplicados entre domínios.

O OAS do preset Users vive em `fixtures/users-oas.yml` (ou
`templates/backend/spec/1.0.0.yml` quando empacotado). A escrita de
`.jumentix/project.json` fica para Issue posterior; `resolveSources()` já é
exportado.

```bash
bun ./packages/cli-init/bin/jumentix.js init --preset=users --non-interactive --mode=services --project-name=demo
```

## Documentos normativos

- `.agents/requirements/software/037-bootstrap-cli-scaffolding.md`
- `documentation/md/BOOTSTRAP-CLI-SCAFFOLDING.md` (+ pt-BR)

## Entrada atual do pacote

Roteamento de comandos e resolução de fontes estão ativos. A geração de
arquivos do workspace chega em Issues posteriores; até lá `--mode=monolith`
sem `--from`/`--preset` ainda cai no clone legado do monorepo.

```bash
bun ./packages/cli-init/bin/jumentix-init.js --help
bun run --cwd packages/cli-init test
```
