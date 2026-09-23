# Estratégia gratuita de CI para open source público

## Decisão

`web2solutions/Jumentix` é o repositório público canônico. CircleCI é o
orquestrador canônico de CI para a matriz completa, GitHub Actions está retido
como fallback desabilitado por padrão atrás da variável de Actions do
repositório `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI` (três exceções sempre ativas
permanecem: `pr-feedback.yml`, os jobs `sync-changelog`/`pr-feedback` em
`ci.yml`, e `npm-publish.yml`), e ambos os provedores usam caminhos gratuitos
para open source. Codecov e
SonarQube Cloud permanecem ativos porque o repositório é público; eles são
publicados pelo gate completo de cobertura no CircleCI e não substituem os
thresholds controlados pelo repositório.

Checks obrigatórios falham fechado. Resultado pulado, neutro, ausente,
expirado, cancelado ou pendente não é verde.

## Mapa de provedores

| Provedor | Papel | Evidência obrigatória |
| --- | --- | --- |
| CircleCI | Gate canônico por branch para a matriz completa | `branch-gate`, jobs da matriz completa, evidência JSON/LCOV/SARIF |
| GitHub Actions | Fallback retido, desabilitado por padrão atrás de `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI`; exceções sempre ativas: `pr-feedback.yml`, jobs `sync-changelog`/`pr-feedback`, `npm-publish.yml` | Mesmo classificador de contexto, mesmos nomes de jobs quando o flag é `true`, artefatos retidos |
| Codecov | Mapa público de cobertura arquivo a arquivo | Upload LCOV pelo job completo `coverage` |
| SonarQube Cloud | Dashboard público de qualidade, confiabilidade, segurança e cobertura | Scanner após a cobertura do repositório passar |
| OSV.dev, Gitleaks, Semgrep | Checks de segurança controlados pelo repositório | Resultados terminais de dependência/segurança e artefatos SARIF |

## Plano de gates de pull request

PRs de tarefa miram `dev`; somente promoção de release de `dev` mira `main`.

| Gate | PR de tarefa para `dev` | push em `dev` | promoção `dev -> main` |
| --- | --- | --- | --- |
| Build/teste por branch | obrigatório, testes afetados por camada | unitário health obrigatório | matriz estrita obrigatória |
| Review third-party | obrigatório | não obrigatório | obrigatório |
| Cobertura do repositório | adiada | adiada | obrigatória |
| Upload Codecov | adiado | adiado | obrigatório |
| Scan Sonar | adiado | adiado | obrigatório |
| Qualidade website | somente quando selecionada pelo `test-map.json` | adiada | obrigatória |
| Matriz de banco | adiada | adiada | obrigatória |

PRs de tarefa para `dev` têm alvo operacional de dez minutos ou menos. No
CircleCI, o job `branch-gate` classifica o contexto, lê `test-map.json` e
executa apenas suites afetadas/relacionadas, mais checks leves de governança e
segurança; os jobs `browser-matrix` e `third-party-review` rodam em paralelo. A
matriz completa roda em promoções `dev -> main`, pushes em `main` e no gatilho
agendado noturno do CircleCI ou em execuções completas manuais.

## Contrato de cobertura

- Statements, linhas e funções: 99%.
- Branches: 90%.
- Linhas alteradas: 99%.
- O CircleCI retém evidência JSON/LCOV e envia LCOV ao Codecov
  quando o job completo `coverage` roda; o fallback do GitHub Actions faz o
  mesmo quando `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI` é `true`.
- SonarQube Cloud lê os mesmos caminhos LCOV declarados em
  `sonar-project.properties`.
- Gates locais e PRs até `dev` ficam rápidos ao adiar cobertura completa e
  patch coverage para a promoção de release.

## Proteção de branch

`dev` exige os checks baratos do destino: os contextos do CircleCI
`ci/circleci: branch-gate`, `ci/circleci: third-party-review` e
`ci/circleci: browser-matrix`, mais os checks `pr-feedback` do GitHub Actions
sempre ativos, assinaturas verificadas, pull requests, proteção
contra non-fast-forward, proteção contra deleção e threads de review resolvidas.
O check de confiabilidade-A do SonarCloud é absorvido pelo job `coverage` do
CircleCI.

`main` exige os checks completos do destino: `ci/circleci: branch-gate`,
`ci/circleci: third-party-review`, `ci/circleci: browser-matrix`,
`ci/circleci: workspace-builds`, `ci/circleci: workspace-tests`,
`ci/circleci: integration`, `ci/circleci: coverage`, `ci/circleci: website` e
`ci/circleci: database-matrix`, mais os checks `pr-feedback` sempre ativos,
assinaturas verificadas, pull requests, proteção contra non-fast-forward,
proteção contra deleção e threads de review resolvidas.

## Definição de verde

Uma PR só está verde quando todos os checks exigidos pelo destino terminam com
sucesso, threads válidas de review estão resolvidas, a rastreabilidade está
atualizada e o merge protegido ocorre sem `--no-verify`, admin, force ou bypass
equivalente.
