# Pirâmide de Testes Hexagonal — unit Bun + integração Node + gates por camada

## Resultado

Testes rápidos e confiáveis que espelham a arquitetura hexagonal:

- Suítes **unitárias** rodam no **Bun** (`bun:test`) por velocidade.
- Suítes de **integração / smoke / plataforma** rodam em **Node 22 + Jest** por compatibilidade.
- Branches de feature/tarefa executam apenas as suítes das camadas alteradas e do raio de explosão para fora.
- `dev` executa o gate unitário completo; `main` executa a matriz completa.

Requisito: `.agents/requirements/105-hexagonal-test-pyramid-layer-aware-gates.md`.

## Manifesto

`test-map.json` é a fonte de verdade legível por máquina:

| Campo | Significado |
| --- | --- |
| `layers.*.dependsOn` | Dependências hexagonais para dentro |
| `layers.*.sourceGlobs` | Predicados de posse de código-fonte |
| `suites[]` | Cada arquivo de teste executável, com `layer`, `type`, `runner`, `tier` |
| `quarantine[]` | Exceções explícitas com referência Linear |
| `flags.gateV2Env` | `JUMENTIX_GATE_V2` (ligado por padrão) |

Validar com:

```bash
bun run test-map:check
```

Regenerar após adicionar suítes:

```bash
bun run test-map:generate
bun run test-map:check
```

## Gate de tarefa consciente de camada

`bun run ci:gate:task` usa o seletor v2 quando `JUMENTIX_GATE_V2` está ausente/true.

Algoritmo:

1. Ler arquivos alterados (`staged` ou `range` via `JUMENTIX_TASK_TEST_MODE`).
2. Resolver dependentes com aliases (`@src`, `@test`, `@seed`, `@jumentix/*`).
3. Mapear arquivos → camadas via `test-map.json`.
4. Expandir para fora pelas dependências reversas de `dependsOn`.
5. Executar suítes unitárias Bun + scripts de integração Node alvo.
6. Emitir evidência JSON (`AAA_CI_GATE_RESULT_FILE`) incluindo camadas **não executadas**.

Rollback sem reverter código:

```bash
JUMENTIX_GATE_V2=0 bun run ci:gate:task
```

Shadow (v1 autoritativo, v2 só relatório):

```bash
JUMENTIX_GATE_V2=0 JUMENTIX_GATE_V2_SHADOW=1 bun run ci:gate:task
```

## Partição de runtime

`bun run test:unit` lê `test-map.json` e:

1. Executa suítes `runner: "bun"` com `bun test`.
2. Executa suítes `runner: "node"` com Jest (partição temporária por lacunas de API do Bun).

Integração permanece em Node/Jest via `bun run ci:integration` / scripts por adaptador declarados no manifesto.

## Regras anti-falso-positivo

- Plano vazio para um change-set não vazio → falha.
- Suíte planejada ausente dos resultados executados → falha.
- Status `skipped` / `pending` / não reportado → falha.
- `test-map.json` obsoleto (arquivos faltando, ciclos, dupla posse) → falha via `test-map:check`.
