# Jumentix Wave 5 Path Delta Map

This map tracks runtime path rewrites for the backend-template and service-management re-homing wave.

## Post-cutover mapping table

| Legacy path | Current path |
| --- | --- |
| `src/` | `apps/backend-template/src/` |
| `test/` | `apps/backend-template/test/` |
| `seed/` | `apps/backend-template/seed/` |
| `OASdoc/` | `apps/backend-template/OASdoc/` |
| `AsyncAPIdoc/` | `apps/backend-template/AsyncAPIdoc/` |
| `docker/` | `apps/backend-template/docker/` |
| `docker-compose-*.yml` | `apps/backend-template/docker-compose-*.yml` |
| `service-management/` | `apps/service-management/` |
| `apps/backend-template/pm2/` | `pm2/` (root ownership) |

## Legacy path anchors (pre-cutover)

### Backend runtime anchors

- `./src/interface/HTTP/adapters/start-rest-api.ts`
- `./src/interface/WebSocket/adapters/start-websocket-api.ts`
- `./src/interface/gRPC/adapters/start-grpc-api.ts`
- production compiled equivalents under `./.build/interface/...`
- seed data under `./seed/*`

### Service Management anchor

- `./service-management/server.js`

## Current anchors (post-cutover)

### Backend template app

- `./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts`
- `./apps/backend-template/src/interface/WebSocket/adapters/start-websocket-api.ts`
- `./apps/backend-template/src/interface/gRPC/adapters/start-grpc-api.ts`
- production compiled equivalents under `./.build/apps/backend-template/src/interface/...`
- seed data under `./apps/backend-template/seed/*`

### Service Management app

- `./apps/service-management/server.js`

## Rewritten ownership files

1. `pm2/ecosystem.dev.config.cjs`
2. `pm2/ecosystem.staging.config.cjs`
3. `pm2/ecosystem.production.config.cjs`
4. root `package.json` scripts containing:
   - runtime starters
   - build/test commands pointing to `apps/backend-template/*`
   - docker compose references under `apps/backend-template/`
5. docs and onboarding references:
   - `README.md`
   - `documentation/md/SETUP-RUNTIME-AND-API.md`
   - `documentation/md/SERVICE-MANAGEMENT-APPLICATION.md`

## Validation checklist

- `bun run oas:check-routes` green with `apps/backend-template/src` resolution.
- `bun run test:unit` green using `apps/backend-template/test/unit`.
- PM2 dev/staging/prod startup scripts reference `pm2/*` ecosystems.
- Service Management app still starts from `apps/service-management/server.js`.
