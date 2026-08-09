# Jumentix Deploy Target and Packaging Matrix

## Objective

Define deploy targets and artifact packaging contracts for backend and frontend services managed by Jumentix.

## Deploy Target Matrix

| Deploy Target | Service Types | Runtime Manager | Packaging Contract | Delivery Path |
|---|---|---|---|---|
| Dedicated Server (SSH) | REST, WebSocket+REST, gRPC+REST, frontend | PM2 | Build output + PM2 ecosystem profile | SSH deploy + PM2 reload |
| VM Cloud Instance (EC2/GCE/Azure VM) | REST, WebSocket+REST, gRPC+REST, frontend | PM2 | Build output + PM2 ecosystem profile + env contract | IaC/SSH deploy + PM2 orchestration |
| AWS Lambda | Function APIs | Serverless framework | Function bundle + serverless config + env contract | `serverless deploy` |
| Vercel Functions | Function APIs | Vercel runtime | Vercel function entrypoints + config | Vercel deploy workflow |
| Cloudflare Workers | Function/event APIs | Worker runtime | Worker module bundle + worker config | Wrangler/Worker deployment |

## Machine-readable Reader

The run-mode × cloud-provider support derived from this matrix is maintained
as data in `packages/designer-core/src/model/deployCapabilityMatrix.js`
(extracted by JUM-544 so the Service Configuration tab and JUM-481's deploy
targets validate against one shared source instead of two transcriptions).
The designer's Service Configuration tab enforces it at save time (JUM-544):
combinations with no deploy target in this matrix are rejected.

Since JUM-481, the same reader also carries the Service Management Metadata
Contract below as data — the `serviceType`, `deployTarget`, `runtimeProtocol`
and `pm2Profile` vocabularies, the service-type × deploy-target support of
the matrix rows above, the PM2-managed target set, and the protocols each
service type exposes (`databaseDriver`/`keyValueDriver` mirror the
`JUMENTIX_DATABASE_DRIVER`/`JUMENTIX_KEYVALUESTORAGE_DRIVER` enums of the
runtime env contract). The Deploy Management tab validates every new deploy
target against it: combinations with no row in this matrix, protocols the
service type does not expose, and PM2 profiles on serverless targets (or
missing on PM2-managed targets) are rejected with the constraint named.
Any change to this matrix must update that module — and vice versa — in the
same PR.

## Packaging Contracts

| Artifact Type | Mandatory Files | Validation Gate |
|---|---|---|
| Backend VM Service | `package.json`, build output, PM2 ecosystem, env template | `ci:gate`, build, smoke tests |
| Realtime Service | AsyncAPI contract, runtime adapter entrypoint, REST fallback wiring | unit + integration realtime tests |
| Function Bundle | function handlers, deployment manifest (`serverless` or platform config), env template | function smoke + contract checks |
| Frontend SPA/PWA | app build output, runtime env mapping, offline storage config | frontend build/test/lint gates |
| Shared Package (npm) | `package.json` semver, `files` whitelist, type/build outputs | release governance + dry-run publish |

## Service Management Metadata Contract

Service Management should track, per service:

- `serviceType`: `restapi`, `websocket+restapi`, `grpc+restapi`, `functions`
- `deployTarget`: `dedicated-server`, `vm`, `ec2`, `lambda`, `vercel-functions`, `cloudflare-workers`
- `runtimeProtocol`: `http`, `websocket`, `grpc`
- `databaseDriver`: selected `JUMENTIX_DATABASE_DRIVER`
- `keyValueDriver`: selected `JUMENTIX_KEYVALUESTORAGE_DRIVER`
- `pm2Profile`: `dev`, `staging`, `production` (for VM-based deployments)

## Acceptance Criteria

- Every service type has at least one valid deploy target and packaging contract.
- VM-based deployments are PM2-first and keep processes separated by interface.
- Function targets keep provider-native packaging contracts.
- Release governance blocks publishing artifacts with invalid metadata.
