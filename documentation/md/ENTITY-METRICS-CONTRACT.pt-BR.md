# Contrato de métricas de entidade

Linear: [JUM-793](https://linear.app/jumentix/issue/JUM-793). English: [ENTITY-METRICS-CONTRACT.md](./ENTITY-METRICS-CONTRACT.md).

## Operações

`GET /users/metrics` e `GET /organizations/metrics`. Mesmo RBAC da lista.

Query: `metric=count|groupBy|series`, `field`, `interval=day|week|month`, `filter` (mesmo base64 das listas).

Resposta: `{ metric, field?, interval?, buckets: [{ key, count }] }`. `count` devolve `{ key: total }`. Tombstones ficam de fora.

400 nomeia valores aceitos.

## Implementação

`runMetricsQuery` em `packages/persistence-contracts`. Controllers usam `setMetricsQuery`.
