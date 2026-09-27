# Relatório de rollout da pirâmide de testes e plano de rollback (JUM-448)

Data: 2026-07-30  
Projeto: Hexagonal Test Pyramid (`7f9e4a32-3b2c-4b0a-86e0-7430bb31076d`)

## Entregue

| Onda | Conteúdo | Status |
| --- | --- | --- |
| Fundação | Req 105/106, `test-map.json`, anti-drift, pastas de camada no piloto de Users | Entregue |
| Gates seletivos | `JUMENTIX_GATE_V2`, resolver ciente de aliases, JSON de evidência, shadow | Entregue |
| Todos os testes no Bun local | Req 106 — unit/integration/smoke/contract via Bun localmente | Entregue |
| Node só no CI | `ciRunner` + `JUMENTIX_TEST_RUNTIME=node` + scripts `*:ci` | Entregue (CI verde fora de escopo) |
| Tier noturno | `tier: nightly` + `bun run test:nightly` | Entregue (agendador fora de escopo) |
| Honestidade do workspace | `workspace:test` + `jumentix.testSurface` | Entregue |

## Benchmarks vs baseline da Fase 0

Veja `artifacts/ci/baseline-timings.json` e `artifacts/ci/benchmark-report.json`.

Metas (plano do projeto):

| Métrica | Meta | Notas |
| --- | --- | --- |
| Tempo do gate de tarefa | < 60s após a troca para Bun | Medido localmente; tempo de relógio do CI fora de escopo |
| Unit completo | < 5 min | Caminho local com Bun |
| Taxa de escalonamento | < 30% das PRs | Exige tráfego real; acompanhado após o rollout |
| Taxa de falhas do shadow | 0 | Garantida pelo validador de evidência |
| Taxa de flake | < 0,5% | Veja `artifacts/ci/flake-inventory.json` |

Declaração honesta: tempos do CI remoto **não** foram usados como evidência de aceite, porque o funcionamento do CI está fora do escopo deste projeto (Req 106 §5).

## Plano de rollback (exercitado como troca de flag)

1. **Rollback do seletor:** `JUMENTIX_GATE_V2=0` restaura o planejamento de tarefas v1 sem reverter código.
2. **Rollback de runtime de uma suíte:** definir `ciRunner`/`JUMENTIX_TEST_RUNTIME=node` para o CI; localmente continua Bun, a menos que um operador exporte a variável.
3. **Quarentena:** `bun run quarantine:flake --path <suite> --reason "..." --create-issue` adiciona quarentena só de relatório com referência no Linear.
4. **Rollback do manifesto:** regenerar a partir do histórico git de `test-map.json` / `ci-cd/generate-test-map.js`.

## Riscos residuais

- Alguns testes de integração orientados a Jest ainda podem falhar em `bun test` até o código da suíte ser adaptado — é dívida da suíte, não motivo para manter o Jest como padrão local.
- Infra noturna (Redis/DB) precisa ter dono em operações de CI.
