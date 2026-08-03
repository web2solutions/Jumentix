# Requirement 124 - Monorepo Root Layout Governance

## Status
In progress

## Scope
- Root workspace must not contain backend-template runtime folders directly.
- Backend-template runtime ownership lives under `apps/backend-template/`.
- PM2 runtime orchestration ownership lives at monorepo root in `pm2/`.
- Legacy `sdk-clients/*` is deprecated in favor of `packages/sdk-*` and removed from workspace package ownership.
- Tests must be scoped by owning project/component (`apps/backend-template/test`, `packages/*/test`, `apps/*/test`).

## Applied decisions
1. Moved backend template runtime folders from root:
   - `apps/backend-template/src/` -> `apps/backend-template/src/`
   - `apps/backend-template/test/` -> `apps/backend-template/test/`
   - `OASdoc/` -> `apps/backend-template/OASdoc/`
   - `AsyncAPIdoc/` -> `apps/backend-template/AsyncAPIdoc/`
   - `docker/` and `apps/backend-template/docker-compose-*.yml` -> `apps/backend-template/`
2. Moved PM2 ecosystems:
   - `pm2/*` is now the runtime ownership root
3. Updated runtime/config/test path contracts in:
   - `package.json`, `jest.config.js`, `tsconfig.json`, `serverless.ts`
   - `ci-cd/*` path checks and environment loader
4. Removed `sdk-clients/*` from `pnpm-workspace.yaml` package ownership.

## Validation
- Unit test suite runs from `apps/backend-template/test/unit`.
- CI helper unit tests updated for new path ownership.
