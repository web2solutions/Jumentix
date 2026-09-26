<!--
Arquivo gerado automaticamente a partir de: documentation/md/BOOTSTRAP-CLI-SCAFFOLDING.md
Idioma alvo: Português (Brasil)
-->
# CLI geradora de fábrica (`@jumentix/cli-init`)

O requisito `037` (v2) define `@jumentix/cli-init` como a **geradora de fábrica**:
ela produz um workspace Bun enxuto para um modo de fábrica, em vez de clonar o
monorepo inteiro.

Propriedade do espaço de trabalho:

- `packages/cli-init` possui a implementação da CLI, os templates empacotados e
  o gate de frescor.
- O `bin/jumentix-bootstrap.js` da raiz delega ao pacote por compatibilidade.

Instalar e invocar:

```bash
npx @jumentix/cli-init init
# ou a partir de um checkout:
bun ./packages/cli-init/bin/jumentix.js --help
```

Os aliases `jumentix-init` e `jumentix-bootstrap` permanecem. Invocações legadas
com `--service-type` mapeiam para `init --mode monolith` com aviso de
descontinuação.

Cruze este documento com `jumentix --help` e `jumentix <command> --help`.
Códigos de saída: `0` ok, `1` erro de usuário/projeto, `2` falha de ambiente
(doctor também usa `1`/`2` conforme abaixo).

## Comandos

| Comando | Propósito |
| --- | --- |
| `jumentix init [dir]` | Cria um workspace enxuto |
| `jumentix add domain\|service\|frontend` | Estende um projeto já gerado |
| `jumentix upgrade` | Merge de três vias do template (`--dry-run` suportado) |
| `jumentix doctor` | Diagnóstico de ambiente e de projeto |
| `jumentix help` | Mostra o uso de nível superior |

### Flags de `init`

| Flag | Valores / notas |
| --- | --- |
| `--mode` | `monolith` \| `services` \| `hybrid` \| `frontend` |
| `--from` | Export JSON do designer, OAS 3.x YAML/JSON ou URL de catálogo |
| `--preset` | `users` (padrão quando `--from` é omitido) |
| `--http` | `express` \| `fastify` \| `restify` |
| `--realtime` | `none` \| `websocket` \| `grpc` |
| `--db` | `sqlite` \| `postgres` \| `mysql` \| `mongo` \| `inmemory` |
| `--frontend` | Inclui `apps/frontend` (caminho hybrid) |
| `--offline` | Mantém a camada Cana offline no frontend |
| `--git` | `git init` + primeiro commit após a montagem |
| `--install` | Roda `bun install` após a montagem |
| `--config` | Caminho para respostas em `jumentix.init.json` |
| `--non-interactive` | Exige todas as respostas por flags/config (sem prompts) |

Exemplo (preset Users, hybrid, offline):

```bash
bun ./packages/cli-init/bin/jumentix.js init demo \
  --preset=users --non-interactive --mode=hybrid --frontend --offline \
  --http=express --db=sqlite --install --git
```

### Modos (mapa para a matriz da fábrica)

| `--mode` | Linha da matriz da fábrica | Layout |
| --- | --- | --- |
| `monolith` | Monólito Modular (Backend) | Um serviço Core; todos os domínios in-process |
| `services` | Grupo de back-end multisserviço | Core (Users + auth) + serviços de domínio |
| `hybrid` | Back-end híbrido + front-end | Apps de backend + `apps/frontend` |
| `frontend` | SPA/PWA offline somente front-end | `apps/frontend` consumindo contratos |

O modo é inferido da arquitetura (um serviço → `monolith`) salvo `--mode`.
Veja
[JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.pt-BR.md](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.pt-BR.md).

### Arquivo de config (`jumentix.init.json`)

`--config` / arquivo gerado para round-trip é um objeto JSON com chaves opcionais:

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

`--non-interactive` falha fechada quando falta uma resposta obrigatória nas
flags ou neste arquivo.

## Fontes do GenerationPlan

`init --from` / `--preset` normalizam cada fonte aceita em um
**GenerationPlan** antes de escrever arquivos:

| Fonte | Flag | Loader |
| --- | --- | --- |
| Export JSON do designer | `--from=export.json` | `loadDesignerExportSource` |
| OpenAPI 3.x YAML/JSON | `--from=spec.yml` | `loadOasSource` |
| URL de catálogo | `--from=https://…` | `loadCatalogSource` |
| Preset Users | `--preset=users` | `loadPresetSource` |

Validação falha fechada com mensagens nomeadas (exit `1`): sem serviço core;
entidade sem chave primária; relação cruzando fronteira de serviço em
monolith; interface http/realtime não suportada; nomes de entidade
duplicados entre domínios.

O OAS do preset Users vive em `fixtures/users-oas.yml` (ou
`templates/backend/spec/1.0.0.yml` quando empacotado).

## Templates e frescor

Os templates ficam commitados em
`packages/cli-init/templates/{backend,frontend}/` e são reconstruídos com
`packages/cli-init/scripts/build-templates.js` a partir de
`apps/backend-template` e `apps/frontend`.

```bash
bun run cli:build-templates
bun run cli:check-template-freshness
```

O gate de frescor falha fechado quando os templates empacotados divergem das
seeds. Script: `packages/cli-init/scripts/check-template-freshness.js` (ligado
ao `ci:gate`).

## Pipeline de montagem do workspace

1. **Resolução de fontes** — monta o `GenerationPlan` a partir de `--from` /
   `--preset`.
2. **Geração de backend** — slices enxutos em `apps/<service>` a partir do seed
   empacotado: pacote renomeado `@<project>/<service>`, `.env.dev` a partir das
   interfaces/db do plano, suites de integração / compose files de db não
   usados removidos, Users + auth mantidos no core, domínios do designer
   injetados via `buildHexagonalBundle` em `src/modules/<Domain>/…` com
   registro em `compositionRoot.ts`.
3. **Geração de frontend** (hybrid/frontend ou `--frontend`) — `apps/frontend`
   com OAS mesclado em `src/contracts/openapi.json`, um módulo por domínio,
   `.env` com URLs do Core/serviços, Cana opcional via `--offline`.
4. **Montagem do workspace** — raiz Bun: `package.json` com workspaces `apps/*`
   e scripts `dev|test|lint|build`, `.gitignore`, `docker-compose.yml` para o
   db escolhido (+ Redis com realtime), `README.md` gerado,
   `.jumentix/project.json`, `.jumentix/manifest.json`, `jumentix.init.json`.
   Opcionais: `--install` / `--git`.

## Contrato do projeto gerado

Todo workspace gerado inclui:

| Artefato | Papel |
| --- | --- |
| `.jumentix/project.json` | Plano + mode + cohort de template; consumido por `add` / `upgrade` / `doctor` |
| `.jumentix/manifest.json` | sha256 dos arquivos gerados (merge de upgrade) |
| `.jumentix/objects/<sha256>` | Blobs de baseline para merge de três vias |
| `jumentix.init.json` | Respostas para round-trips com `--config` |

`.jumentix/service-profile.json` é aposentado e removido quando presente.

Dependências de runtime são pacotes `@jumentix/*` publicados, cada um fixado
na própria versão registrada em `packages/cli-init/templates.manifest.json`
(`packageVersions`, reconstruído por `bun run cli:build-templates`) — nunca
`workspace:*` e nunca uma versão única da CLI, porque os pacotes versionam de
forma independente. Projetos gerados devem passar no próprio
`lint` / `test` / `build` e subir em Docker.

## `add` (estender)

Execute dentro de um projeto gerado (exige `.jumentix/project.json`):

| Comando | Efeito |
| --- | --- |
| `jumentix add domain <name> [--from …] [--service <id>]` | Injeta domínio hexagonal no Core (ou `--service`); atualiza módulos do frontend se existir |
| `jumentix add service <name> --domains a,b` | Cria `apps/<name>` em modo services/hybrid; move a posse dos domínios |
| `jumentix add frontend [--offline]` | Adiciona `apps/frontend` a um tree só-backend (mode → `hybrid`) |

Drift do manifesto é recusado sem `--force`. Metadados ausentes saem com código `1`.

## Política de `upgrade`

`jumentix upgrade [--dry-run] [--force]` faz merge de três vias da coorte de
templates usando hashes de `.jumentix/manifest.json` e baselines em
`.jumentix/objects/<sha256>`:

| Status | Significado |
| --- | --- |
| `updated` | Sem edição local → template, ou auto-merge limpo |
| `conflicted` | Edições sobrepostas — marcadores de conflito no arquivo |
| `skipped` | Sem mudança de template, ou só edições locais |
| `added` / `removed` | Novos caminhos / aposentados (arquivos aposentados permanecem) |

`--dry-run` só reporta. Git sujo exige `--force`. Upgrades aplicados gravam
`.jumentix/upgrade-<version>.md`.

## `doctor`

`jumentix doctor` imprime diagnósticos de ambiente e do projeto:

| Área | Verificações |
| --- | --- |
| environment | versão do bun (obrigatório), node ≥20 se presente, docker |
| project | `.jumentix/project.json` + mode, versão do template vs `templates.manifest.json`, `apps/*` esperados, drift do manifesto |

Saída `0` quando saudável, `1` para blockers de projeto, `2` para blockers de
ambiente.

## Matriz e2e de geração

`packages/cli-init/test/e2e/run-generation-matrix.ts` exercita células da
fábrica (monolith/express/sqlite, monolith/fastify/postgres, services, hybrid,
frontend-only, `--offline`). O `bun test` padrão sempre roda a célula sem
Docker `monolith/express/sqlite`. Células Docker pesadas só rodam com
`CLI_INIT_E2E_DOCKER=1` e Docker disponível; caso contrário fazem skip com
motivo nomeado. Opcional: `CLI_INIT_E2E_INSTALL=1` para `bun install` após a
geração.

```bash
bun run --cwd packages/cli-init test
CLI_INIT_E2E_DOCKER=1 bun run --cwd packages/cli-init test ./test/e2e
```

## Desenvolvimento local

```bash
bun run --cwd packages/cli-init test
bun run --cwd packages/cli-init lint
bun run --cwd packages/cli-init typecheck
node packages/cli-init/bin/jumentix.js --help
```

## Docs relacionados

- README do pacote: `packages/cli-init/README.md` (+ pt-BR)
- Modos da fábrica: [JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.pt-BR.md](./JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.pt-BR.md)
- Requisito: `.agents/requirements/software/037-bootstrap-cli-scaffolding.md`
- Rampa pública: Getting started do site (`apps/jumentix-website/content/pt-BR/jumentix/concepts/getting-started.mdx`)
