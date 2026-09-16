# Estratégia gratuita de CI para open source público

## Decisão

`web2solutions/Jumentix` é o repositório público canônico. GitHub Actions é o
orquestrador canônico de CI, CircleCI está habilitado como provedor público
secundário, e ambos usam caminhos gratuitos para open source. Codecov e
SonarQube Cloud permanecem ativos porque o repositório é público; eles são
publicados pelo gate completo de cobertura e não substituem os thresholds
controlados pelo repositório.

Checks obrigatórios falham fechado. Resultado pulado, neutro, ausente,
expirado, cancelado ou pendente não é verde.

## Mapa de provedores

| Provedor | Papel | Evidência obrigatória |
| --- | --- | --- |
| GitHub Actions | Gate canônico por branch em `ubuntu-latest` | `branch-gate`, jobs da matriz completa, evidência JSON/LCOV/SARIF |
| CircleCI | Espelho secundário de CI para execução pública open source | Mesmo classificador de contexto, mesmos nomes de jobs e artefatos retidos |
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

PRs de tarefa para `dev` têm alvo operacional de dez minutos ou menos. O
`branch-gate` classifica o contexto, lê `test-map.json` e executa apenas suites
afetadas/relacionadas, mais checks leves de governança e segurança. A matriz
completa roda em promoções `dev -> main`, pushes em `main` e execuções completas
agendadas ou manuais.

## Contrato de cobertura

- Statements, linhas e funções: 99%.
- Branches: 90%.
- Linhas alteradas: 99%.
- GitHub Actions e CircleCI retêm evidência JSON/LCOV e enviam LCOV ao Codecov
  quando o job completo de cobertura roda.
- SonarQube Cloud lê os mesmos caminhos LCOV declarados em
  `sonar-project.properties`.
- Gates locais e PRs até `dev` ficam rápidos ao adiar cobertura completa e
  patch coverage para a promoção de release.

## Proteção de branch

`dev` exige os checks baratos do destino: `branch-gate` e
`third-party-review`, além de assinaturas verificadas, pull requests, proteção
contra non-fast-forward, proteção contra deleção e threads de review resolvidas.

`main` exige os checks completos do destino: `branch-gate`,
`third-party-review`, `workspace-builds`, `workspace-tests`, `integration`,
`coverage`, `website` e `database-matrix`, além de assinaturas verificadas,
pull requests, proteção contra non-fast-forward, proteção contra deleção e
threads de review resolvidas.

## Definição de verde

Uma PR só está verde quando todos os checks exigidos pelo destino terminam com
sucesso, threads válidas de review estão resolvidas, a rastreabilidade está
atualizada e o merge protegido ocorre sem `--no-verify`, admin, force ou bypass
equivalente.
