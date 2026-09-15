# Requisito de migração de integrações da aplicação canônica

Tarefa Linear: [JUM-568](https://linear.app/jumentix/issue/JUM-568)

## Requisito

`web2solutions/Jumentix` deve recriar toda integração aplicável da origem
depreciada `web2solutions/aaa-typescript-boilerplate` antes do arquivamento
dessa origem. Uma integração só está completa quando o vínculo no provedor e a
configuração do repositório estiverem verificados. Checks ausentes, ignorados,
neutros ou apenas configurados não são evidência de sucesso.

## Matriz auditada origem → canônico

| Superfície | Origem depreciada | Destino canônico | Status / evidência |
| --- | --- | --- | --- |
| GitHub Actions: Run branch-aware tests | ativo | ativo | `ci.yml` roda em runners GitHub-hosted Node 22 com gates por branch |
| GitHub Actions: SonarQube Cloud | ativo | ativo | workflow registrado; scan exige `SONAR_TOKEN` nos contextos de cobertura completa |
| GitHub Actions: Jumentix website quality | ativo | ativo | `storybook` bem-sucedido em PRs do website |
| Secrets do Actions | `JUMENTIX_JWT_TOKEN_SECRET_KEY`, `JUMENTIX_REDIS_PASSWORD` | `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD`, `CODECOV_TOKEN`, `SONAR_TOKEN`, `LINEAR_API_KEY`, `AGENT_REGISTRY_TOKEN` | inventário de nomes verificado; valores nunca logados |
| Variáveis do Actions | toggles opcionais de provider | toggles opcionais de provider | `JUMENTIX_ENABLE_SONAR` controla a execução do Sonar |
| Environments | `env vars`, `secrets` (vazios) | `env vars`, `secrets` (vazios) | paridade de nomes |
| Dependabot Updates | ativo (GitHub) | habilitado via `.github/dependabot.yml` | caminho Dependabot disponível |
| Repository webhooks | callbacks de provedores | vínculos necessários de GitHub App/webhook pertencentes aos provedores recriados | Apps CircleCI, Codecov, GitGuardian, Cursor, Sonar e Vercel autorizados; checks exclusivos de PR pendentes |
| Projeto CircleCI | legado | `web2solutions/Jumentix` | `.circleci/config.yml` restaurado com o mesmo classificador de contexto e badges públicos por branch |
| Codecov | checks no legado | `web2solutions/Jumentix` | job completo de cobertura envia LCOV após os thresholds do repositório passarem |
| Projeto SonarQube Cloud | `web2solutions_aaa-typescript-boilerplate` | `web2solutions` / `web2solutions_Jumentix` | scanner e badges apontam para a chave pública canônica |
| Scanner de dependências OSV | cobertura legada incompleta das dependências | scanner próprio da árvore instalada apoiado por OSV.dev | `bun run deps:audit` integra o gate fail-closed |
| GitGuardian | checks no legado | visibilidade externa opcional | Gitleaks/Semgrep fixados são a evidência obrigatória de review third-party |
| Cursor Bugbot | checks no legado | visibilidade externa opcional | não é check obrigatório porque estados de cota/pulado não são terminais |
| Vercel (website) | vínculo legado | superfície opcional de deploy | build e prepublish do website continuam obrigatórios antes de release |
| Proteção de branch | legado (Pro) | rulesets públicos do GitHub | `dev` tem checks baratos; `main` tem checks completos |

A migração de integrações do registry é governada separadamente por JUM-569.

## Configuração do repositório que deve permanecer canônica

- `package.json` `homepage` / `bugs.url` → `web2solutions/Jumentix`
- bootstrap do `packages/cli-init` → `web2solutions/Jumentix.git`
- `.agents/registry-source.json` → `XpertMinds/jumentix-agent-registry`
- avisos canônicos em README/docs → Requisitos `103` / `104`
- badges CircleCI / Codecov → `web2solutions/Jumentix`

## Enforcement

- `bun run integration-migration:check` valida este contrato.
- `bun run ci:gate:strict` inclui a célula de migração de integrações.
- Bypass de contagem de review é permitido; CI, governance, hooks, coverage e
  security não podem ser contornados.
- A origem depreciada só é arquivada após este requisito e o PR final de freeze.

## Registro de verificação

- Data da auditoria: `2026-07-30`
- Origem depreciada: `web2solutions/aaa-typescript-boilerplate`
- Destino canônico: `web2solutions/Jumentix`
- Visibilidade: public
- Secrets recriados (somente nomes): `AAA_JWT_TOKEN_SECRET_KEY`,
  `AAA_REDIS_PASSWORD`, `AGENT_REGISTRY_TOKEN`, `CODECOV_TOKEN`,
  `LINEAR_API_KEY`, `SONAR_TOKEN`
- A autenticação dos provedores está completa para execução pública de GitHub
  Actions, CircleCI, Codecov e SonarQube Cloud. Provedores externos opcionais
  podem adicionar visibilidade, enquanto checks terminais de PR continuam
  obrigatórios e registrados acima.
