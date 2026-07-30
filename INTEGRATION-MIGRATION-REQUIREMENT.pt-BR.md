# Requisito de migração de integrações da aplicação canônica

Tarefa Linear: [JUM-568](https://linear.app/jumentix/issue/JUM-568)

## Requisito

`XpertMinds/Jumentix` deve recriar toda integração aplicável da origem
depreciada `web2solutions/aaa-typescript-boilerplate` antes do arquivamento
dessa origem. Uma integração só está completa quando o vínculo no provedor e a
configuração do repositório estiverem verificados. Checks ausentes, ignorados,
neutros ou apenas configurados não são evidência de sucesso.

## Matriz auditada origem → canônico

| Superfície | Origem depreciada | Destino canônico | Status / evidência |
| --- | --- | --- | --- |
| GitHub Actions: Run branch-aware tests | ativo | ativo | `build (22.x, 7.2)` bem-sucedido em PRs para `dev` |
| GitHub Actions: SonarQube Cloud | ativo | ativo | workflow registrado; scan exige `SONAR_TOKEN` |
| GitHub Actions: Jumentix website quality | ativo | ativo | `storybook` bem-sucedido em PRs do website |
| Secrets do Actions | `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD` | mesmos nomes com placeholders de CI | paridade de nomes; valores nunca logados |
| Variáveis do Actions | nenhuma | nenhuma | inventário vazio |
| Environments | `env vars`, `secrets` (vazios) | `env vars`, `secrets` (vazios) | paridade de nomes |
| Dependabot Updates | ativo (GitHub) | habilitado via `.github/dependabot.yml` | caminho Dependabot disponível |
| Repository webhooks | 2 ativos | vínculos de GitHub App/webhook pertencentes aos provedores recriados | Apps CircleCI, Codecov, Snyk, GitGuardian, Cursor, Sonar e Vercel autorizados; checks exclusivos de PR pendentes |
| Projeto CircleCI | legado | projeto `95b034cf-dd83-4407-be64-108d63263ed8` segue `XpertMinds/Jumentix` | pipelines 2, 3 e 4 passaram `test-source` no SHA canônico `19af3a52` |
| Codecov | checks no legado | GitHub App autorizado, repositório ativo e token rotacionado armazenado no GitHub e CircleCI | pipeline CircleCI autenticado passou; checks de projeto/patch na PR pendentes |
| Projeto SonarQube Cloud | `web2solutions_aaa-typescript-boilerplate` | `xpertminds` / `XpertMinds_Jumentix` | quality gates do baseline e da PR #9 passaram com zero issues ou hotspots novos |
| Snyk | badge/checks no legado | organização/configurações/políticas XpertMinds, GitHub App para todos os repositórios, projetos canônicos dos pacotes e novo token de 90 dias | `security/snyk` da PR #9 passou com zero issues |
| GitGuardian | checks no legado | os cinco repositórios XpertMinds monitorados; scan de histórico concluído; checks bloqueantes ativos | check terminal na PR ainda pendente |
| Cursor Bugbot | checks no legado | 5/5 repositórios XpertMinds habilitados, incluindo os dois Jumentix | `Cursor Bugbot` da PR #9 passou |
| Vercel (website) | vínculo legado | GitHub App da Vercel autorizado para todos os repositórios XpertMinds | **owner-auth blocker / bloqueio de plano pago**: Hobby rejeita vínculo a repositório privado de organização; aprovação explícita de Pro necessária |
| Proteção de branch | legado (Pro) | indisponível no plano privado atual | **bloqueio owner-auth**: GitHub Pro/Team |

A migração de integrações do registry é governada separadamente por JUM-569.

## Configuração do repositório que deve permanecer canônica

- `package.json` `homepage` / `bugs.url` → `XpertMinds/Jumentix`
- bootstrap do `packages/cli-init` → `XpertMinds/Jumentix.git`
- `.agents/registry-source.json` → `XpertMinds/jumentix-agent-registry`
- avisos canônicos em README/docs → Requisitos `103` / `104`
- badges CircleCI / Codecov / Snyk → `XpertMinds/Jumentix`

## Enforcement

- `pnpm run integration-migration:check` valida este contrato.
- `pnpm run ci:gate:strict` inclui a célula de migração de integrações.
- Bypass de contagem de review é permitido; CI, governance, hooks, coverage e
  security não podem ser contornados.
- A origem depreciada só é arquivada após este requisito e o PR final de freeze.

## Registro de verificação

- Data da auditoria: `2026-07-30`
- Origem depreciada: `web2solutions/aaa-typescript-boilerplate`
- Destino canônico: `XpertMinds/Jumentix`
- Visibilidade: private
- Secrets recriados (somente nomes): `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD`
- Environments recriados (nomes): `env vars`, `secrets`
- A autenticação dos provedores está completa; o vínculo Git da Vercel e a
  proteção de branches privadas no GitHub exigem planos pagos, enquanto checks
  terminais de PR continuam obrigatórios e registrados acima
