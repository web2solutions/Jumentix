<!--
Arquivo gerado automaticamente a partir de: documentation/md/TESTING-CI-AND-QUALITY.md
Idioma alvo: Português (Brasil)
-->
# Teste, CI e portas de qualidade

## Teste

Execute o conjunto de testes completo:

```bash
bun run test
```

Execute testes de unidade:

```bash
bun run test:unit
```

Esse comando primeiro compila os artefatos publicáveis dos pacotes e depois
resolve `@jumentix/*` pelo export `development` do workspace durante as suítes
unitárias. A combinação valida a compilação dos pacotes sem carregar instâncias
duplicadas de classes de `src` e `dist` no mesmo processo de teste.

Execute testes de integração:

```bash
bun run test:integration
```

Execute testes de integração em tempo real:

```bash
bun run test:integration:realtime
```

Execute a integração em tempo real de várias instâncias apoiada pelo Redis:

```bash
bun run test:integration:realtime:redis-streams
```

Execute testes de fumaça do driver de banco de dados:

```bash
bun run test:smoke:db:all
```

Execute testes de fumaça em tempo real:

```bash
bun run test:smoke:realtime
bun run smoke:realtime:redis-streams
```

`test:smoke:db:all` orquestra cada comando smoke específico do driver, incluindo
`docker compose up/down` automático para bancos de dados apoiados por contêiner.

Atalhos de fumaça apoiados em contêineres:

```bash
bun run smoke:db:postgresql
bun run smoke:db:mysql
bun run smoke:db:mssql
bun run smoke:db:oracle
bun run smoke:db:mongodb
bun run smoke:db:cassandra
bun run smoke:db:dynamodb
bun run smoke:db:firebase
bun run smoke:db:aurora
bun run smoke:db:rds
```

Por tempo de execução:

```bash
bun run test:integration:express
bun run test:integration:fastify
bun run test:integration:restify
bun run test:integration:lambda
```

## CI e portas de qualidade

Portão principal:

```bash
bun run ci:gate
```

Gate estrito de push e CI remoto:

```bash
bun run ci:gate:strict
```

Cheques incluídos:

- `lint`
- verificação do ciclo de importação principal
- verificação de limite hexagonal
- verificação de importação legada de usuários
- verificação de qualidade do pacote de espaço de trabalho (contratos de script necessários e nenhum script de teste de espaço reservado)
- verificação de governança de lançamento (scripts de lançamento necessários, validade semver, publicação de metadados para pacotes não privados)
- testes unitários
- Verificação de resolução de rota OpenAPI
- construir
- fumaça de integração
- limites mínimos de cobertura de projeto e patch pertencentes ao repositório

O gate estrito é um manifesto explícito e fail-closed com 24 células obrigatórias:

- verificações de lint, arquitetura, contratos, governança de release, segurança e smoke de API
- validação do contrato canônico de integrações com provedores
- testes unitários, builds/testes da raiz e dos workspaces e cobertura do patch
- a matriz completa de 15 alvos de integração HTTP, Lambda, realtime e Service Management
- execução agregada que informa todas as células com falha, em vez de parar na primeira falha

Os alvos de integração usam `--coverage=false`; os testes unitários permanecem como
a etapa oficial que produz cobertura. Células vazias, duplicadas, malformadas, com
script ausente, interrompidas ou com status diferente de zero falham de forma fechada.
Execução por escopo, inclusive alterações somente de documentação, não pode omitir
uma célula em um limite de entrega.

Cada alvo de integração é executado com `CI=true`. O tempo limite padrão do processo é de
120 segundos. Os alvos completos Express e Fastify possuem exceções
explícitas de 300 segundos porque suas suítes HTTP completas atingiram ou se aproximaram do
limite do processo sob a carga da matriz de release. Somente o Restify completo possui um
orçamento finito de processo de 600 segundos depois que uma execução sob carga extrema
atingiu o antigo limite de 300 segundos enquanto a fase unitária anterior levou 327,115
segundos. Em uma execução estrita, o Fastify também ultrapassou o limite de
120 segundos após suas asserções. Essa margem
específica impede que um `SIGTERM` trunque uma resposta HTTP ativa ou sua limpeza sem
enfraquecer o tempo limite dos alvos menores; um tempo limite informado explicitamente ao
executor continua sendo prioritário. Qualquer tempo limite é reportado como saída `124`,
reprova a célula de integração e não impede o relato dos alvos restantes.

O Restify também é executado com tempo limite Jest de 15 segundos por teste. Sob carga
sustentada da matriz estrita, requisições Restify autenticadas apresentaram duração medida de
5,4–5,8 segundos, acima do padrão genérico de 5 segundos do Jest. O orçamento específico do
alvo permite que essas requisições reais terminem, em vez de cancelar suas asserções enquanto
mantêm handles HTTP ativos. Ele não adiciona tentativas, não ignora testes, não enfraquece
asserções nem altera o limite finito separado de 600 segundos do processo. Express, Fastify e
todos os demais alvos de integração mantêm seus padrões existentes por teste.

Cada arquivo de integração Fastify e Restify vincula seu servidor HTTP uma única vez a uma
porta efêmera de loopback, reutiliza esse listener em todas as requisições Supertest do arquivo
e o fecha explicitamente no `afterAll`. Isso impede que o Supertest abra e feche repetidamente
o mesmo servidor nativo, comportamento que sob carga sustentada da matriz pode cruzar respostas
ou deixar handles de parser/listener ativos. O ciclo de vida não usa porta fixa, nova tentativa,
asserção ignorada nem encerramento forçado do processo.

Saídas
`dist` geradas são excluídas do lint para que um build concluído não faça a execução seguinte
da matriz falhar ao analisar declarações geradas.

Aplicação por branch:

```bash
bun run ci:gate:branch
```

O seletor lê `JUMENTIX_QUALITY_GATE_TARGET` e o sinal de PR
(`CIRCLE_PULL_REQUEST` ou `AAA_CI_IS_PULL_REQUEST`). Uma branch de tarefa executa
`bun run ci:gate:task`, limitado aos testes unitários alterados ou relacionados.
Um push direto para `dev` executa a suíte completa `bun run test:unit`. Um PR
destinado a `dev` executa `bun run ci:gate:task` mais revisão leve. Uma promoção
de release para `main`, ou qualquer caminho para `main`, executa
`bun run ci:gate:strict`, a matriz local completa sem cobertura pesada. Alterações somente de documentação
validam os arquivos Markdown e emitem evidência explícita `not-applicable`, sem
fabricar um teste aprovado.

Aplicação local:

- `.husky/pre-commit` executa o gate da branch sem modificar arquivos gerados
- `.husky/pre-push` identifica o destino enviado e executa o gate da branch
- `.husky/pre-merge-commit` executa o gate do destino do merge
- `post-commit` é livre de mutações (sem correção automática, sem sinalizadores de bypass)
- `.husky/commit-msg` executa commitlint (@commitlint/config-conventional`)

Aplicação remota:

- CircleCI (`.circleci/config.yml`) é o orquestrador hospedado canônico e invoca `bun run ci:gate:branch`
- o CircleCI passa a branch base do PR ou a branch enviada, marca eventos de PR e sempre retém a evidência do gate
- CircleCI assume a produção completa de cobertura (mais upload Codecov e scan SonarCloud) em pushes para `dev` e `main`, promoções `dev -> main` e nas execuções completas do gatilho agendado noturno; gates locais e PRs de tarefa até `dev` ficam rápidos e diagnósticos
- Após um merge validado em `main`, o job `sync-changelog` do GitHub Actions, sempre ativo, serializa a atualização gerada de `CHANGELOG.md`; branches de tarefa, `dev` e PRs deixam esse arquivo intacto
- eventos de push em branches de tarefa comparam `origin/dev...HEAD`; a CI hospedada nunca usa o
  modo local de diff staged
- o CircleCI publica `artifacts/ci/full-test-matrix.json` quando o gate seleciona a matriz completa
- o job `website` do CircleCI executa build/smoke do Storybook e prepublish somente em contextos de release/full
- o Storybook não é executado pela matriz global
- `ci:monorepo` permanece como entrada de compatibilidade, mas não pode selecionar um plano reduzido somente para documentação
- O check obrigatório `pr-feedback` é uma exceção do GitHub Actions sempre ativa: roda a partir da revisão confiável da base da PR e reprova threads de revisão não resolvidas ou comentários gerais sem evidência visível de resolução validada. A única exceção é o aviso estrito de limite de uso do Cursor, vindo do login `cursor`; o workflow dedicado `pr-feedback-trusted` repete essa defesa depois de estar disponível a partir da branch padrão.
- O check de reliability-A do SonarCloud roda dentro do job `coverage` do CircleCI (`bun run sonar:check-reliability`): consulta a análise de pull request do SonarCloud e aceita somente reliability A. Ele faz checkout do SHA confiável da base, nunca do código da PR, antes de acessar `SONARCLOUD_TOKEN`. Os workflows dedicados do GitHub `sonar-reliability.yml` e `sonar-reliability-trusted` estão retidos, mas atrás do flag `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI`.
- O check obrigatório `browser-matrix` roda como job do CircleCI executando as suítes Cana em Chrome, Firefox e WebKit em toda PR para `dev` ou `main`. Ele tem somente leitura de conteúdo e não recebe segredos; `.github/workflows/browser-matrix.yml` é o fallback retido atrás do flag.
- A matriz do GitHub Actions (`.github/workflows/ci.yml`, `browser-matrix.yml`, `sonar-reliability.yml`) está retida, desabilitada por padrão, e roda somente quando a variável de Actions do repositório `JUMENTIX_ENABLE_GITHUB_ACTIONS_CI` é `true`.

#### Matriz de jobs hospedados por contexto (JUM-786)

`ci-cd/classify-ci-context.js` (`JOBS_BY_CONTEXT`) e os guards de jobs em
`.circleci/config.yml` precisam concordar. Jobs pesados (`workspace-builds`,
`workspace-tests`, `integration`, `coverage`, `website`, `database-matrix`)
correm só em release/`main`/agendado (Requisitos `087`/`113`). Em push de
tarefa, PR para `dev` e push barato para `dev` eles **pulam de propósito** —
pular não é passar. O `.github/workflows/ci.yml`, retido atrás do flag, mantém
`if:` equivalentes por job para o caminho de fallback.

| Contexto | Jobs que rodam (CircleCI) | Script do branch-gate + preflight |
| --- | --- | --- |
| Push de branch de tarefa | `branch-gate` | `ci:gate:task` + lint, `test:integrity`, `arch:check-workspace-boundaries`, `build:dev` |
| PR para `dev` | `branch-gate`, `third-party-review`, `browser-matrix` (mais o `pr-feedback` do GitHub, sempre ativo) | mesmo gate de tarefa + preflight |
| Push para `dev` | `branch-gate` | `test:unit` + lint, integrity, boundaries, `build:dev` |
| PR de release para `main` / push `main` / schedule / gatilho manual | lista completa (`FULL_JOBS`) | `ci:gate:strict` (+ integrity, boundaries, `build:dev` preflight) |

`build:dev` (`tsc -p tsconfig.build.json`) tipa o TypeScript de backend/pacotes
do compilador raiz. `apps/frontend/**` fica de fora: o workspace dono é
`vue-tsc` (`bun run --cwd apps/frontend typecheck`). Testes unitários de
service-management ficam de fora como os do backend-template (JUM-785).

Boundaries e `build:dev` são **preflight de todo caminho do branch-gate desde
o JUM-786**, para um passo vermelho de `ci:gate` não esconder atrás de jobs
pesados pulados num PR para `dev`.

Importação de cobertura do SonarQube Cloud:

- Fluxo de trabalho: o job `coverage` do CircleCI em `.circleci/config.yml` (`.github/workflows/ci.yml` é o fallback retido atrás do flag)
- Fonte de cobertura: `./coverage/lcov.info` (Jest LCOV)
- Configuração do scanner: `sonar.javascript.lcov.reportPaths=./coverage/lcov.info`
- Segredo necessário: `SONARCLOUD_TOKEN`, configurado no CircleCI (exposto ao scanner e ao verificador de reliability como `SONAR_TOKEN`)

### Visão geral de ferramentas integradas

| Integração | Finalidade | Onde está configurado | O que executar/requisitos |
|------------|---------|----------------------------|-----------------------------|
| CircleCI (branch gate) | Validação orientada ao destino em push/PR | `.circleci/config.yml` | Seleciona pelo destino do PR ou branch enviada e retém evidência do gate |
| CircleCI (cobertura) | Cobertura de projeto e patch pertencente ao repositório | `.circleci/config.yml` | Aplica `coverage:check` e `coverage:patch` e retém evidência JSON/LCOV |
| CircleCI (Codecov) | Publicação de dashboard de cobertura | `.circleci/config.yml` | Requer `CODECOV_TOKEN`; envia LCOV via Codecov CLI verificado por checksum após thresholds locais (`codecov/codecov-action@v5` no fallback do GitHub atrás do flag) |
| CircleCI (revisão third-party) | Revisão fail-closed de segredos e análise estática | `.circleci/config.yml` | Executa Gitleaks/Semgrep fixados e retém evidência SARIF |
| GitHub Actions (feedback de PR, sempre ativo) | Bloqueia threads de revisão não resolvidas e feedback geral sem tratamento | `.github/workflows/pr-feedback.yml`, `ci-cd/check-pr-feedback.js` | Roda do SHA confiável da base; respostas de resolução identificam o comentário exato e, quando corrigido, um SHA da PR |
| CircleCI (reliability Sonar) | Bloqueia uma PR cuja reliability no SonarCloud não seja A | `.circleci/config.yml` (job `coverage`), `ci-cd/check-sonar-reliability.js` | Roda `bun run sonar:check-reliability` dentro do job `coverage` a partir do SHA confiável da base com `SONARCLOUD_TOKEN`; ausência de análise ou falha da API reprovam de forma fechada. `.github/workflows/sonar-reliability.yml` é o fallback atrás do flag |
| CircleCI (browser matrix) | Bloqueia regressões de navegador antes do merge | `.circleci/config.yml`, `packages/cana/scripts/run-browser-tests.js` | Executa Chrome, Firefox e WebKit com acesso somente leitura ao conteúdo e sem segredos; `.github/workflows/browser-matrix.yml` é o fallback atrás do flag |
| CircleCI (website) | Storybook e prontidão de publicação pertencentes ao website | `.circleci/config.yml` | Executa build/smoke do Storybook e prepublish de forma independente |
| CircleCI (SonarQube Cloud) | Análise estática + quality gate + importação de cobertura | `.circleci/config.yml`, `sonar-project.properties` | Requer `SONAR_TOKEN`; importa LCOV retido após cobertura |
| Gate de cobertura do repositório | Hard gate local contra baixa cobertura | `jest.config.js`, `ci-cd/check-coverage-thresholds.js` | Declarações/linhas/funções/ramos 98%, linhas alteradas 99%; ramos sob piso datado (JUM-721) |
| Gate de integridade de testes | Bloqueia suíte que não afirma nada, que só afirma sobre mock, que dorme como sincronização, ou que está fora do mapa | `ci-cd/check-test-integrity.js`, `ci-cd/run-branch-quality-gate.js` | `bun run test:integrity`; preflight de todo caminho do branch gate (JUM-683) |
| Boundaries de workspace + `build:dev` | Arquitetura e emit TypeScript raiz falham fechados antes dos gates baratos | `ci-cd/check-workspace-boundaries.js`, `tsconfig.build.json`, `ci-cd/run-branch-quality-gate.js` | `bun run arch:check-workspace-boundaries` + `bun run build:dev`; preflight de todo caminho do branch-gate (JUM-786) |
| Husky | Ganchos Git locais para verificações de qualidade | `.husky/*` | Instalado por `bun run prepare` |
| Commitlint + Commitizen | Commits convencionais e fluxo de commits guiados | `commitlint.config.js`, `package.json` | `bun run commit` |
| Automação de sincronização do changelog | Mantém `CHANGELOG.md` alinhado com a história do Git sem conflitos de branch de tarefa | `ci-cd/update-changelog.js`, `.github/workflows/ci.yml` | CI executa somente após merge validado em `main`; `bun run changelog:check` é apenas diagnóstico |
| Liberar verificação de governança | Aplica contratos de script de lançamento e metadados de publicação de pacotes | `ci-cd/check-release-governance.js` | `bun run release:governance:check` |
| Verificação de resolução de rota OpenAPI | Garante que cada OperationId seja mapeado para manipuladores e métodos de controlador | `ci-cd/check-oas-route-resolution.js` | `bun run oas:check-routes` |
| Verificação de limite hexagonal | Bloqueia violações da camada controladora | `ci-cd/check-hexagonal-boundaries.js` | `bun run arch:check-boundaries` |
| Verificação do ciclo de importação principal | Impede dependências cíclicas em namespaces principais | `ci-cd/check-core-import-cycles.js` | `bun run deps:check-cycles` |
| Verificação de namespace herdado | Bloqueia novas importações de namespaces de usuários antigos | `ci-cd/check-users-legacy-imports.js` | `bun run arch:check-users-legacy-imports` |
| Colocação de ownership (Req 137) | Suites e tooling ficam no workspace do código que afirmam; allow-list shrink-only permanece vazia no estado estável | `ci-cd/check-workspace-ownership-placement.js`, `ci-cd/ownership-placement-allowlist.json`, `ci-cd/test/check-workspace-ownership-placement.test.ts` | `bun run arch:check-ownership-placement`; ligado em `ci:gate` e no preflight de branch |

### Casas de suite (Requisito 137)

| Casa | Afirma | Notas |
| --- | --- | --- |
| `apps/<A>/test/**` | `apps/<A>` | Wiring consumidor `@jumentix/*` é permitido. Clones profundos `packages/*/src` e `@src/` a partir do Service Management não são (Req 126). `apps/service-management-api` pode compor o backend-template via `@src` por desenho. |
| `packages/<P>/test/**` | apenas `packages/<P>` | Sem clones dual-home de apps. |
| `ci-cd/test/**` | Gates monorepo, runners, test-map e tooling de release em `ci-cd/**` | Fixtures de gate podem nomear outros workspaces em prosa sem contar como SUT estrangeiro. |

Scripts específicos de componente ficam em `apps/<A>/scripts/` ou `packages/<P>/scripts/` (ou `bin/`). O `package.json` raiz mantém cada nome público de script e delega. Suites novas de package/app vão sob o `test/` daquele workspace; provas de gate monorepo vão sob `ci-cd/test/`. Após um move, rode `bun run test-map:generate` e `bun run arch:check-ownership-placement`.

A allow-list em `ci-cd/ownership-placement-allowlist.json` é shrink-only. Estado estável é `[]`. Entrada obsoleta (suite ausente no disco) falha fechada.

### Plataformas e responsabilidades de CI

#### Provedor hospedado ativo

CircleCI está ativo como provedor hospedado canônico pelo Requisito 113 (emenda
de 2026-09-23), e o GitHub Actions está retido como fallback desabilitado por
padrão atrás da variável de Actions do repositório
`JUMENTIX_ENABLE_GITHUB_ACTIONS_CI`. O CircleCI roda a matriz completa em
`dev`, `main` e pull requests, com Sonar filtrado para as duas branches
longas e gatilho agendado noturno em `main`/`dev`. A publicação Codecov roda
depois do gate de cobertura do repositório e
nunca substitui esse gate como autoridade de merge. Três superfícies do GitHub
Actions permanecem sempre ativas: `pr-feedback.yml` (execução de forks
confiáveis via `pull_request_target`), os jobs `sync-changelog`/`pr-feedback`
em `ci.yml`, e `npm-publish.yml` (GitHub Environment protegido pelo Requisito
070).

### Política de Cobertura (Padrão Estrito)

- O workflow próprio impõe cobertura de projeto e patch.
- A autoridade é `ci-cd/check-coverage-thresholds.js`, que lê o relatório
  mesclado (unitário + navegador). Ele impõe quatro métricas antes da fusão:
  - `declarações >= 98%`
  - `linhas >= 98%`
  - `funções >= 98%`
  - `ramos >= 98%`
- `ramos` é a única métrica ainda abaixo do seu limite. O valor medido fica em
  `ACCEPTED_BELOW_THRESHOLD` como **piso datado, sob o JUM-721**, e a entrada é uma
  catraca, não uma dispensa: cobertura igual ou acima do piso passa, abaixo
  falha, e atingir 98% com a entrada ainda listada também falha. O piso subiu de
  93,278% para 95,902% durante o JUM-681; cada movimento está registrado na nota
  ao lado dele, com o comportamento que os ramos recém-cobertos escondiam.
- Subir ou baixar qualquer um dos quatro limites é decisão de governança sob os
  Requisitos 020 e 063.
- Espera-se que os commits e PRs respeitem esses limites antes da aprovação.

### Gate de Integridade de Testes (Requisitos 134 e 135)

`ci-cd/check-test-integrity.js` impõe a metade mecânica de "sem teste instável,
sem teste falso":

1. todo teste declara que afirma — **por teste desde o JUM-702**, contando uma
   declaração feita uma vez em `beforeEach`/`beforeAll` de um `describe`
   envolvente;
2. nenhuma suíte afirma apenas que um mock foi chamado;
3. nenhum sleep fixo é usado como sincronização;
4. nenhuma suíte fica fora do `test-map.json`.

Ele roda como **preflight de todo caminho do branch gate desde o JUM-683** — o
gate de tarefa, o gate unitário e a matriz estrita — ao lado do lint e pelo mesmo
motivo: lê as suítes sem executá-las, e uma árvore cujos testes não afirmam nada
não tem o que aprender executando-os. Antes disso ele estava no script
`ci:gate`, que nenhum job de CI invoca.

Seus três registros (`ACCEPTED_SLEEPS`, `ACCEPTED_MOCK_ONLY`,
`ACCEPTED_NO_ASSERTIONS`) estão **vazios**. Eles são mantidos em vez de
removidos: as opções injetáveis são o que permite à suíte exercitar cada caminho
de falha, e as checagens de entrada obsoleta — uma entrada nomeando arquivo que
não infringe mais é ela própria uma falha — são o que torna a próxima exceção
tão auditável quanto estas foram.

### Runtime Bun e compatibilidade Node

O projeto usa Bun nos fluxos internos de engenharia e mantém Node 22 como alvo
de compatibilidade voltado a consumidores:

- `package.json` -> `"packageManager": "bun@1.3.13"`
- `package.json` -> `"engines": { "bun": ">=1.3.13", "node": ">=22.0.0 <23.0.0" }`
- `bunfig.toml` mantém Bun como fronteira do runner de scripts.
- `ci-cd/check-bun-version.js` valida a toolchain Bun ativa.
- `ci-cd/check-node-version.js` é exposto por `compat:check-node-version` para checks de compatibilidade Node.
- `.nvmrc` e `.node-version` permanecem fixados em `22.0.0`

Configuração local recomendada:

```bash
bun --version
bun run check-bun-version
bun run compat:check-node-version
```

### Ambiente e segredos em CI

Variáveis ​​comuns usadas por testes e fluxos de trabalho:

- `JUMENTIX_JWT_TOKEN_SECRET_KEY`
- `JUMENTIX_REDIS_PASSWORD`
- `SONAR_TOKEN` (obrigatório apenas para a etapa de varredura do SonarQube)

Bootstrap do ambiente durante os testes:

- `jest.config.js` usa `setupFiles: ["./ci-cd/loadEnvironment.js"]`
- `ci-cd/loadEnvironment.js` carrega o primeiro arquivo existente de:
  - `dev`: `.env.dev`, `.env.dev.example`, `.env.ci`
  - `ci`: `.env.ci`, `.env.dev.example`
  - `prod`: `.env.prod`
  - `staging`: `.env.staging`
- Para segurança do CI, ele define `JUMENTIX_JWT_TOKEN_SECRET_KEY=ci_jwt_secret_key` se estiver ausente.

### Comandos Quality Gate (equivalente local de CI)

Execute o portão completo:

```bash
bun run ci:gate:strict
```

Execute verificações direcionadas:

```bash
bun run deps:check-cycles
bun run arch:check-boundaries
bun run arch:check-users-legacy-imports
bun run arch:check-workspace-boundaries
bun run arch:check-ownership-placement
bun run workspace:check-quality
bun run workspace:check-coverage-policy
bun run release:governance:check
bun run oas:check-routes
bun run test:unit
bun run ci:smoke
bun run ci:integration
```

### Solução de problemas (CI / SonarQube / cobertura do repositório)

Para incidentes de CI e verificações com falha, consulte:

- [Solução de problemas de CI / SonarQube / cobertura do repositório](./CI-TROUBLESHOOTING.pt-BR.md)
- [Guia de teste de API em tempo real](./REALTIME-API-TESTING.pt-BR.md)
