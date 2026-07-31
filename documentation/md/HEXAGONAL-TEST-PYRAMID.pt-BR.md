# Pirâmide de Testes Hexagonal — gates por camada (Bun local, Node só no CI)

## Resultado

Testes rápidos alinhados à arquitetura:

- **Localmente, todos os tipos de suite rodam no Bun** (`bun test` / `bun run test*`) — unit, integration, smoke, contract e verificação de workspaces (Requisito `106`).
- **Node/Jest é exclusivo do CI**, via `JUMENTIX_TEST_RUNTIME=node`, `CI=true` ou scripts `*:ci`.
- Branches de tarefa rodam só as suites das camadas afetadas e do blast radius para fora.
- Deixar jobs remotos de CI verdes **está fora do escopo** deste projeto; o contrato e os entry points são entregues aqui.

Requisitos:

- `.agents/requirements/105-hexagonal-test-pyramid-layer-aware-gates.md`
- `.agents/requirements/106-local-bun-all-tests-node-ci-only.md`

## Manifesto

`test-map.json` é a fonte de verdade:

| Campo | Significado |
| --- | --- |
| `layers.*.dependsOn` | Dependências hexagonais para dentro |
| `suites[].runner` | Runner **local** — sempre `bun` (Req 106) |
| `suites[].ciRunner` | Runner opcional de CI (`node` quando o Jest ainda é necessário remotamente) |
| `suites[].tier` | `gate` ou `nightly` |
| `quarantine[]` | Exceções explícitas com issue Linear |

```bash
bun run test-map:check
bun run test-map:generate
```

## DX local (Bun)

```bash
bun run test
bun run test:unit
bun run test:integration:express
bun run test:contract
bun run tdd
bun run tdd:domain
bun run workspace:test
```

Forçar o caminho Node de CI só para depuração:

```bash
JUMENTIX_TEST_RUNTIME=node bun run test:integration:express
bun run test:integration:express:ci
```

## Gate de tarefa

`bun run ci:gate:task` usa o seletor v2 quando `JUMENTIX_GATE_V2` está unset/true.

Rollback: `JUMENTIX_GATE_V2=0`. Shadow: `JUMENTIX_GATE_V2_SHADOW=1`.

## Tier nightly

Suites pesadas (`mutex`, redis-streams, DB smoke) usam `tier: "nightly"` (`bun run test:nightly`). O agendamento no GitHub Actions é escopo de operações de CI.

## Anti-false-green

- Plano vazio para change set não vazio → falha.
- Suite planejada ausente do resultado → falha.
- `skipped` / `pending` → não é verde.
- Pacotes sem unit tests declaram `jumentix.testSurface=typecheck-only`.
