# Integrações canônicas e revinculação de provedores

`XpertMinds/Jumentix` é o repositório público canônico da aplicação. Migrar um
provedor significa criar um novo vínculo no provedor para este repositório e
observar um check ou deploy terminal. Copiar um webhook legado, ignorar uma
análise ou manter uma chave de projeto legada não é evidência aprovada.

## Inventário da origem para o canônico

| Integração | Evidência legada | Contrato canônico | Evidência de conclusão |
| --- | --- | --- | --- |
| GitHub Actions | workflows de testes, website e Sonar | Mesmos workflows rastreados em `XpertMinds/Jumentix` | Execuções obrigatórias terminam com sucesso |
| CircleCI | pipeline `test-source` e webhook GitHub | Projeto e webhook canônicos; somente `dev` e `main` | `ci/circleci: test-source` passa no SHA canônico |
| Codecov | orb CircleCI e checks de projeto/patch | Repositório Codecov canônico com metas de 95% | `codecov/project` e `codecov/patch` passam |
| SonarQube Cloud | projeto legado `web2solutions_aaa-typescript-boilerplate` | `xpertminds` / `XpertMinds_Jumentix`; token obrigatório; sem análise ignorada | `SonarQube Cloud Scan` executa o scanner e passa |
| Scanner de dependências OSV | ausência de cobertura completa do lockfile Bun | Scanner próprio resolve a árvore Bun instalada e consulta OSV.dev | `bun run deps:audit` passa no gate canônico |
| GitGuardian | check do GitHub App | Instalação GitGuardian autorizada para o repositório público canônico; checks de PR no mesmo repositório disponíveis | `GitGuardian Security Checks` passa em PRs do mesmo repositório |
| Cursor Bugbot | check do GitHub App | Instalação Cursor autorizada para o repositório público canônico | `Cursor Bugbot` termina com sucesso |
| Vercel | projeto `jumentix-website` e deploy de produção | Conexão Git alterada para `XpertMinds/Jumentix`, raiz `apps/jumentix-website` | Deploy Git canônico alcança `READY` |
| Dependabot | workflow nativo de atualizações | `.github/dependabot.yml` aponta npm e GitHub Actions para `dev` | Configuração é aceita e atualizações podem executar |
| Segredos GitHub | `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD` | Mesmos nomes, valores recriados com segurança | Inventário existe e workflows consomem os segredos |
| Ambientes | `env vars`, `secrets` | Mesmos ambientes; credenciais de provedores criadas com segurança | Inventário e checks dos provedores concordam |
| Variáveis | Nenhuma variável de repositório ou ambiente | Nenhuma variável, salvo identificador não secreto exigido | Inventário permanece explícito |
| Webhooks | CircleCI e callbacks legados de provedores | Somente hooks necessários pertencentes aos provedores para o repositório canônico | Alvos dos hooks e checks são canônicos |

## Estado da migração (2026-07-30)

| Área | Estado verificado | Ação restante |
| --- | --- | --- |
| Configurações do repositório/branches GitHub | Actions usa permissão padrão somente leitura; aprovação de PR por workflow está desativada; política de merge, issues, discussions, labels, tópicos, ambientes e eventos do hook CircleCI correspondem ao repositório legado; a visibilidade do destino é pública no Team | Proteção de branch/rulesets deve ser configurada em `dev` e `main` (ainda não observada); faturamento/minutos do Actions permanece bloqueio owner-auth se não pago ou esgotado |
| Segurança GitHub | Alertas de vulnerabilidade, correções automáticas e a configuração rastreada do Dependabot estão ativos | Observar a primeira atualização canônica do Dependabot |
| CircleCI | `XpertMinds/Jumentix` está seguido, orbs públicos não certificados estão permitidos para o contrato Codecov copiado e a reexecução fail-closed do pipeline 6 passou `test-source` no SHA canônico `68d785a4` | Continuar aplicando o pipeline canônico em `dev` e `main` |
| Segredos do repositório | `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD` e o dedicado `AGENT_REGISTRY_TOKEN` existem por nome | Validar seus consumidores sem expor valores; rotacionar a credencial do registro conforme a política do owner |
| Ambientes GitHub | `env vars` e `secrets` existem; o scan de dependências não exige token de provedor | Validar consumidores dos ambientes em PRs canônicas |
| SonarQube Cloud | Organização `xpertminds`, projeto `XpertMinds_Jumentix`, autorização do GitHub App e `SONAR_TOKEN` estão ativos; os quality gates do baseline e da PR #10 passaram com zero issues ou hotspots novos | Continuar aplicando o scan fail-closed nas PRs canônicas |
| Scanner de dependências OSV | O scanner próprio resolve o grafo de dependências Bun instalado e consulta OSV.dev em modo fail-closed | Continuar aplicando `bun run deps:audit` no gate canônico |
| Codecov | O GitHub App está autorizado para todos os repositórios XpertMinds; o token do repositório foi regenerado e sincronizado no GitHub e CircleCI; o pipeline 6 passou o upload fail-closed; e o Codecov registrou o commit `68d785a4` como `CI Passed` com 99,24% de cobertura do projeto | `codecov/project` e `codecov/patch` não apareceram na PR #10; status de projeto/patch permanece incompleto até haver evidência terminal (Codecov Team ainda pode ser necessário conforme limites do produto) |
| GitGuardian | O GitHub App está autorizado para os cinco repositórios XpertMinds; `Jumentix` está monitorado; o scan automático de histórico foi concluído; checks de PR no mesmo repositório estão disponíveis no repositório público | Check runs em repositórios forkados ainda exigem GitGuardian Business; não tratar cobertura de forks como completa sem Business |
| Cursor Bugbot | XpertMinds mostra 5/5 repositórios habilitados, incluindo os dois repositórios Jumentix, com Bugbot disparado a cada push; `Cursor Bugbot` da PR #10 passou | Continuar aplicando o check terminal do Cursor Bugbot |
| Vercel | O GitHub App está autorizado para todos os repositórios XpertMinds; o projeto `jumentix-website` existe e seu último deploy manual de produção está `READY` | Vínculo Git pendente de reautenticação no repositório público; Hobby pode funcionar agora—conclua a reautenticação e registre um deploy Git que alcance `READY` |
| Faturamento GitHub Actions | Workflows Actions do repositório público estão registrados | O owner deve manter faturamento/minutos do Actions financiados; billing ausente ou esgotado falha fechado e não é evidência de sucesso |

A evidência terminal dos provedores está anexada à JUM-568 no Linear. Os
bloqueios verdadeiros restantes no destino público falham fechado até haver
evidência terminal: autoridade de faturamento/minutos do GitHub Actions,
reautenticação Git da Vercel mais deploy Git `READY`, configuração de proteção
de branch/checks obrigatórios, status de projeto/patch do Codecov onde ainda
incompleto, e GitGuardian Business somente para check runs em forks. Este estado
não constitui aprovação final da migração dos provedores.

## Regras fail-closed

1. Valores secretos nunca são copiados do repositório legado.
2. `SONAR_TOKEN`, credenciais Codecov/Vercel e autorizações OAuth
   são recriados por seus provedores.
3. Token ausente, app sem autorização, check ausente, análise ignorada,
   execução cancelada, timeout ou vínculo legado é trabalho incompleto.
4. Review é opcional. Todos os demais gates de CI, cobertura, segurança,
   governança e resolução de conversas continuam obrigatórios.
5. Bloqueios externos são registrados no Linear JUM-568 e nos Project Updates
   com a ação exata exigida do proprietário.

## Validação pertencente ao repositório

Execute:

```bash
bun run integrations:check
```

O check valida identificadores canônicos do Sonar, execução fail-closed do
scanner, vínculo autenticado ao Agent Registry privado (o repositório do registry permanece privado), contratos
CircleCI/Codecov, scanner OSV.dev, configuração Dependabot e este inventário
bilíngue. Ele é uma célula obrigatória da matriz strict.

## Sequência de autorização

1. Autorize o GitHub App/OAuth de cada provedor para o repositório público
   `XpertMinds/Jumentix`.
2. Crie ou importe o projeto canônico; nunca reutilize uma chave que aponta para
   `web2solutions/aaa-typescript-boilerplate`.
3. Recrie credenciais nos cofres do GitHub/provedor sem imprimi-las.
4. Dispare um PR ou validação do provedor.
5. Registre a URL terminal no Linear JUM-568.

## Rollback

Vínculos podem ser removidos individualmente enquanto a configuração rastreada
é revertida por PR governado para `dev`. O repositório legado permanece
arquivado e não é destino de rollback.
