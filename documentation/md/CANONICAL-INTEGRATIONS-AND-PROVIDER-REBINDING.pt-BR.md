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

## Estado da migração (2026-07-30)

| Área | Estado verificado | Ação restante |
| --- | --- | --- |
| Configurações do repositório/branches GitHub | Actions usa permissão padrão somente leitura; aprovação de PR por workflow está desativada; política de merge, issues, discussions, labels, tópicos, ambientes e eventos do hook CircleCI correspondem ao repositório legado da aplicação | A permissão de fork privado não pode ser copiada porque a organização XpertMinds proíbe forks privados; proteção de branch/rulesets não está disponível no plano atual de repositório privado tanto na origem quanto no destino |
| Segurança GitHub | Alertas de vulnerabilidade, correções automáticas e a configuração rastreada do Dependabot estão ativos | Observar a primeira atualização canônica do Dependabot |
| CircleCI | `XpertMinds/Jumentix` está seguido, orbs públicos não certificados estão permitidos para o contrato Codecov copiado e os pipelines 2, 3 e 4 passaram `test-source` no SHA canônico `19af3a52` | Observar o check do provedor na próxima PR canônica de tarefa |
| Segredos do repositório | `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD` e o dedicado `AGENT_REGISTRY_TOKEN` existem por nome | Validar seus consumidores sem expor valores; rotacionar a credencial do registro conforme a política do owner |
| Ambientes GitHub | `env vars` e `secrets` existem; um novo `SNYK_TOKEN` com validade de 90 dias está armazenado em `secrets` | Validar o consumidor do ambiente na próxima PR canônica de tarefa |
| SonarQube Cloud | Organização `xpertminds`, projeto `XpertMinds_Jumentix`, autorização do GitHub App e `SONAR_TOKEN` estão ativos; o quality gate canônico passou com 100% de cobertura em código novo e zero issues novas | Observar o mesmo scan fail-closed na próxima PR canônica de tarefa |
| Snyk | A organização `XpertMinds` copiou configurações, integrações e políticas legadas; o GitHub App está autorizado para todos os repositórios; o import de `XpertMinds/Jumentix` criou os projetos dos pacotes; e um novo token de 90 dias está no ambiente `secrets` | Observar um check terminal `security/snyk` na PR |
| Codecov | O GitHub App está autorizado para todos os repositórios XpertMinds, `XpertMinds/Jumentix` está ativo e o token rotacionado está armazenado no GitHub e CircleCI; o pipeline CircleCI autenticado 4 passou | Produzir checks terminais `codecov/project` e `codecov/patch` na PR canônica |
| GitGuardian | O GitHub App está autorizado para todos os repositórios XpertMinds e a origem XpertMinds está vinculada com scan automático de histórico e checks bloqueantes de PR ativos | Observar resultado terminal de `GitGuardian Security Checks` na PR canônica |
| Cursor Bugbot | XpertMinds mostra 5/5 repositórios habilitados, incluindo os dois repositórios Jumentix, com Bugbot disparado a cada push | Observar resultado terminal do Cursor Bugbot na PR canônica |
| Vercel | O GitHub App está autorizado para todos os repositórios XpertMinds; o projeto `jumentix-website` existe e seu último deploy manual de produção está `READY` | O vínculo Git ao repositório privado da organização é rejeitado no Hobby; é necessária aprovação explícita de plano Pro pago, e nenhum trial ou compra foi iniciado |

Checks de provedores que só executam em PR continuam incompletos até que a
evidência terminal seja anexada à JUM-568 no Linear. O vínculo Git da Vercel e
a proteção de branches de repositório privado no GitHub também permanecem
bloqueados por aprovação explícita de planos pagos. Este estado não constitui
aprovação final da migração dos provedores.

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
