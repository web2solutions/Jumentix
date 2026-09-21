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

## Comandos

| Comando | Propósito |
| --- | --- |
| `jumentix init` | Cria um workspace (`monolith` / `services` / `hybrid` / `frontend`) |
| `jumentix add domain\|service\|frontend` | Estende um projeto já gerado |
| `jumentix upgrade` | Merge de três vias do template (`--dry-run` suportado) |
| `jumentix doctor` | Diagnóstico de ambiente e de projeto |

Os aliases `jumentix-init` e `jumentix-bootstrap` permanecem; invocações legadas
com `--service-type` mapeiam para `init --mode monolith` com aviso de
descontinuação.

## Fontes

- Export JSON do designer, arquivo OAS 3.1 ou URL de catálogo via `--from`
- Preset Users via `--preset users` quando `--from` é omitido
- Respostas reproduzíveis via `--config jumentix.init.json`
- `--non-interactive` exige todas as respostas por flags/config

## Templates e frescor

Os templates ficam commitados em
`packages/cli-init/templates/{backend,frontend}/` e são reconstruídos com
`packages/cli-init/scripts/build-templates.js`.

Gate de frescor (falha fechada quando os templates divergem das seeds):

```bash
bun run cli:check-template-freshness
```

Script: `packages/cli-init/scripts/check-template-freshness.js` (ligado ao
`ci:gate`).

## Contrato do projeto gerado

Todo workspace gerado inclui:

- `.jumentix/project.json` — plano consumido por `add` / `upgrade` / `doctor`
- `.jumentix/manifest.json` — sha256 dos arquivos gerados (merge de upgrade)
- `jumentix.init.json` — respostas para round-trips com `--config`

`.jumentix/service-profile.json` é aposentado.

A geração de backend (JUM-847) escreve slices enxutos em `apps/<service>` a
partir do seed empacotado: pacote renomeado `@<project>/<service>`, `.env.dev`
a partir das interfaces/db do plano, suites de integração / compose files de
db não usados removidos, Users + auth mantidos no core, e domínios do designer
injetados via `buildHexagonalBundle` em `src/modules/<Domain>/…` com registro
em `compositionRoot.ts`.

A geração de frontend (JUM-848) escreve `apps/frontend` nos modos
hybrid/frontend: cópia do seed empacotado, OAS mesclado em
`src/contracts/openapi.json`, um módulo por domínio (configs a partir dos
operation ids e `x-list-capabilities`), `.env` com URLs do Core/serviços, e
camada Cana opcional via `--offline`.

A montagem do workspace (JUM-849) escreve a raiz Bun após a geração:
`package.json` com workspaces `apps/*` e scripts `dev|test|lint|build`,
`.gitignore`, `docker-compose.yml` para o db escolhido (+ Redis com realtime),
`README.md` gerado (execução, portas, contas seed), `.jumentix/project.json`,
`.jumentix/manifest.json` (sha256 por arquivo) e `jumentix.init.json`.
`--install` roda `bun install`; `--git` faz `git init` e o primeiro commit.

O comando `jumentix add` (JUM-850) estende um projeto já gerado: `add domain`
injeta um módulo hexagonal no Core (ou serviço alvo) e atualiza o frontend se
existir; `add service --domains …` cria um novo app em modo services/hybrid;
`add frontend` transforma um tree só-backend em hybrid. Sem
`.jumentix/project.json` a saída é `1`; drift do manifesto exige `--force`.

O comando `jumentix upgrade` (JUM-851) faz merge de três vias da coorte de
templates usando hashes de `.jumentix/manifest.json` e baselines em
`.jumentix/objects/<sha256>`. Arquivos intactos são substituídos; edições
sobrepostas geram marcadores de conflito; `--dry-run` só reporta; git sujo
exige `--force`.

Projetos gerados devem passar no próprio `lint` / `test` / `build` e subir em
Docker. Dependências de runtime são pacotes `@jumentix/*` publicados, fixados na
versão da CLI.

## Desenvolvimento local

```bash
bun run --cwd packages/cli-init test
node packages/cli-init/bin/jumentix.js --help
```

Até os comandos de fábrica estarem completamente entregues (Issues do épico
JUM-844…854), o pacote ainda pode expor o caminho legado de clone; o contrato
normativo é este documento e o Requisito `037` v2.
