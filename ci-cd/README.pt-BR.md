# `ci-cd/` — gates e runners do monorepo

Raiz do tooling de CI/CD do repositório (Requisito 137).

## Layout

| Caminho | Responsabilidade |
| --- | --- |
| `ci-cd/*.js` | Gates monorepo, runners, test-map, checks de release e governança |
| `ci-cd/lib/` | Helpers compartilhados desses gates |
| `ci-cd/test/` | Suites de prova dos scripts acima |
| `ci-cd/ownership-placement-allowlist.json` | Registro shrink-only da dívida do Req 137 (estado estável: `[]`) |

Scripts específicos de componente **não** ficam aqui. Pertencem a
`apps/<A>/scripts/`, `packages/<P>/scripts/` ou `bin/`. O `package.json` raiz
mantém cada nome público de script e delega para o caminho dono.

## Gate de colocação de ownership

```bash
bun run arch:check-ownership-placement
```

Executa `ci-cd/check-workspace-ownership-placement.js`. Ver
[TESTING-CI-AND-QUALITY.pt-BR.md](../documentation/md/TESTING-CI-AND-QUALITY.pt-BR.md)
e o Requisito
[137](../.agents/requirements/software/137-workspace-suite-and-tooling-ownership.md).
