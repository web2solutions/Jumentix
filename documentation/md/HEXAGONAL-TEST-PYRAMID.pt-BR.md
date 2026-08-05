# Pirâmide de Testes Hexagonal — gates por camada (Bun local, Node só no CI)

## Resultado

Testes rápidos alinhados à arquitetura:

- **Localmente, todos os tipos de suite rodam no Bun** (`bun test` / `bun run test*`) — unit, integration, smoke, contract e verificação de workspaces (Requisito `106`).
- **Node/Jest é exclusivo do CI**, via `JUMENTIX_TEST_RUNTIME=node`, `CI=true` ou scripts `*:ci`.
- Branches de tarefa rodam só as suites das camadas afetadas e do blast radius para fora.
- Deixar jobs remotos de CI verdes **está fora do escopo** deste projeto; o contrato e os entry points são entregues aqui.

Requisitos:

- `.agents/requirements/software/105-hexagonal-test-pyramid-layer-aware-gates.md`
- `.agents/requirements/software/106-local-bun-all-tests-node-ci-only.md`

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

### Kinds não-hexagonais (JUM-552)

Nem tudo no repositório tem camadas hexagonais. Código fora de módulos é registrado como camada declarada `kind: "non-hexagonal"` em vez de ser forçado no modelo de seis camadas:

- `tooling` — `ci-cd/`, `tooling/`, o website, configuração de pipeline.
- `service-management/server` — `apps/service-management/server.js` + `package.json`; depende de `contracts`.
- `service-management/designer` — o SPA designer (`script.js`, `src/**`, assets estáticos); depende de `service-management/server`, que o serve e responde à sua runtime API.

Consequências para o seletor (JUM-472): uma mudança em `apps/service-management/**` seleciona exatamente as suites SM (unit + o smoke `test:integration:service-management`), uma mudança só no designer pula as suites do server, e uma mudança nos artefatos de contrato canônicos em `spec/` (registrados em `contracts`) alcança as suites de paridade de contrato do SM por dependências reversas. Os globs das camadas são enumerados, não coringa: um arquivo novo na raiz do app não mapeia para camada alguma e deixa o gate vermelho até ser classificado em `ci-cd/generate-test-map.js`. Novas suites de integração SM são registradas nomeando sua área em `SERVICE_MANAGEMENT_INTEGRATION_AREA` e regenerando o mapa.

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
