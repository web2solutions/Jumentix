# Integrações canônicas e revinculação de provedores

`XpertMinds/Jumentix` é o repositório privado canônico da aplicação. Migrar um
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
| Snyk | integração GitHub, webhook e segredo de ambiente `SNYK_TOKEN` legados | Novo projeto e webhook Snyk canônicos; token recriado com segurança | `security/snyk` passa no PR canônico |
| GitGuardian | check do GitHub App | Instalação GitGuardian autorizada para o repositório privado canônico | `GitGuardian Security Checks` passa |
| Cursor Bugbot | check do GitHub App | Instalação Cursor autorizada para o repositório privado canônico | `Cursor Bugbot` termina com sucesso |
| Vercel | projeto `jumentix-website` e deploy de produção | Conexão Git alterada para `XpertMinds/Jumentix`, raiz `apps/jumentix-website` | Deploy Git canônico alcança `READY` |
| Dependabot | workflow nativo de atualizações | `.github/dependabot.yml` aponta npm e GitHub Actions para `dev` | Configuração é aceita e atualizações podem executar |
| Segredos GitHub | `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD` | Mesmos nomes, valores recriados com segurança | Inventário existe e workflows consomem os segredos |
| Ambientes | `env vars`, `secrets`; `SNYK_TOKEN` legado em `secrets` | Mesmos ambientes; novas credenciais criadas com segurança | Inventário e checks dos provedores concordam |
| Variáveis | Nenhuma variável de repositório ou ambiente | Nenhuma variável, salvo identificador não secreto exigido | Inventário permanece explícito |
| Webhooks | CircleCI e Snyk | Novos hooks pertencentes aos provedores para o repositório canônico | Alvos dos hooks e checks são canônicos |

## Estado da migração (2026-07-29)

| Área | Estado verificado | Ação restante |
| --- | --- | --- |
| Configurações do repositório/branches GitHub | Actions usa permissão padrão somente leitura; aprovação de PR por workflow está desativada; política de merge, issues, discussions, labels, tópicos, ambientes e eventos do hook CircleCI correspondem ao repositório legado da aplicação | A permissão de fork privado não pode ser copiada porque a organização XpertMinds proíbe forks privados; proteção de branch/rulesets não está disponível no plano atual de repositório privado tanto na origem quanto no destino |
| Segurança GitHub | Alertas de vulnerabilidade e correções automáticas estão ativos | Observar o Dependabot após esta configuração chegar a `dev` |
| CircleCI | Novo webhook GitHub ativo envia eventos do repositório canônico ao CircleCI | Um owner da organização deve entrar no CircleCI, seguir `XpertMinds/Jumentix` e produzir o check canônico `test-source` |
| Segredos do repositório | `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD` e o dedicado `AGENT_REGISTRY_TOKEN` existem por nome | Validar seus consumidores sem expor valores; rotacionar a credencial do registro conforme a política do owner |
| Ambientes GitHub | `env vars` e `secrets` existem | Recriar `SNYK_TOKEN` em `secrets` por um novo projeto Snyk autorizado |
| SonarQube Cloud | A configuração rastreada usa `xpertminds` / `XpertMinds_Jumentix` e falha sem `SONAR_TOKEN` | Um owner deve autorizar o repositório privado, criar/importar o projeto canônico e criar `SONAR_TOKEN` com segurança |
| Snyk | A política está rastreada; o hook legado específico do provedor não foi copiado | Um owner deve autorizar/importar o repositório privado canônico, criar novo hook e criar `SNYK_TOKEN` com segurança |
| Codecov | O orb CircleCI e a política de 95% estão rastreados | Um owner deve ativar o repositório privado canônico e produzir checks de projeto/patch |
| GitGuardian | Nenhum check terminal canônico foi observado | Um owner deve conceder ao GitHub App acesso ao repositório privado canônico |
| Cursor Bugbot | Nenhum check terminal canônico foi observado | Um owner deve conceder ao GitHub App acesso ao repositório privado canônico |
| Vercel | O projeto `jumentix-website` existe e o último deploy de produção está `READY` | Um owner deve conceder acesso ao GitHub App da Vercel e vincular o projeto a `XpertMinds/Jumentix` em `apps/jumentix-website` |

Itens que exigem autenticação do owner no provedor continuam incompletos até que
a evidência terminal seja anexada à JUM-568 no Linear. Este estado não constitui
aprovação da migração dos provedores.

## Regras fail-closed

1. Valores secretos nunca são copiados do repositório legado.
2. `SONAR_TOKEN`, `SNYK_TOKEN`, credenciais Codecov/Vercel e autorizações OAuth
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
pnpm run integrations:check
```

O check valida identificadores canônicos do Sonar, execução fail-closed do
scanner, vínculo autenticado ao Agent Registry privado, contratos
CircleCI/Codecov, política Snyk, configuração Dependabot e este inventário
bilíngue. Ele é uma célula obrigatória da matriz strict.

## Sequência de autorização

1. Autorize o GitHub App/OAuth de cada provedor para o repositório privado
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
