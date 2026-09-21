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
`templates/backend/spec/1.0.0.yml` quando empacotado).

## Geração de backend (JUM-847)

Após resolver o plano, `generateBackend()` copia o seed de backend empacotado
para `<dir>/apps/<service>` por serviço:

- Renomeia o pacote para `@<project>/<service>` e fixa deps `@jumentix/*`
- Escreve `.env.dev` a partir de `http` / `realtime` / `db` do plano
- Remove suites de integração HTTP não usadas e compose files de db não
  usados (adapters em `src/` permanecem)
- Mantém Users + auth em todo slice core; injeta outros domínios do designer
  via `buildHexagonalBundle` em `src/modules/<Domain>/…` e registra em
  `src/modules/compositionRoot.ts`
- Grava o OAS filtrado por serviço em `spec/1.0.0.yml`

A montagem do workspace raiz (`.jumentix/project.json`, workspaces Bun) fica
para Issue posterior (C7). E2e de geração em Docker é C12.

```bash
bun ./packages/cli-init/bin/jumentix.js init demo \
  --preset=users --non-interactive --mode=monolith --http=express --db=sqlite
```

## Documentos normativos

- `.agents/requirements/software/037-bootstrap-cli-scaffolding.md`
- `documentation/md/BOOTSTRAP-CLI-SCAFFOLDING.md` (+ pt-BR)

## Entrada atual do pacote

Roteamento de comandos, resolução de fontes e geração de serviços backend
estão ativos. A montagem do workspace raiz chega em Issues posteriores; até
lá `--mode=monolith` sem `--from`/`--preset` ainda cai no clone legado do
monorepo.

```bash
bun ./packages/cli-init/bin/jumentix-init.js --help
bun run --cwd packages/cli-init test
```
