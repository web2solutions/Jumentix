# Entity metrics contract

Linear: [JUM-793](https://linear.app/jumentix/issue/JUM-793). Portuguese: [ENTITY-METRICS-CONTRACT.pt-BR.md](./ENTITY-METRICS-CONTRACT.pt-BR.md).

## Operations

`GET /users/metrics` (`getUsersMetrics`) and `GET /organizations/metrics` (`getOrganizationsMetrics`). Same RBAC scopes as the matching list operation.

Query:

| Parameter | Required | Values |
| --- | --- | --- |
| `metric` | yes | `count` \| `groupBy` \| `series` |
| `field` | `groupBy` and `series` | must be in `x-metrics-capabilities` |
| `interval` | `series` | `day` \| `week` \| `month` |
| `filter` | no | same base64 filter as lists |

Response:

```json
{ "metric": "groupBy", "field": "roles", "buckets": [{ "key": "admin", "count": 2 }] }
```

`count` returns one bucket `{ "key": "total", "count": N }`. Tombstones are excluded.

400s name accepted values (`The metrics field "x" is not groupable. Accepted: …`).

## Implementation

`runMetricsQuery` in `packages/persistence-contracts`. Controllers use `setMetricsQuery`. Capabilities live on the list and metrics operations as `x-metrics-capabilities`.
