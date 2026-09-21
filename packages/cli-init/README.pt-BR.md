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

## Geração de frontend (JUM-848)

Para modos `hybrid` / `frontend` (ou `--frontend`), `generateFrontend()` copia
o seed de frontend empacotado para `<dir>/apps/frontend`:

- Renomeia o pacote para `@<project>/frontend` e fixa deps `@jumentix/*`
- Grava o OAS mesclado em `src/contracts/openapi.json` (mantém o contrato do
  seed quando o OAS do plano não tem paths)
- Gera um módulo por domínio: configs X-CRUD (operations a partir dos
  operation ids do OAS, `searchFields` de `x-list-capabilities`), views,
  dashboard, títulos de nav/i18n e redirect inicial do router
- Escreve `.env` com URLs do Core/serviços (`VITE_API_BASE_URL`, proxies)
- `--offline` mantém a camada Cana; sem a flag, desativa o boot Cana e remove
  specs Cypress offline

## Montagem do workspace (JUM-849)

Após a geração de backend/frontend, `assembleWorkspace()` escreve a raiz Bun:

- `package.json` raiz com workspaces `apps/*` e scripts `dev|test|lint|build`
- `.gitignore`, `docker-compose.yml` (db escolhido + Redis quando realtime ≠ none)
- `README.md` gerado (como rodar, portas, contas seed)
- `.jumentix/project.json` (versão da CLI, commit do template, mode, plano, timestamps)
- `.jumentix/manifest.json` (sha256 por arquivo gerado)
- `jumentix.init.json` (respostas para round-trip com `--config`)
- `--install` → `bun install` (cria `bun.lock`); `--git` → `git init` + primeiro commit
- `.jumentix/service-profile.json` é removido se presente (aposentado)

```bash
bun ./packages/cli-init/bin/jumentix.js init demo \
  --preset=users --non-interactive --mode=hybrid --frontend --offline \
  --http=express --db=sqlite --install --git
```

## Comandos add (JUM-850)

Execute dentro de um projeto gerado (exige `.jumentix/project.json`):

| Comando | Efeito |
| --- | --- |
| `jumentix add domain <name> [--from …] [--service <id>]` | Injeta domínio hexagonal no Core (ou `--service`) e atualiza módulos do frontend se existir |
| `jumentix add service <name> --domains a,b` | Cria `apps/<name>` em modo services/hybrid e move a posse dos domínios |
| `jumentix add frontend [--offline]` | Adiciona `apps/frontend` a um projeto só-backend (mode → `hybrid`) |

Drift do manifesto é recusado sem `--force`. Metadados ausentes saem com código `1`.

## Upgrade (JUM-851)

`jumentix upgrade [--dry-run] [--force]` faz merge de três vias da coorte de
templates atual sobre o projeto gerado, usando hashes de
`.jumentix/manifest.json` e blobs de baseline em `.jumentix/objects/<sha256>`:

| Status | Significado |
| --- | --- |
| updated | Sem edição local → template, ou auto-merge limpo |
| conflicted | Edições sobrepostas — marcadores de conflito no arquivo |
| skipped | Sem mudança de template, ou só edições locais |
| added / removed | Novos caminhos / aposentados (arquivos aposentados permanecem) |

`--dry-run` imprime o relatório sem gravar. Árvore git suja exige `--force`.
Ao aplicar, grava `.jumentix/upgrade-<version>.md`.

## Doctor (JUM-852)

`jumentix doctor` reporta saúde do ambiente e do projeto:

| Área | Verificações |
| --- | --- |
| environment | versão do bun (obrigatório), node ≥20 se presente, docker |
| project | `.jumentix/project.json` + mode, versão do template vs CLI, diretórios `apps/*` esperados, drift do manifesto |

Saída `0` quando saudável, `1` para blockers de projeto, `2` para blockers de
ambiente (por exemplo bun ausente).

## Matriz e2e de geração (JUM-854)

`test/e2e/run-generation-matrix.ts` executa a matriz de geração da fábrica
(monolith/express/sqlite, monolith/fastify/postgres, services, hybrid,
frontend-only, `--offline`). O `bun test` padrão sempre exercita a célula
sem Docker `monolith/express/sqlite` (gera em tmp e verifica `apps/*`).
Células Docker pesadas só rodam com `CLI_INIT_E2E_DOCKER=1` e Docker
disponível; caso contrário fazem skip com motivo nomeado. Opcional:
`CLI_INIT_E2E_INSTALL=1` para `bun install` após a geração. Cada célula
registra o tempo; falhas nomeiam o comando que falhou.

```bash
bun run --cwd packages/cli-init test
CLI_INIT_E2E_DOCKER=1 bun run --cwd packages/cli-init test ./test/e2e
```

## Documentos normativos

- `.agents/requirements/software/037-bootstrap-cli-scaffolding.md`
- `documentation/md/BOOTSTRAP-CLI-SCAFFOLDING.md` (+ pt-BR)

## Entrada atual do pacote

Roteamento de comandos, resolução de fontes, geração de backend/frontend,
montagem do workspace raiz, `add domain|service|frontend`, `upgrade` (merge
de três vias), `doctor` e a matriz e2e de geração (JUM-854) estão ativos.
`--mode=monolith` sem `--from`/`--preset` ainda cai no clone legado do monorepo.

```bash
bun ./packages/cli-init/bin/jumentix-init.js --help
bun run --cwd packages/cli-init test
```
