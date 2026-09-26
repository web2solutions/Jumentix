# Suítes dependentes de plataforma — inventário de fixação em Node (JUM-439)

## Propósito

Tornar a fronteira Node/CI explícita e fail-closed. Localmente estas suítes continuam rodando no Bun (Req 106); a execução em Node é exclusiva do CI.

## Inventário

| Suíte / superfície | Por que depende da plataforma | Local (`runner`) | CI (`ciRunner`) | Tier |
| --- | --- | --- | --- | --- |
| `test/integration/mutex/*` | Redis real | bun | node | nightly |
| `realtime/socketio.redis-streams.multi-instance.test.ts` | Redis Streams multi-instância | bun | node | nightly |
| `test/smoke/database/*` | Matriz de drivers de banco / docker | bun | node | nightly |
| Integração de frameworks HTTP (`Express`…`Total-JS`) | Peculiaridades de framework + harness Nest | bun | node | gate |
| Restify | Historicamente sensível à versão major do Node | bun | node | gate |

## Skips silenciosos antigos (removidos como fonte da verdade)

O `jest.config.js` omitia antes mutex / redis-streams a menos que `RUN_REDIS_INTEGRATION=1`, e omitia Restify/mutex.restify quando `nodeMajor > 22`. Isso gerava verdes que não diziam nada sobre essas suítes.

Substituição honesta:

1. As suítes estão sempre presentes em `test-map.json`.
2. Suítes caras de infra usam `tier: "nightly"` (`bun run test:nightly`).
3. O CI pode definir `JUMENTIX_TEST_RUNTIME=node` / scripts `*:ci`; o padrão local continua Bun.
4. Timeouts são fail-closed em `ci-cd/run-integration-tests.js` (120s padrão; Express/Fastify 300s; Restify 600s).

## Evidência

- `test-map.json` (`tier`, `ciRunner`, `timeoutMs`)
- `ci-cd/run-nightly-tier.js`
- `ci-cd/lib/test-runtime.js`
