# Governança de provedores de CI

Este documento resume qual provedor de CI executa o quê em
`web2solutions/Jumentix` e como alterar isso. O Requisito `113`
(`.agents/requirements/project/113-private-free-repository-owned-ci.md`), com a
emenda de 2026-09-23, é a fonte normativa; esta página é a orientação legível
para humanos.

## Qual provedor executa o quê

| Provedor | Papel | Superfície |
| --- | --- | --- |
| CircleCI (`.circleci/config.yml`) | **Orquestrador canônico** da matriz completa | Jobs `branch-gate`, `third-party-review`, `browser-matrix`, `workspace-builds`, `workspace-tests`, `integration`, `coverage` (inclui upload ao Codecov via CLI verificado por checksum, scan do SonarQube Cloud e `bun run sonar:check-reliability`), `website`, `database-matrix`; gatilho agendado noturno em `main`/`dev` |
| GitHub Actions (`.github/workflows/ci.yml`, `browser-matrix.yml`, `sonar-reliability.yml`) | **Retido, desabilitado por padrão** — fallback reversível | Os 8 jobs da matriz em `ci.yml` mais os dois workflows extras estão atrás de `if: vars.JUMENTIX_ENABLE_GITHUB_ACTIONS_CI == 'true'`; nenhum arquivo foi deletado |
| GitHub Actions (exceções sempre ativas) | Superfícies exclusivas do GitHub que não podem migrar | `pr-feedback.yml`, os jobs `sync-changelog` e `pr-feedback` dentro de `ci.yml`, e `npm-publish.yml` — veja abaixo |
| Codecov / SonarQube Cloud | Dashboards públicos de cobertura e qualidade | Alimentados pelo job `coverage` do CircleCI; rodam sem interrupção e continuam sendo dashboards, nunca autoridade de threshold |

## Como reabilitar o GitHub Actions

Defina a variável de Actions do repositório `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI`
como `true` (configurações do repositório: **Settings → Secrets and variables →
Actions → Variables**). Um único flag, totalmente reversível: remover a
variável ou definir qualquer outro valor desabilita a matriz novamente. O
pipeline do CircleCI não é afetado e continua canônico nos dois cenários.

## Exceções do GitHub Actions sempre ativas

Três superfícies permanecem habilitadas independentemente do flag porque não
têm equivalente no CircleCI:

1. `.github/workflows/pr-feedback.yml` — usa execução de forks confiáveis via
   `pull_request_target`, um modelo de segurança exclusivo do GitHub que o
   CircleCI não consegue replicar.
2. Os jobs `sync-changelog` e `pr-feedback` dentro de
   `.github/workflows/ci.yml` — automação barata e orientada a eventos, sem job
   do CircleCI para recebê-los.
3. `.github/workflows/npm-publish.yml` — publica através do GitHub Environment
   protegido exigido pelo requisito `070`.

## Checks obrigatórios da proteção de branch

- `dev` exige `ci/circleci: branch-gate`, `ci/circleci: third-party-review`,
  `ci/circleci: browser-matrix`, mais os checks `pr-feedback` do GitHub sempre
  ativos.
- `main` exige adicionalmente `ci/circleci: workspace-builds`,
  `ci/circleci: workspace-tests`, `ci/circleci: integration`,
  `ci/circleci: coverage`, `ci/circleci: website` e
  `ci/circleci: database-matrix`.
- O check independente `sonar-reliability` é absorvido pelo job `coverage` do
  CircleCI (`bun run sonar:check-reliability` roda dentro dele).

Codecov e SonarQube Cloud continuam rodando sem interrupção através do job
`coverage` do CircleCI. Checks obrigatórios falham fechado: resultado pulado,
pendente, ausente, expirado, cancelado ou inacessível no provedor nunca é
verde.
