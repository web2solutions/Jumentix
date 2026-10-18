<!--
Arquivo gerado automaticamente a partir de: documentation/md/CI-TROUBLESHOOTING.md
Idioma alvo: Português (Brasil)
-->
# Solução de problemas de CI / SonarQube / cobertura pertencente ao repositório

Este guia ajuda a diagnosticar e corrigir as falhas mais comuns em portas locais e pipelines de CI.

## 1) `bun install` falha com `EBADENGINE`

Sintomas:
- a instalação falha com `Mecanismo não suportado`
- A versão do nó não satisfaz o projeto `engines.node`

Causa:
- a versão do nó local/tempo de execução está fora do intervalo exigido.

Consertar:

```bash
nvm use
bun --version
bun run check-bun-version
bun run compat:check-node-version
```

Esperado:
- A versão do nó satisfaz `>=22.0.0 <23.0.0`

Arquivos relacionados:
- `package.json` (`engines.node`, `preinstall`)
- `.nvmrc`
- `.node-versão`
- `.npmrc`
- `ci-cd/check-node-version.js`

## 2) `test:unit` falha com arquivo `.env.*` ausente

Sintomas:
- ENOENT ao carregar o arquivo env durante a inicialização do Jest

Causa:
- o `NODE_ENV` atual não mapeia para um arquivo existente em `apps/backend-template/src/config`.

Consertar:

```bash
NODE_ENV=ci bun run test:unit
```

Certifique-se de que exista pelo menos um arquivo válido para substituto de CI:
- `apps/backend-template/src/config/.env.ci`
- `apps/backend-template/src/config/.env.dev.example`

Como isso funciona:
- `jest.config.js` carrega `ci-cd/loadEnvironment.js`
- `loadEnvironment.js` escolhe o primeiro arquivo disponível por `NODE_ENV`

## 3) `ci:gate` falha na resolução da rota OpenAPI

Sintomas:
- verifique os relatórios que faltam manipuladores para OperationId
- verifique o método do controlador de relatórios não implementado

Consertar:

```bash
bun run oas:check-routes
```

Lista de verificação:
- cada operação em `spec/*.yml` tem `operationId`
- cada tempo de execução possui manipulador em:
  - `apps/backend-template/src/modules/<Module>/interface/restapi/frameworks/<framework>/handlers/<operationId>.ts`
- o controlador implementa métodos invocados nesses manipuladores

Arquivo relacionado:
- `ci-cd/check-oas-route-resolution.js`

## 4) A verificação do SonarQube Cloud falha

Sintomas:
- o fluxo de trabalho falha na etapa de verificação do SonarQube
- relatórios de portão de qualidade sem cobertura importada

Causas comuns:
- `SONAR_TOKEN` ausente ou inválido
- Arquivo LCOV não gerado antes da verificação

Consertar:

```bash
bun run test:unit
ls coverage/lcov.info
```

Então confirme:
- o segredo do repositório `SONAR_TOKEN` está configurado
- `sonar-project.properties` inclui:
  - `sonar.javascript.lcov.reportPaths=./coverage/lcov.info`

Arquivos relacionados:
- `.github/workflows/sonarqube-cloud.yml`
- `sonar-project.properties`

## 5) O status de cobertura do repositório falha (projeto ou patch)

Sintomas:
- A verificação de PR falha na cobertura do projeto e/ou cobertura de patch

Causa:
- cobertura abaixo da meta
- `coverage/lcov.info` está vazio porque um alvo de smoke ou integração substituiu
  o artefato dos testes unitários

Padrão atual:
- statements: `98%`
- linhas: `98%`
- funções: `98%`
- branches: `98%`
- linhas alteradas: `99%`

A autoridade é `ci-cd/check-coverage-thresholds.js` (JUM-681). O registro de exceções `ACCEPTED_BELOW_THRESHOLD` está vazio.

Consertar:

```bash
bun run test:unit
wc -l coverage/lcov.info
bun run test:integration:service-management
wc -l coverage/lcov.info
```

A contagem de linhas do LCOV deve permanecer diferente de zero e inalterada após o
alvo de integração. Runners de integração e smoke devem usar `--coverage=false`;
os testes unitários são a etapa oficial que produz cobertura. Se o LCOV for válido,
mas a cobertura estiver abaixo do limite, adicione ou melhore testes nos caminhos
de código alterados.

Arquivos relacionados:
- `jest.config.js`
- `ci-cd/check-coverage-thresholds.js`
- `ci-cd/check-patch-coverage.js`
- `apps/service-management/scripts/run-service-management-integration.js`

## 6) Os ganchos Husky não estão sendo executados localmente

Sintomas:
- commit/push não aciona verificações de lint/teste

Causa:
- ganchos não instalados (ou repositório clonado recentemente)

Consertar:

```bash
bun run prepare
ls .husky
```

Ganchos esperados neste projeto:
- `pré-commit`
- `pré-push`
- `commit-msg`
- `pós-commit`

## 7) Falha na integração/fumo dependente de Redis

Sintomas:
- erros de conexão/autenticação em testes de integração smoke ou mutex

Causa:
- Redis indisponível ou senha/configuração errada.

Consertar:

```bash
bun run docker:composeredis
bun run ci:smoke
```

Se necessário, verifique as chaves ambientais usadas pelos testes:
- `JUMENTIX_REDIS_PASSWORD`
- `JUMENTIX_JWT_TOKEN_SECRET_KEY`

## 8) `deps:audit` falha localmente em um pacote que o `bun.lock` não resolve mais

Sintomas:
- `pre-commit` ou `pre-push` para em `deps:audit` com advisories `FATAL <pacote>@<versão>`
- o mesmo commit passa no CI, e `grep '<pacote>@<versão>' bun.lock` não encontra nada

Causa:
- `packages/security-scanner/audit.js` audita cada entrada de `node_modules/.bun` — os pacotes realmente instalados, não uma tradução do lockfile. Um checkout que passou para um `dev` mais novo mantém entradas do store da instalação anterior. Uma entrada que o lockfile não resolve mais é órfã: nada a importa, mas o audit ainda a lê. O CI instala do zero, então não tem órfãs.

Consertar (só local; nada muda no repositório):

```bash
bun install --frozen-lockfile
ls node_modules/.bun | grep '^<pacote>@'
```

Se a versão antiga ainda aparecer e o `bun.lock` não a contiver, remova só esse diretório do store e rode o audit de novo:

```bash
rm -rf node_modules/.bun/<pacote>@<versão>
bun run deps:audit
```

Não adicione o advisory a `ACCEPTED_RISK` por causa de uma órfã: a árvore instalada não é afetada. Se o `bun.lock` resolver a versão vulnerável, o achado é real — suba o pin.

## 9) Fluxo rápido de diagnóstico local

Execute esta sequência para isolar rapidamente os estágios do portão com falha:

```bash
bun run lint
bun run deps:check-cycles
bun run arch:check-boundaries
bun run arch:check-users-legacy-imports
bun run test:unit
bun run oas:check-routes
bun run build:dev
bun run ci:smoke
```

Esta é a mesma ordem usada por `bun run ci:gate`.
