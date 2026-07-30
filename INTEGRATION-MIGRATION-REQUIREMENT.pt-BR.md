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
| Repository webhooks | 2 ativos | nenhum ainda | **owner-auth blocker** / bloqueio owner-auth: recriar callbacks Codecov/CircleCI/GitGuardian |
| Projeto CircleCI | legado | badge aponta para `XpertMinds/Jumentix` | **bloqueio owner-auth**: vincular projeto CircleCI |
| Codecov | checks no legado | `codecov.yml` presente | **bloqueio owner-auth**: instalar app Codecov |
| Projeto SonarQube Cloud | `web2solutions_aaa-typescript-boilerplate` | chave legada transitória | **bloqueio owner-auth**: criar projeto SonarCloud para `XpertMinds/Jumentix` |
| Snyk | badge/checks no legado | badge canônico | **bloqueio owner-auth**: vincular Snyk |
| GitGuardian | checks no legado | não observado no canônico | **bloqueio owner-auth**: instalar GitGuardian |
| Cursor Bugbot | checks no legado | não observado no canônico | **bloqueio owner-auth**: habilitar Bugbot no privado |
| Vercel (website) | vínculo legado | docs já descrevem caminho XpertMinds | **bloqueio owner-auth**: rebind do projeto Vercel |
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

- Data da auditoria: `2026-07-29`
- Origem depreciada: `web2solutions/aaa-typescript-boilerplate`
- Destino canônico: `XpertMinds/Jumentix`
- Visibilidade: private
- Secrets recriados (somente nomes): `AAA_JWT_TOKEN_SECRET_KEY`, `AAA_REDIS_PASSWORD`
- Environments recriados (nomes): `env vars`, `secrets`
- Instalações restantes de provedores exigem autorização do owner e estão
  registradas acima como bloqueios explícitos
