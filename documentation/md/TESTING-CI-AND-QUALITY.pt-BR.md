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

- `.husky/pre-commit` sincroniza/adiciona `CHANGELOG.md` e executa o gate da branch
- `.husky/pre-push` identifica o destino enviado e executa o gate da branch
- `.husky/pre-merge-commit` executa o gate do destino do merge
- `post-commit` é livre de mutações (sem correção automática, sem sinalizadores de bypass)
- `.husky/commit-msg` executa commitlint (@commitlint/config-conventional`)

Aplicação remota:

- CircleCI invoca `bun run ci:gate:branch` enquanto GitHub Actions billing bloqueia execução hospedada
- o CircleCI passa a branch base do PR ou a branch enviada, marca eventos de PR e sempre retém a evidência do gate
- CircleCI assume a produção completa de cobertura e patch coverage em promoções `dev -> main`, pushes em `main` e execuções completas agendadas; gates locais e PRs até `dev` ficam rápidos e diagnósticos
- eventos de push em branches de tarefa comparam `origin/dev...HEAD`; a CI hospedada nunca usa o
  modo local de diff staged
- o CircleCI publica `artifacts/ci/full-test-matrix.json` quando o gate seleciona a matriz completa
- `.circleci/config.yml` executa build/smoke do Storybook e prepublish somente em contextos de release/full
- o Storybook não é executado pela matriz global
- `ci:monorepo` permanece como entrada de compatibilidade, mas não pode selecionar um plano reduzido somente para documentação

Importação de cobertura do SonarQube Cloud:

- Fluxo de trabalho: `.circleci/config.yml`
- Fonte de cobertura: `./coverage/lcov.info` (Jest LCOV)
- Configuração do scanner: `sonar.javascript.lcov.reportPaths=./coverage/lcov.info`
- Segredo CircleCI necessário: `SONAR_TOKEN`

### Visão geral de ferramentas integradas

| Integração | Finalidade | Onde está configurado | O que executar/requisitos |
|------------|---------|----------------------------|-----------------------------|
| CircleCI (branch gate) | Validação orientada ao destino em push/PR | `.circleci/config.yml` | Seleciona pelo destino do PR ou branch enviada e retém evidência do gate |
| CircleCI (cobertura) | Cobertura de projeto e patch pertencente ao repositório | `.circleci/config.yml` | Aplica `coverage:check` e `coverage:patch` e retém evidência JSON/LCOV |
| CircleCI (Codecov) | Publicação de dashboard de cobertura | `.circleci/config.yml` | Requer `CODECOV_TOKEN`; envia LCOV pelo Codecov CLI após thresholds locais |
| CircleCI (revisão third-party) | Revisão fail-closed de segredos e análise estática | `.circleci/config.yml` | Executa Gitleaks/Semgrep fixados e retém evidência SARIF |
| CircleCI (website) | Storybook e prontidão de publicação pertencentes ao website | `.circleci/config.yml` | Executa build/smoke do Storybook e prepublish de forma independente |
| CircleCI (SonarQube Cloud) | Análise estática + quality gate + importação de cobertura | `.circleci/config.yml`, `sonar-project.properties` | Requer `SONAR_TOKEN`; importa LCOV retido após cobertura |
| Gate de cobertura do repositório | Hard gate local contra baixa cobertura | `jest.config.js`, `ci-cd/check-coverage-thresholds.js` | Statements/linhas/funções 99%, branches 90%, linhas alteradas 99% |
| Husky | Ganchos Git locais para verificações de qualidade | `.husky/*` | Instalado por `bun run prepare` |
| Commitlint + Commitizen | Commits convencionais e fluxo de commits guiados | `commitlint.config.js`, `package.json` | `bun run commit` |
| Automação de sincronização do changelog | Mantém `CHANGELOG.md` alinhado com a história do Git | `ci-cd/update-changelog.js`, `.husky/post-commit` | `bun run changelog:update`, `bun run changelog:check` |
| Liberar verificação de governança | Aplica contratos de script de lançamento e metadados de publicação de pacotes | `ci-cd/check-release-governance.js` | `bun run release:governance:check` |
| Verificação de resolução de rota OpenAPI | Garante que cada OperationId seja mapeado para manipuladores e métodos de controlador | `ci-cd/check-oas-route-resolution.js` | `bun run oas:check-routes` |
| Verificação de limite hexagonal | Bloqueia violações da camada controladora | `ci-cd/check-hexagonal-boundaries.js` | `bun run arch:check-boundaries` |
| Verificação do ciclo de importação principal | Impede dependências cíclicas em namespaces principais | `ci-cd/check-core-import-cycles.js` | `bun run deps:check-cycles` |
| Verificação de namespace herdado | Bloqueia novas importações de namespaces de usuários antigos | `ci-cd/check-users-legacy-imports.js` | `bun run arch:check-users-legacy-imports` |

### Plataformas e responsabilidades de CI

#### Provedor hospedado ativo

CircleCI está ativo pelo Requisito 113 enquanto GitHub Actions billing bloqueia
execução hospedada. O workflow roda em `dev`, `main` e pull requests, com Sonar
filtrado para as duas branches longas. A publicação Codecov roda depois do gate
de cobertura do repositório e nunca substitui esse gate como autoridade de merge.

### Política de Cobertura (Padrão Estrito)

- O workflow próprio impõe cobertura de projeto e patch.
- Jest impõe portão local antes da fusão:
  - `linhas >= 99%`
  - `declarações >= 99%`
  - `ramos >= 90%`
  - `funções >= 99%`
- Espera-se que os commits e PRs respeitem esses limites antes da aprovação.

### Runtime Bun e compatibilidade Node

O projeto usa Bun nos fluxos internos de engenharia e mantém Node 22 como alvo
de compatibilidade voltado a consumidores:

- `package.json` -> `"packageManager": "bun@1.3.14"`
- `package.json` -> `"engines": { "bun": ">=1.3.14", "node": ">=22.0.0 <23.0.0" }`
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

- [Solução de problemas de CI / SonarQube / cobertura do repositório](./CI-TROUBLESHOOTING.md)
- [Guia de teste de API em tempo real](./REALTIME-API-TESTING.md)
