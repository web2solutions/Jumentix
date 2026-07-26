<!--
Arquivo gerado automaticamente a partir de: documentation/md/TESTING-CI-AND-QUALITY.md
Idioma alvo: Português (Brasil)
-->
# Teste, CI e portas de qualidade

## Teste

Execute o conjunto de testes completo:

```bash
pnpm test
```

Execute testes de unidade:

```bash
pnpm run test:unit
```

Execute testes de integração:

```bash
pnpm run test:integration
```

Execute testes de integração em tempo real:

```bash
pnpm run test:integration:realtime
```

Execute a integração em tempo real de várias instâncias apoiada pelo Redis:

```bash
pnpm run test:integration:realtime:redis-streams
```

Execute testes de fumaça do driver de banco de dados:

```bash
pnpm run test:smoke:db:all
```

Execute testes de fumaça em tempo real:

```bash
pnpm run test:smoke:realtime
pnpm run smoke:realtime:redis-streams
```

`test:smoke:db:all` orquestra cada comando smoke específico do driver, incluindo
`docker compose up/down` automático para bancos de dados apoiados por contêiner.

Atalhos de fumaça apoiados em contêineres:

```bash
pnpm run smoke:db:postgresql
pnpm run smoke:db:mysql
pnpm run smoke:db:mssql
pnpm run smoke:db:oracle
pnpm run smoke:db:mongodb
pnpm run smoke:db:cassandra
pnpm run smoke:db:dynamodb
pnpm run smoke:db:firebase
pnpm run smoke:db:aurora
pnpm run smoke:db:rds
```

Por tempo de execução:

```bash
pnpm run test:integration:express
pnpm run test:integration:fastify
pnpm run test:integration:restify
pnpm run test:integration:lambda
pnpm run test:integration:hyper-express
```

## CI e portas de qualidade

Portão principal:

```bash
pnpm run ci:gate
```

Gate estrito de push e CI remoto:

```bash
pnpm run ci:gate:strict
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
- limite mínimo de cobertura (99% global via status Jest + Codecov)

O gate estrito é um manifesto explícito e fail-closed com 18 células obrigatórias:

- verificações de lint, arquitetura, contratos, governança de release, segurança e smoke de API
- testes unitários, builds/testes da raiz e dos workspaces e cobertura do patch
- a matriz completa de 15 alvos de integração HTTP, Lambda, realtime e Service Management
- execução agregada que informa todas as células com falha, em vez de parar na primeira falha

Os alvos de integração usam `--coverage=false`; os testes unitários permanecem como
a etapa oficial que produz cobertura. Células vazias, duplicadas, malformadas, com
script ausente, interrompidas ou com status diferente de zero falham de forma fechada.
Execução por escopo, inclusive alterações somente de documentação, não pode omitir
uma célula em um limite de entrega.

Cada alvo de integração é executado com `CI=true` e tempo limite de processo de 120
segundos. Um tempo limite é reportado como saída `124`, reprova a célula de integração
e não impede o relato dos alvos restantes. Saídas `dist` geradas são excluídas do lint
para que um build concluído não faça a execução seguinte da matriz falhar ao analisar
declarações geradas.

Aplicação local:

- `.husky/pre-commit` sincroniza/adiciona `CHANGELOG.md` e depois executa `pnpm run ci:gate:strict`
- `.husky/pre-push` executa `pnpm run ci:gate:strict`
- `post-commit` é livre de mutações (sem correção automática, sem sinalizadores de bypass)
- `.husky/commit-msg` executa commitlint (@commitlint/config-conventional`)

Aplicação remota:

- CircleCI e GitHub Actions invocam `pnpm run ci:gate:strict` diretamente
- a CI de pull requests no GitHub envia `artifacts/ci/full-test-matrix.json` mesmo após falha
- `ci:monorepo` permanece como entrada de compatibilidade, mas não pode selecionar um plano reduzido somente para documentação

Importação de cobertura do SonarQube Cloud:

- Fluxo de trabalho: `.github/workflows/sonarqube-cloud.yml`
- Fonte de cobertura: `./coverage/lcov.info` (Jest LCOV)
- Configuração do scanner: `sonar.javascript.lcov.reportPaths=./coverage/lcov.info`
- Segredo do repositório necessário: `SONAR_TOKEN`

### Visão geral de ferramentas integradas

| Integração | Finalidade | Onde está configurado | O que executar/requisitos |
|------------|---------|----------------------------|-----------------------------|
| CírculoCI | Pipeline principal para lint + testes + verificações de arquitetura + fumaça + cobertura de upload | `.circleci/config.yml` | Instala com `pnpm`, executa `pnpm run ci:gate:strict` e armazena a evidência da matriz |
| Ações do GitHub (testes) | Validação de CI secundário em push/PR | `.github/workflows/test.yml` | Usa Node `22.x`, instala com `pnpm`, executa `pnpm run ci:gate:strict` e envia a evidência da matriz |
| Ações GitHub (SonarQube Cloud) | Análise estática + portão de qualidade + importação de cobertura | `.github/workflows/sonarqube-cloud.yml`, `sonar-project.properties` | Requer `SONAR_TOKEN`; executa `pnpm run test:unit` primeiro |
| Códigocov | Verificações de status de cobertura para projeto e patch | `codecov.yml` | A meta é `95%` para projeto e patch |
| Portão de cobertura Jest | Hard gate local para evitar fusões de baixa cobertura | `jest.config.js` | Limiares globais: `linhas/declarações >= 95%`, `ramos/funções >= 80%` |
| Husky | Ganchos Git locais para verificações de qualidade | `.husky/*` | Instalado por `pnpm run prepare` |
| Comprometer-se + Comprometer-se | Commits convencionais e fluxo de commits guiados | `commitlint.config.js`, `package.json` | `pnpm executar commit` |
| Automação de sincronização do changelog | Mantém `CHANGELOG.md` alinhado com a história do Git | `ci-cd/update-changelog.js`, `.husky/post-commit` | `pnpm execute changelog:update`, `pnpm execute changelog:check` |
| Liberar verificação de governança | Aplica contratos de script de lançamento e metadados de publicação de pacotes | `ci-cd/check-release-governance.js` | `pnpm run release:governance:check` |
| Verificação de resolução de rota OpenAPI | Garante que cada OperationId seja mapeado para manipuladores e métodos de controlador | `ci-cd/check-oas-route-resolution.js` | `pnpm run oas:check-routes` |
| Verificação de limite hexagonal | Bloqueia violações da camada controladora | `ci-cd/check-hexagonal-boundaries.js` | `pnpm execute arch:check-boundaries` |
| Verificação do ciclo de importação principal | Impede dependências cíclicas em namespaces principais | `ci-cd/check-core-import-cycles.js` | `pnpm run deps:check-cycles` |
| Verificação de namespace herdado | Bloqueia novas importações de namespaces de usuários antigos | `ci-cd/check-users-legacy-imports.js` | `pnpm execute arch:check-users-legacy-imports` |

### Plataformas e responsabilidades de CI

#### Círculo CI

- Arquivo de pipeline: `.circleci/config.yml`
- Usa `cimg/node:22.23` mais `redis:latest`
- Instala `pnpm@9.15.3`, executa `pnpm install --no-frozen-lockfile`, aguarda Redis, executa `pnpm run ci:gate:strict`, armazena a evidência da matriz completa e envia a cobertura com o orb do Codecov
- Este é o portão multifuncional principal

#### GitHub Actions - Fluxo de trabalho de teste

- Arquivo de fluxo de trabalho: `.github/workflows/test.yml`
- Aciona:
  - `push` para `main` e `dev`
  - `pull_request` para `dev` e `main`
- Configura Redis (com senha), instala `pnpm` e executa `pnpm run ci:gate:strict`
- Envia o resultado JSON da matriz completa com `if: always()`; alterações somente de documentação não ignoram células obrigatórias

#### Ações do GitHub - Fluxo de trabalho da nuvem SonarQube

- Arquivo de fluxo de trabalho: `.github/workflows/sonarqube-cloud.yml`
- Aciona:
  - `push` para `main` e `dev`
  - `pull_request` para `principal`
- Instala dependências, executa testes de unidade com cobertura e, em seguida, executa a ação de varredura do SonarQube
- O scanner lê `./coverage/lcov.info` conforme configurado em `sonar-project.properties`

### Política de Cobertura (Padrão Estrito)

- Codecov impõe:
  - meta de cobertura do projeto: `95%`
  - meta de cobertura de patch: `95%`
- Jest impõe portão local antes da fusão:
  - `linhas >= 99%`
  - `declarações >= 99%`
  - `ramos >= 90%`
  - `funções >= 99%`
- Espera-se que os commits e PRs respeitem esses limites antes da aprovação.

### Aplicação de tempo de execução do nó 22

O projeto está bloqueado no Nó 22:

- `package.json` -> `"motores": { "nó": ">=22.0.0 <23.0.0" }`
- `.npmrc` -> `engine-strict=true`
- script `preinstall` -> `pnpm run check-node-version`
- `ci-cd/check-node-version.js` valida `process.version` em relação a `engines.node`
- `.nvmrc` e `.node-version` estão ambos fixados em `22.0.0`

Configuração local recomendada:

```bash
nvm use
node -v
pnpm -v
```

### Ambiente e segredos em CI

Variáveis ​​comuns usadas por testes e fluxos de trabalho:

- `AAA_JWT_TOKEN_SECRET_KEY`
- `AAA_REDIS_PASSWORD`
- `SONAR_TOKEN` (obrigatório apenas para a etapa de varredura do SonarQube)

Bootstrap do ambiente durante os testes:

- `jest.config.js` usa `setupFiles: ["./ci-cd/loadEnvironment.js"]`
- `ci-cd/loadEnvironment.js` carrega o primeiro arquivo existente de:
  - `dev`: `.env.dev`, `.env.dev.example`, `.env.ci`
  - `ci`: `.env.ci`, `.env.dev.example`
  - `prod`: `.env.prod`
  - `staging`: `.env.staging`
- Para segurança do CI, ele define `AAA_JWT_TOKEN_SECRET_KEY=ci_jwt_secret_key` se estiver ausente.

### Comandos Quality Gate (equivalente local de CI)

Execute o portão completo:

```bash
pnpm run ci:gate:strict
```

Execute verificações direcionadas:

```bash
pnpm run deps:check-cycles
pnpm run arch:check-boundaries
pnpm run arch:check-users-legacy-imports
pnpm run arch:check-workspace-boundaries
pnpm run workspace:check-quality
pnpm run workspace:check-coverage-policy
pnpm run release:governance:check
pnpm run oas:check-routes
pnpm run test:unit
pnpm run ci:smoke
pnpm run ci:integration
```

### Solução de problemas (CI / SonarQube / Codecov)

Para incidentes de CI e verificações com falha, consulte:

- [Solução de problemas de CI / SonarQube / Codecov](./CI-TROUBLESHOOTING.md)
- [Guia de teste de API em tempo real](./REALTIME-API-TESTING.md)
