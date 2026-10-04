<!--
Arquivo gerado automaticamente a partir de: packages/cli-init/README.md
Idioma alvo: Português (Brasil)
-->

# @jumentix/cli-init

O CLI do Jumentix. Ele cria um projeto a partir do seu modelo de domínio ou de
um contrato OpenAPI, adiciona domínios, serviços e um frontend conforme o
produto cresce, e mescla templates mais novos no projeto sem descartar suas
edições.

```bash
npx @jumentix/cli-init init my-product
cd my-product
bun install
bun run dev
```

Requer [Bun](https://bun.sh) 1.3.13 ou mais novo. O Docker é opcional e só é
usado quando o projeto roda um servidor de banco de dados ou Redis.

## Comandos

| Comando                                     | O que faz                                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `jumentix init [dir]`                       | Cria um projeto (`--mode`, `--from`, `--preset`, `--http`, `--realtime`, `--db`, `--frontend`, `--offline`, `--git`, `--install`, `--config`, `--non-interactive`) |
| `jumentix add domain <name>`                | Adiciona um domínio a um serviço e atualiza os módulos do frontend                                                                                                 |
| `jumentix add service <name> --domains a,b` | Separa domínios em um serviço novo                                                                                                                                 |
| `jumentix add frontend`                     | Adiciona `apps/frontend` a um projeto só com backend                                                                                                               |
| `jumentix upgrade [--dry-run]`              | Mescla em três vias os templates do CLI instalado no projeto                                                                                                       |
| `jumentix doctor`                           | Verifica o ambiente e o projeto                                                                                                                                    |

O pacote instala o comando `jumentix` (também `cli-init`, para que
`npx @jumentix/cli-init` resolva). Todo comando tem `--help`. Códigos de saída:
`0` sucesso, `1` problema na entrada ou no projeto, `2` problema no ambiente.

Referência completa, com todas as opções, modos e exemplos:
[Referência do CLI](https://jumentix-website.vercel.app/docs/pt-BR/jumentix/reference/cli).

## Versões

A versão do CLI acompanha o conjunto de templates que ele gera. Projetos
gerados fixam as versões publicadas de `@jumentix/*` com que esse conjunto foi
construído, nunca `workspace:*`.

## Desenvolvendo este pacote

Tudo abaixo é para quem contribui com o repositório Jumentix.

### Templates empacotados

As sementes em `templates/{backend,frontend}/` são reconstruídas a partir de
`apps/backend-template` e `apps/frontend`, e `templates.manifest.json`
registra o commit dos templates e as versões de `@jumentix/*` que os projetos
gerados fixam:

```bash
bun run cli:build-templates
bun run cli:check-template-freshness
```

A checagem de atualização roda no `ci:gate`. O empacotamento exclui `.agents`,
`node_modules`, `coverage`, `dist`, `OASdoc`, `AsyncAPIdoc`, artefatos do
Cypress, sobras de `template/`, suítes `test/` (as sementes mantêm suas suítes
em `apps/*`) e `seed/*-large.json`.

### Pipeline de geração

1. **Resolução da fonte** — `--from` / `--preset` normalizam um export do
   Designer (`loadDesignerExportSource`), um arquivo OpenAPI (`loadOasSource`),
   uma URL de catálogo (`loadCatalogSource`) ou o preset Users
   (`loadPresetSource`, `fixtures/users-oas.yml`) em um único `GenerationPlan`,
   validado de forma fail-closed antes de qualquer arquivo ser escrito.
2. **Geração do backend** — `generateBackend()` copia a semente do backend para
   `apps/<service>`, renomeia o pacote, fixa `@jumentix/*`, escreve `.env.dev`,
   remove suítes HTTP e arquivos compose não usados, injeta os domínios do
   designer com `buildHexagonalBundle` e os registra em `compositionRoot.ts`.
3. **Geração do frontend** — `generateFrontend()` copia a semente do frontend
   para `apps/frontend`, grava a OAS mesclada em `src/contracts/openapi.json`,
   gera um módulo por domínio e escreve `.env`; sem `--offline`, o boot do Cana
   e as specs Cypress offline são removidos.
4. **Montagem do workspace** — `assembleWorkspace()` escreve o `package.json`
   raiz, `.gitignore`, `docker-compose.yml`, `README.md`,
   `.jumentix/project.json`, `.jumentix/manifest.json` (sha256 por arquivo) e
   `jumentix.init.json`, e executa os passos opcionais `--install` / `--git`.

`add`, `upgrade` e `doctor` leem `.jumentix/project.json` e
`.jumentix/manifest.json`; `upgrade` guarda blobs de base em
`.jumentix/objects/<sha256>` para a mesclagem em três vias.

### Testes

`test/e2e/run-generation-matrix.ts` executa a matriz de geração
(monolith/express/sqlite, monolith/fastify/postgres, services, hybrid,
frontend-only, `--offline`). A execução padrão sempre cobre a célula sem Docker
`monolith/express/sqlite`; células com Docker só rodam com
`CLI_INIT_E2E_DOCKER=1` e, caso contrário, são puladas com um motivo nomeado.
`CLI_INIT_E2E_INSTALL=1` adiciona `bun install` depois da geração.

```bash
bun run --cwd packages/cli-init test
CLI_INIT_E2E_DOCKER=1 bun run --cwd packages/cli-init test ./test/e2e
bun ./packages/cli-init/bin/jumentix.js --help
```

### Releases

A publicação é automatizada: um release em `main` publica o conjunto de
pacotes no npm (veja `documentation/md/NPM-PACKAGE-PUBLISHING.pt-BR.md`). A
superfície normativa (flags, config, `GenerationPlan`, política de upgrade) é
`documentation/md/BOOTSTRAP-CLI-SCAFFOLDING.pt-BR.md`; os modos da fábrica
estão em `documentation/md/JUMENTIX-SERVICE-FACTORY-CAPABILITIES-MATRIX.md`.
