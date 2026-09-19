# Transicoes Historicas

Este e o unico resumo de auditoria no repositorio para materiais retirados da
orientacao ativa do Jumentix. Ele registra por que uma fonte foi retirada e
onde estao as instrucoes atuais. Nao e um runbook operacional, fonte de
planejamento ou checklist de entrega.

| Topico retirado | Material anterior | Autoridade atual | Evidencia da transicao |
| --- | --- | --- | --- |
| Fluxo interno Node/pnpm | Requisitos `001`, `012`, `048`; pesquisa de baseline Bun | Requisito `096`, `bun.lock`, `.bun-version`, scripts do package | Bun `1.3.13` esta fixado; `bun.lock` esta versionado; lockfiles pnpm estao ausentes. Node 22 permanece apenas para compatibilidade e limites de ferramentas declarados. |
| GitHub Project e TODO local | Requisitos `056`, `064`; `.agents/project-todos.md` | Requisito `095` e Linear | Linear controla planejamento, status de entrega, estimativas e rastreabilidade de PR. |
| Ponte de CI hospedado | Requisitos `014`, `107` | Requisito `113`, `.github/workflows/ci.yml`, `.circleci/config.yml` | GitHub Actions e canonico; CircleCI e o espelho publico secundario; gates de cobertura do repositorio permanecem autoritativos. |
| Migracao de repositorio e cutover Wave 5 | Requisitos `103`, `123`; planos, inventarios e snapshots da Wave 5 | Requisito `124`, layout atual `apps/*` e `packages/*`, `documentation/md/CANONICAL-REPOSITORY-MIGRATION.md` | `web2solutions/Jumentix` e o repositorio canonico e o layout monorepo esta implementado. Links para repositorios antigos sao apenas evidencia historica. |

Os arquivos removidos podem ser recuperados pelo historico Git. Entradas do
changelog gerado e `.agents/AGENT-REGISTRY.md` permanecem artefatos de auditoria
imutaveis separados e ficam intencionalmente fora desta consolidacao.
