# Requisito de Integracao da Aplicacao Canonica

Tarefa Linear: [JUM-568](https://linear.app/jumentix/issue/JUM-568)

## Requisito

`web2solutions/Jumentix` e responsavel por cada vinculo de provedor aplicavel.
Uma integracao obrigatoria esta completa somente quando a configuracao do
repositorio e o vinculo no provedor produzem evidencia terminal. Checks
ausentes, ignorados, neutros ou apenas configurados nao sao evidencia de sucesso.

## Contrato atual de provedores

| Superficie | Contrato canonico |
| --- | --- |
| GitHub Actions | CI canonico por branch em runners Node 22 hospedados pelo GitHub com comandos Bun. |
| CircleCI | Espelho publico secundario de CI com o mesmo classificador de contexto e politica de gates. |
| Codecov e SonarQube Cloud | Visibilidade publica para evidencias de cobertura pertencentes ao repositorio. |
| OSV.dev | Auditoria propria da arvore instalada por `bun run deps:audit`. |
| Dependabot, Vercel, webhooks, environments | Configuracoes pertencentes ao repositorio vinculadas ao repositorio publico canonico quando aplicavel. |

## Configuracao pertencente ao repositorio

- Homepage e URL de issues em `package.json` apontam para `web2solutions/Jumentix`.
- `packages/cli-init` clona `web2solutions/Jumentix.git`.
- CircleCI e Codecov usam o slug `web2solutions/Jumentix`.
- Firestore e a fonte de verdade para coordenacao de agentes pelo Requisito `089`.

## Enforcement

- `bun run integration-migration:check` valida marcadores do repositorio canonico.
- `bun run integrations:check` valida configuracao de provedores e comportamento fail-closed.
- Evidencias historicas de migracao estao resumidas em
  `documentation/md/HISTORICAL-TRANSITIONS.pt-BR.md` e nao sao politica operacional.

