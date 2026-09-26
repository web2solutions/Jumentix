# JUM-432 / JUM-433 — Baseline do Bun e toolchain vs taxonomia de camadas

## JUM-432 — Projetar o JUM-23 na taxonomia de camadas

Resumo histórico da baseline: `documentation/md/HISTORICAL-TRANSITIONS.pt-BR.md` (JUM-23).

| Camada | Postura pronta para Bun (local, Req 106) | Notas |
| --- | --- | --- |
| `contracts` | bun | Verificações de governança via `bun run test:contract` |
| `domain` | bun | Principal ganho do Bun; piloto de Users em `test/unit/modules/Users/domain` |
| `application` | bun | Inclui as antigas pastas de teste `service`/`events`/`features` |
| `adapters/in` | bun local / `ciRunner:node` | Integração de adapters HTTP mantida para Node no CI |
| `adapters/out+infra` | bun local / `ciRunner:node` para smoke/mutex | Tier noturno para infra |
| `interface/runtime` | bun local / `ciRunner:node` | Suítes realtime |
| `tooling` | bun | ci-cd / website / geradores |

A ordem de migração continua de dentro para fora: domain → application → adapters → interface → infra noturna.

## JUM-433 — O Bun fixado atende às necessidades de DX da pirâmide

Versão fixada: Bun `1.3.13`.

| Necessidade | Verificado |
| --- | --- |
| `bun test --watch` por caminho | Sim — `bun run tdd:<layer>` / `ci-cd/run-tdd.js` |
| Reporter LCOV | Sim — `bun test --coverage --coverage-reporter=lcov` |
| Caminhos de camada derivados do manifesto | Sim — sem globs fixos nos scripts de tdd |

Lacunas são registradas nas issues de toolchain do épico do Bun, não duplicadas aqui.
