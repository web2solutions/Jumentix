# 042 - Environment-Driven Runtime Adapter Selection and Editing

## Requirement

Runtime startup must be driven by environment variables and editable through Service Management:

- Split startup entrypoints:
  - `apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts`
  - `apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts`
  - `apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.ts`
- PM2 must start REST, WebSocket, and gRPC as separate processes.
- Runtime selection keys must exist in all `apps/backend-template/src/config/.env*` files:
  - `JUMENTIX_HTTP_FRAMEWORK` (default `express`)
  - `JUMENTIX_REALTIME_API` (default `no`)
  - `JUMENTIX_REALTIME_API_PROTOCOL` (default `websocket`)
  - `JUMENTIX_REALTIME_API_DATABASE_DRIVER` (Mongo, PostgreSQL, MySQL, MS SQL, RDS, Aurora, Cassandra)
- `servicemangement` must read and update these environment values in the active env file with cross-platform behavior.

## Guardrails

- REST bootstrap must fail fast on unsupported `JUMENTIX_HTTP_FRAMEWORK`.
- Realtime startup must respect `JUMENTIX_REALTIME_API` and `JUMENTIX_REALTIME_API_PROTOCOL`.
- Runtime env editor must only mutate approved keys.
