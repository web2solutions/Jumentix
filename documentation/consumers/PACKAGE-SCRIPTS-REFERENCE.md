# Package.json Scripts Reference (Consumer)

This page lists all root `package.json` scripts and how to use each command.

Usage pattern:

```bash
pnpm run <command>
```

| Command | When to use | How to run | Underlying command |
|---|---|---|---|
| `check-node-version` | Use when you need this specific workspace operation. | `pnpm run check-node-version` | `node ci-cd/check-node-version.js` |
| `preinstall` | Use when you need this specific workspace operation. | `pnpm run preinstall` | `node ci-cd/check-node-version.js` |
| `mono:build` | Run workspace-wide recursive operations. | `pnpm run mono:build` | `pnpm -r --workspace-concurrency=1 --if-present build` |
| `mono:test` | Run workspace-wide recursive operations. | `pnpm run mono:test` | `pnpm -r --workspace-concurrency=1 --if-present test` |
| `mono:lint` | Run workspace-wide recursive operations. | `pnpm run mono:lint` | `pnpm -r --workspace-concurrency=1 --if-present lint` |
| `mono:typecheck` | Run workspace-wide recursive operations. | `pnpm run mono:typecheck` | `pnpm -r --workspace-concurrency=1 --if-present typecheck` |
| `docs:translate:ptbr` | Generate or synchronize documentation artifacts. | `pnpm run docs:translate:ptbr` | `node tooling/scripts/generate-ptbr-docs.mjs` |
| `docs:translate:ptbr:links` | Generate or synchronize documentation artifacts. | `pnpm run docs:translate:ptbr:links` | `node tooling/scripts/patch-ptbr-links.mjs` |
| `docs:consumers:package-scripts` | Generate or synchronize documentation artifacts. | `pnpm run docs:consumers:package-scripts` | `node tooling/scripts/generate-consumer-package-scripts-docs.mjs` |
| `prepare` | Install git hooks (husky). Usually runs automatically. | `pnpm run prepare` | `husky install` |
| `changelog:update` | Generate or verify changelog from git history. | `pnpm run changelog:update` | `node ci-cd/update-changelog.js` |
| `changelog:check` | Generate or verify changelog from git history. | `pnpm run changelog:check` | `node ci-cd/update-changelog.js --check` |
| `oas:check-routes` | Validate OpenAPI contracts and route resolution. | `pnpm run oas:check-routes` | `node ci-cd/check-oas-route-resolution.js` |
| `deps:check-cycles` | Use when you need this specific workspace operation. | `pnpm run deps:check-cycles` | `node ci-cd/check-core-import-cycles.js` |
| `arch:check-boundaries` | Validate architecture boundaries and constraints. | `pnpm run arch:check-boundaries` | `node ci-cd/check-hexagonal-boundaries.js` |
| `arch:check-users-legacy-imports` | Validate architecture boundaries and constraints. | `pnpm run arch:check-users-legacy-imports` | `node ci-cd/check-users-legacy-imports.js` |
| `arch:check-workspace-boundaries` | Validate architecture boundaries and constraints. | `pnpm run arch:check-workspace-boundaries` | `node ci-cd/check-workspace-boundaries.js` |
| `workspace:check-coverage-policy` | Validate workspace-level policies. | `pnpm run workspace:check-coverage-policy` | `node ci-cd/check-workspace-coverage-policy.js` |
| `workspace:check-quality` | Validate workspace-level policies. | `pnpm run workspace:check-quality` | `node ci-cd/check-workspace-quality.js` |
| `ci:affected` | Use in CI validation and delivery gates. | `pnpm run ci:affected` | `node ci-cd/check-affected-workspaces.js` |
| `ci:monorepo` | Use in CI validation and delivery gates. | `pnpm run ci:monorepo` | `node ci-cd/run-monorepo-ci.js` |
| `release:dry-run` | Run release governance and dry-run routines. | `pnpm run release:dry-run` | `node ci-cd/release-dry-run.js all` |
| `release:dry-run:packages` | Run release governance and dry-run routines. | `pnpm run release:dry-run:packages` | `node ci-cd/release-dry-run.js packages` |
| `release:dry-run:apps` | Run release governance and dry-run routines. | `pnpm run release:dry-run:apps` | `node ci-cd/release-dry-run.js apps` |
| `release:governance:check` | Run release governance and dry-run routines. | `pnpm run release:governance:check` | `node ci-cd/check-release-governance.js` |
| `serverless:check-handlers` | Use when you need this specific workspace operation. | `pnpm run serverless:check-handlers` | `node ci-cd/check-serverless-handler-paths.js` |
| `ci:smoke` | Use in CI validation and delivery gates. | `pnpm run ci:smoke` | `AAA_JWT_TOKEN_SECRET_KEY=${AAA_JWT_TOKEN_SECRET_KEY:-ci_jwt_secret_key} NODE_ENV=ci node ci-cd/run-api-smoke.js` |
| `ci:security-smoke` | Use in CI validation and delivery gates. | `pnpm run ci:security-smoke` | `NODE_ENV=ci node ci-cd/run-security-smoke.js` |
| `ci:gate` | Use in CI validation and delivery gates. | `pnpm run ci:gate` | `pnpm run lint && pnpm run deps:check-cycles && pnpm run arch:check-boundaries && pnpm run arch:check-users-legacy-imports && pnpm run arch:check-workspace-boundaries && pnpm run workspace:check-quality && pnpm run workspace:check-coverage-policy && pnpm run release:governance:check && pnpm run test:unit && pnpm run ci:security-smoke && pnpm run oas:check-routes && pnpm run serverless:check-handlers && pnpm run build:dev && pnpm run ci:smoke` |
| `ci:gate:strict` | Use in CI validation and delivery gates. | `pnpm run ci:gate:strict` | `pnpm run ci:gate && pnpm run coverage:patch` |
| `dev` | Default local entrypoint; starts dev PM2 profile. | `pnpm run dev` | `pnpm run pm2:start:dev:restapi` |
| `website:dev` | Operate the commercial website lifecycle. | `pnpm run website:dev` | `pnpm --filter @jumentix/website dev` |
| `website:build` | Operate the commercial website lifecycle. | `pnpm run website:build` | `pnpm --filter @jumentix/website build` |
| `website:start` | Operate the commercial website lifecycle. | `pnpm run website:start` | `pnpm --filter @jumentix/website start` |
| `website:test:prepublish` | Operate the commercial website lifecycle. | `pnpm run website:test:prepublish` | `pnpm --filter @jumentix/website test:prepublish` |
| `website:vercel:link` | Operate the commercial website lifecycle. | `pnpm run website:vercel:link` | `pnpm dlx vercel link --cwd apps/jumentix-website --project jumentix-website --yes` |
| `website:vercel:pull:preview` | Operate the commercial website lifecycle. | `pnpm run website:vercel:pull:preview` | `pnpm dlx vercel pull --cwd apps/jumentix-website --environment=preview --yes` |
| `website:vercel:pull:prod` | Operate the commercial website lifecycle. | `pnpm run website:vercel:pull:prod` | `pnpm dlx vercel pull --cwd apps/jumentix-website --environment=production --yes` |
| `website:deploy:vercel` | Operate the commercial website lifecycle. | `pnpm run website:deploy:vercel` | `pnpm dlx vercel --cwd apps/jumentix-website --prod` |
| `website:publish` | Operate the commercial website lifecycle. | `pnpm run website:publish` | `pnpm run website:test:prepublish && pnpm run website:deploy:vercel` |
| `website:deploy:vercel:preview` | Operate the commercial website lifecycle. | `pnpm run website:deploy:vercel:preview` | `pnpm dlx vercel --cwd apps/jumentix-website` |
| `npm:whoami` | Execute npm organization and publish helper commands. | `pnpm run npm:whoami` | `pnpm whoami` |
| `npm:org:check:xpertminds` | Execute npm organization and publish helper commands. | `pnpm run npm:org:check:xpertminds` | `node ci-cd/check-npm-org-integration.js` |
| `npm:publish:dry-run:packages` | Execute npm organization and publish helper commands. | `pnpm run npm:publish:dry-run:packages` | `node ci-cd/npm-publish-dry-run.js` |
| `pm2:list` | Manage PM2 runtime processes. | `pnpm run pm2:list` | `pm2 ls` |
| `pm2:logs` | Manage PM2 runtime processes. | `pnpm run pm2:logs` | `pm2 logs` |
| `pm2:stop:all` | Manage PM2 runtime processes. | `pnpm run pm2:stop:all` | `pm2 stop all` |
| `pm2:delete:all` | Manage PM2 runtime processes. | `pnpm run pm2:delete:all` | `pm2 delete all` |
| `pm2:start:dev:restapi` | Manage PM2 runtime processes. | `pnpm run pm2:start:dev:restapi` | `pm2 start ./pm2/ecosystem.dev.cjs --only aaa-dev-service-management,aaa-dev-restapi --update-env` |
| `pm2:start:dev:websocket-rest` | Manage PM2 runtime processes. | `pnpm run pm2:start:dev:websocket-rest` | `pm2 start ./pm2/ecosystem.dev.cjs --only aaa-dev-service-management,aaa-dev-restapi,aaa-dev-websocketapi --update-env` |
| `pm2:start:dev:grpc-rest` | Manage PM2 runtime processes. | `pnpm run pm2:start:dev:grpc-rest` | `pm2 start ./pm2/ecosystem.dev.cjs --only aaa-dev-service-management,aaa-dev-restapi,aaa-dev-grpcapi --update-env` |
| `pm2:start:staging:restapi` | Manage PM2 runtime processes. | `pnpm run pm2:start:staging:restapi` | `pm2 start ./pm2/ecosystem.staging.cjs --only aaa-staging-service-management,aaa-staging-restapi --update-env` |
| `pm2:start:staging:websocket-rest` | Manage PM2 runtime processes. | `pnpm run pm2:start:staging:websocket-rest` | `pm2 start ./pm2/ecosystem.staging.cjs --only aaa-staging-service-management,aaa-staging-restapi,aaa-staging-websocketapi --update-env` |
| `pm2:start:staging:grpc-rest` | Manage PM2 runtime processes. | `pnpm run pm2:start:staging:grpc-rest` | `pm2 start ./pm2/ecosystem.staging.cjs --only aaa-staging-service-management,aaa-staging-restapi,aaa-staging-grpcapi --update-env` |
| `pm2:start:prod:restapi` | Manage PM2 runtime processes. | `pnpm run pm2:start:prod:restapi` | `pm2 start ./pm2/ecosystem.production.cjs --only aaa-prod-service-management,aaa-prod-restapi --update-env` |
| `pm2:start:prod:websocket-rest` | Manage PM2 runtime processes. | `pnpm run pm2:start:prod:websocket-rest` | `pm2 start ./pm2/ecosystem.production.cjs --only aaa-prod-service-management,aaa-prod-restapi,aaa-prod-websocketapi --update-env` |
| `pm2:start:prod:grpc-rest` | Manage PM2 runtime processes. | `pnpm run pm2:start:prod:grpc-rest` | `pm2 start ./pm2/ecosystem.production.cjs --only aaa-prod-service-management,aaa-prod-restapi,aaa-prod-grpcapi --update-env` |
| `commit` | Use when you need this specific workspace operation. | `pnpm run commit` | `pnpm run lint && pnpm run test && node -r ts-node/register ci-cd/bumpPackage.ts && git add . && git-cz` |
| `lint` | Run lint checks before commit/PR. | `pnpm run lint` | `eslint . --ext .ts` |
| `lint:fix` | Use when you need this specific workspace operation. | `pnpm run lint:fix` | `eslint . --ext .ts --fix` |
| `build:dev` | Use when you need this specific workspace operation. | `pnpm run build:dev` | `NODE_ENV=dev tsc -p tsconfig.build.json` |
| `build:prod` | Use when you need this specific workspace operation. | `pnpm run build:prod` | `NODE_ENV=prod tsc -p tsconfig.build.json` |
| `tdd` | Use when you need this specific workspace operation. | `pnpm run tdd` | `NODE_ENV=dev pnpm exec jest --watchAll` |
| `npm` | Use when you need this specific workspace operation. | `pnpm run npm` | `NODE_ENV=ci pnpm exec jest ./apps/backend-template/test` |
| `test` | Run default backend-template test suite. | `pnpm run test` | `NODE_ENV=dev pnpm exec jest ./apps/backend-template/test` |
| `test:unit` | Run tests for specific scope or profile. | `pnpm run test:unit` | `NODE_ENV=dev node ci-cd/run-unit-tests.js` |
| `coverage:patch` | Use when you need this specific workspace operation. | `pnpm run coverage:patch` | `node ci-cd/check-patch-coverage.js` |
| `test:integration` | Run tests for specific scope or profile. | `pnpm run test:integration` | `pnpm run test:integration:express && pnpm run test:integration:fastify && pnpm run test:integration:restify && pnpm run test:integration:hyper-express && pnpm run test:integration:cloudflare-workers && pnpm run test:integration:vercel-functions && pnpm run test:integration:loopback && pnpm run test:integration:sails-js && pnpm run test:integration:feathers && pnpm run test:integration:derby-js && pnpm run test:integration:adonis-js && pnpm run test:integration:total-js && pnpm run test:integration:realtime && pnpm run test:integration:service-management` |
| `test:integration:express` | Run tests for specific scope or profile. | `pnpm run test:integration:express` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Express` |
| `test:integration:fastify` | Run tests for specific scope or profile. | `pnpm run test:integration:fastify` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Fastify` |
| `test:integration:restify` | Run tests for specific scope or profile. | `pnpm run test:integration:restify` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Restify` |
| `test:integration:lambda` | Run tests for specific scope or profile. | `pnpm run test:integration:lambda` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Lambda` |
| `test:integration:hyper-express` | Run tests for specific scope or profile. | `pnpm run test:integration:hyper-express` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Hyper-Express` |
| `test:integration:cloudflare-workers` | Run tests for specific scope or profile. | `pnpm run test:integration:cloudflare-workers` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Cloudflare-Workers` |
| `test:integration:vercel-functions` | Run tests for specific scope or profile. | `pnpm run test:integration:vercel-functions` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Vercel-Functions` |
| `test:integration:loopback` | Run tests for specific scope or profile. | `pnpm run test:integration:loopback` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/LoopBack` |
| `test:integration:sails-js` | Run tests for specific scope or profile. | `pnpm run test:integration:sails-js` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Sails-JS` |
| `test:integration:feathers` | Run tests for specific scope or profile. | `pnpm run test:integration:feathers` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Feathers` |
| `test:integration:derby-js` | Run tests for specific scope or profile. | `pnpm run test:integration:derby-js` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Derby-JS` |
| `test:integration:adonis-js` | Run tests for specific scope or profile. | `pnpm run test:integration:adonis-js` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Adonis-JS` |
| `test:integration:total-js` | Run tests for specific scope or profile. | `pnpm run test:integration:total-js` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Total-JS` |
| `test:integration:service-management` | Run tests for specific scope or profile. | `pnpm run test:integration:service-management` | `NODE_ENV=dev node ci-cd/run-service-management-integration.js` |
| `test:integration:service-mangement` | Run tests for specific scope or profile. | `pnpm run test:integration:service-mangement` | `pnpm run test:integration:service-management` |
| `test:integration:realtime:websocket` | Run tests for specific scope or profile. | `pnpm run test:integration:realtime:websocket` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/realtime/websocket.basic.integration.test.ts --runInBand --coverage=false` |
| `test:integration:realtime:grpc` | Run tests for specific scope or profile. | `pnpm run test:integration:realtime:grpc` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/realtime/grpc.basic.integration.test.ts --runInBand --coverage=false` |
| `test:integration:realtime` | Run tests for specific scope or profile. | `pnpm run test:integration:realtime` | `pnpm run test:integration:realtime:websocket && pnpm run test:integration:realtime:grpc` |
| `test:integration:realtime:redis-streams` | Run tests for specific scope or profile. | `pnpm run test:integration:realtime:redis-streams` | `RUN_REDIS_INTEGRATION=1 NODE_ENV=dev jest ./apps/backend-template/test/integration/realtime/socketio.redis-streams.multi-instance.test.ts --runInBand --coverage=false` |
| `test:integration:db` | Run tests for specific scope or profile. | `pnpm run test:integration:db` | `pnpm run test:smoke:db:all` |
| `test:integration:db:inmemory` | Run tests for specific scope or profile. | `pnpm run test:integration:db:inmemory` | `pnpm run test:smoke:db:inmemory` |
| `test:integration:db:sqlite` | Run tests for specific scope or profile. | `pnpm run test:integration:db:sqlite` | `pnpm run test:smoke:db:sqlite` |
| `test:integration:db:postgresql` | Run tests for specific scope or profile. | `pnpm run test:integration:db:postgresql` | `pnpm run smoke:db:postgresql` |
| `test:integration:db:mysql` | Run tests for specific scope or profile. | `pnpm run test:integration:db:mysql` | `pnpm run smoke:db:mysql` |
| `test:integration:db:mssql` | Run tests for specific scope or profile. | `pnpm run test:integration:db:mssql` | `pnpm run smoke:db:mssql` |
| `test:integration:db:oracle` | Run tests for specific scope or profile. | `pnpm run test:integration:db:oracle` | `pnpm run smoke:db:oracle` |
| `test:integration:db:mongo` | Run tests for specific scope or profile. | `pnpm run test:integration:db:mongo` | `pnpm run smoke:db:mongodb` |
| `test:integration:db:cassandra` | Run tests for specific scope or profile. | `pnpm run test:integration:db:cassandra` | `pnpm run smoke:db:cassandra` |
| `test:integration:db:dynamodb` | Run tests for specific scope or profile. | `pnpm run test:integration:db:dynamodb` | `pnpm run smoke:db:dynamodb` |
| `test:integration:db:firebase` | Run tests for specific scope or profile. | `pnpm run test:integration:db:firebase` | `pnpm run smoke:db:firebase` |
| `test:integration:db:aurora` | Run tests for specific scope or profile. | `pnpm run test:integration:db:aurora` | `pnpm run smoke:db:aurora` |
| `test:integration:db:rds` | Run tests for specific scope or profile. | `pnpm run test:integration:db:rds` | `pnpm run smoke:db:rds` |
| `test:smoke` | Run tests for specific scope or profile. | `pnpm run test:smoke` | `pnpm run ci:smoke` |
| `test:smoke:security` | Run tests for specific scope or profile. | `pnpm run test:smoke:security` | `pnpm run ci:security-smoke` |
| `test:smoke:api` | Run tests for specific scope or profile. | `pnpm run test:smoke:api` | `pnpm run ci:smoke` |
| `test:smoke:db` | Run tests for specific scope or profile. | `pnpm run test:smoke:db` | `RUN_DB_SMOKE=1 NODE_ENV=dev jest ./apps/backend-template/test/smoke/database/DatabaseDrivers.smoke.test.ts --runInBand --coverage=false` |
| `test:smoke:realtime` | Run tests for specific scope or profile. | `pnpm run test:smoke:realtime` | `NODE_ENV=dev jest ./apps/backend-template/test/smoke/realtime/RealtimeApis.smoke.test.ts --runInBand --coverage=false` |
| `test:smoke:db:inmemory` | Run tests for specific scope or profile. | `pnpm run test:smoke:db:inmemory` | `AAA_DB_SMOKE_DRIVERS=InMemory pnpm run test:smoke:db` |
| `test:smoke:db:postgresql` | Run tests for specific scope or profile. | `pnpm run test:smoke:db:postgresql` | `AAA_DB_SMOKE_DRIVERS=PostgreSQL pnpm run test:smoke:db` |
| `test:smoke:db:mysql` | Run tests for specific scope or profile. | `pnpm run test:smoke:db:mysql` | `AAA_DB_SMOKE_DRIVERS=MySQL pnpm run test:smoke:db` |
| `test:smoke:db:mssql` | Run tests for specific scope or profile. | `pnpm run test:smoke:db:mssql` | `AAA_DB_SMOKE_DRIVERS=MSSQL pnpm run test:smoke:db` |
| `test:smoke:db:oracle` | Run tests for specific scope or profile. | `pnpm run test:smoke:db:oracle` | `AAA_DB_SMOKE_DRIVERS=Oracle pnpm run test:smoke:db` |
| `test:smoke:db:sqlite` | Run tests for specific scope or profile. | `pnpm run test:smoke:db:sqlite` | `AAA_DB_SMOKE_DRIVERS=SQLite pnpm run test:smoke:db` |
| `test:smoke:db:mongo` | Run tests for specific scope or profile. | `pnpm run test:smoke:db:mongo` | `AAA_DATABASE_CONNECTION_URL=mongodb://127.0.0.1:27027/aaa AAA_DB_SMOKE_DRIVERS=Mongo pnpm run test:smoke:db` |
| `test:smoke:db:cassandra` | Run tests for specific scope or profile. | `pnpm run test:smoke:db:cassandra` | `AAA_DB_SMOKE_DRIVERS=Cassandra pnpm run test:smoke:db` |
| `test:smoke:db:dynamodb` | Run tests for specific scope or profile. | `pnpm run test:smoke:db:dynamodb` | `AAA_DB_SMOKE_DRIVERS=DynamoDB pnpm run test:smoke:db` |
| `test:smoke:db:firebase` | Run tests for specific scope or profile. | `pnpm run test:smoke:db:firebase` | `AAA_DB_SMOKE_DRIVERS=Firebase pnpm run test:smoke:db` |
| `test:smoke:db:aurora` | Run tests for specific scope or profile. | `pnpm run test:smoke:db:aurora` | `AAA_DB_SMOKE_DRIVERS=Aurora pnpm run test:smoke:db` |
| `test:smoke:db:rds` | Run tests for specific scope or profile. | `pnpm run test:smoke:db:rds` | `AAA_DB_SMOKE_DRIVERS=RDS pnpm run test:smoke:db` |
| `test:smoke:db:all` | Run tests for specific scope or profile. | `pnpm run test:smoke:db:all` | `pnpm run smoke:db:inmemory && pnpm run smoke:db:sqlite && pnpm run smoke:db:postgresql && pnpm run smoke:db:mongodb && pnpm run smoke:db:mysql && pnpm run smoke:db:mssql && pnpm run smoke:db:dynamodb && pnpm run smoke:db:cassandra && pnpm run smoke:db:oracle && pnpm run smoke:db:firebase && pnpm run smoke:db:aurora && pnpm run smoke:db:rds` |
| `test:smoke:all` | Run tests for specific scope or profile. | `pnpm run test:smoke:all` | `pnpm run test:smoke:security && pnpm run test:smoke:api && pnpm run test:smoke:realtime && pnpm run test:smoke:db:all` |
| `smoke:db:postgresql` | Run smoke checks for fast environment validation. | `pnpm run smoke:db:postgresql` | `pnpm run docker:up:postgresql && pnpm run test:smoke:db:postgresql && pnpm run docker:down:postgresql` |
| `smoke:db:mysql` | Run smoke checks for fast environment validation. | `pnpm run smoke:db:mysql` | `pnpm run docker:up:mysql && pnpm run test:smoke:db:mysql && pnpm run docker:down:mysql` |
| `smoke:db:mssql` | Run smoke checks for fast environment validation. | `pnpm run smoke:db:mssql` | `pnpm run docker:up:mssql && pnpm run test:smoke:db:mssql && pnpm run docker:down:mssql` |
| `smoke:db:oracle` | Run smoke checks for fast environment validation. | `pnpm run smoke:db:oracle` | `pnpm run docker:up:oracle && pnpm run test:smoke:db:oracle && pnpm run docker:down:oracle` |
| `smoke:db:mongodb` | Run smoke checks for fast environment validation. | `pnpm run smoke:db:mongodb` | `pnpm run docker:up:mongodb && pnpm run test:smoke:db:mongo && pnpm run docker:down:mongodb` |
| `smoke:db:cassandra` | Run smoke checks for fast environment validation. | `pnpm run smoke:db:cassandra` | `pnpm run docker:up:cassandra && pnpm run test:smoke:db:cassandra && pnpm run docker:down:cassandra` |
| `smoke:db:dynamodb` | Run smoke checks for fast environment validation. | `pnpm run smoke:db:dynamodb` | `pnpm run docker:up:dynamodb && pnpm run test:smoke:db:dynamodb && pnpm run docker:down:dynamodb` |
| `smoke:db:firebase` | Run smoke checks for fast environment validation. | `pnpm run smoke:db:firebase` | `pnpm run docker:up:firebase && pnpm run test:smoke:db:firebase && pnpm run docker:down:firebase` |
| `smoke:db:aurora` | Run smoke checks for fast environment validation. | `pnpm run smoke:db:aurora` | `pnpm run docker:up:aurora && pnpm run test:smoke:db:aurora && pnpm run docker:down:aurora` |
| `smoke:db:rds` | Run smoke checks for fast environment validation. | `pnpm run smoke:db:rds` | `pnpm run docker:up:rds && pnpm run test:smoke:db:rds && pnpm run docker:down:rds` |
| `smoke:db:sqlite` | Run smoke checks for fast environment validation. | `pnpm run smoke:db:sqlite` | `pnpm run test:smoke:db:sqlite` |
| `smoke:db:inmemory` | Run smoke checks for fast environment validation. | `pnpm run smoke:db:inmemory` | `pnpm run test:smoke:db:inmemory` |
| `dev:http` | Start development runtime mode. | `pnpm run dev:http` | `pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-http --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:express` | Start development runtime mode. | `pnpm run dev:express` | `AAA_HTTP_FRAMEWORK=express pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-express --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:fastify` | Start development runtime mode. | `pnpm run dev:fastify` | `AAA_HTTP_FRAMEWORK=fastify pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-fastify --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:restify` | Start development runtime mode. | `pnpm run dev:restify` | `AAA_HTTP_FRAMEWORK=restify pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-restify --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:hyper-express` | Start development runtime mode. | `pnpm run dev:hyper-express` | `AAA_HTTP_FRAMEWORK=hyper-express pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-hyper-express --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:cloudflare-workers` | Start development runtime mode. | `pnpm run dev:cloudflare-workers` | `AAA_HTTP_FRAMEWORK=cloudflare-workers pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-cloudflare-workers --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:vercel-functions` | Start development runtime mode. | `pnpm run dev:vercel-functions` | `AAA_HTTP_FRAMEWORK=vercel-functions pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-vercel-functions --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:loopback` | Start development runtime mode. | `pnpm run dev:loopback` | `AAA_HTTP_FRAMEWORK=loopback pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-loopback --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:sails-js` | Start development runtime mode. | `pnpm run dev:sails-js` | `AAA_HTTP_FRAMEWORK=sails-js pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-sails-js --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:feathers` | Start development runtime mode. | `pnpm run dev:feathers` | `AAA_HTTP_FRAMEWORK=feathers pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-feathers --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:derby-js` | Start development runtime mode. | `pnpm run dev:derby-js` | `AAA_HTTP_FRAMEWORK=derby-js pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-derby-js --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:adonis-js` | Start development runtime mode. | `pnpm run dev:adonis-js` | `AAA_HTTP_FRAMEWORK=adonis-js pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-adonis-js --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:total-js` | Start development runtime mode. | `pnpm run dev:total-js` | `AAA_HTTP_FRAMEWORK=total-js pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-total-js --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:websocket` | Start development runtime mode. | `pnpm run dev:websocket` | `pnpm run pm2:start:dev:websocket-rest` |
| `dev:grpc` | Start development runtime mode. | `pnpm run dev:grpc` | `pnpm run pm2:start:dev:grpc-rest` |
| `dev:serverless` | Start development runtime mode. | `pnpm run dev:serverless` | `pnpm run lint && NODE_ENV=dev serverless dev` |
| `cli` | Use when you need this specific workspace operation. | `pnpm run cli` | `pnpm run dev:cli` |
| `cli:bootstrap` | Use when you need this specific workspace operation. | `pnpm run cli:bootstrap` | `node ./bin/aaa-bootstrap.js` |
| `dev:cli` | Start development runtime mode. | `pnpm run dev:cli` | `node -r ts-node/register -r tsconfig-paths/register ./apps/backend-template/src/interface/CLI/index.ts` |
| `dev:service-management` | Start development runtime mode. | `pnpm run dev:service-management` | `pm2 start ./apps/service-management/server.js --name aaa-dev-service-management --interpreter node --update-env` |
| `start:cli` | Use when you need this specific workspace operation. | `pnpm run start:cli` | `pnpm run dev:cli` |
| `prod:http` | Start production runtime profile. | `pnpm run prod:http` | `pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-http --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:express` | Start production runtime profile. | `pnpm run prod:express` | `AAA_HTTP_FRAMEWORK=express pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-express --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:fastify` | Start production runtime profile. | `pnpm run prod:fastify` | `AAA_HTTP_FRAMEWORK=fastify pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-fastify --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:restify` | Start production runtime profile. | `pnpm run prod:restify` | `AAA_HTTP_FRAMEWORK=restify pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-restify --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:hyper-express` | Start production runtime profile. | `pnpm run prod:hyper-express` | `AAA_HTTP_FRAMEWORK=hyper-express pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-hyper-express --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:cloudflare-workers` | Start production runtime profile. | `pnpm run prod:cloudflare-workers` | `AAA_HTTP_FRAMEWORK=cloudflare-workers pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-cloudflare-workers --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:vercel-functions` | Start production runtime profile. | `pnpm run prod:vercel-functions` | `AAA_HTTP_FRAMEWORK=vercel-functions pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-vercel-functions --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:loopback` | Start production runtime profile. | `pnpm run prod:loopback` | `AAA_HTTP_FRAMEWORK=loopback pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-loopback --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:sails-js` | Start production runtime profile. | `pnpm run prod:sails-js` | `AAA_HTTP_FRAMEWORK=sails-js pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-sails-js --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:feathers` | Start production runtime profile. | `pnpm run prod:feathers` | `AAA_HTTP_FRAMEWORK=feathers pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-feathers --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:derby-js` | Start production runtime profile. | `pnpm run prod:derby-js` | `AAA_HTTP_FRAMEWORK=derby-js pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-derby-js --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:adonis-js` | Start production runtime profile. | `pnpm run prod:adonis-js` | `AAA_HTTP_FRAMEWORK=adonis-js pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-adonis-js --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:total-js` | Start production runtime profile. | `pnpm run prod:total-js` | `AAA_HTTP_FRAMEWORK=total-js pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-total-js --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:websocket` | Start production runtime profile. | `pnpm run prod:websocket` | `pnpm run pm2:start:prod:websocket-rest` |
| `prod:grpc` | Start production runtime profile. | `pnpm run prod:grpc` | `pnpm run pm2:start:prod:grpc-rest` |
| `staging:restapi` | Start staging runtime profile. | `pnpm run staging:restapi` | `pnpm run pm2:start:staging:restapi` |
| `staging:websocket` | Start staging runtime profile. | `pnpm run staging:websocket` | `pnpm run pm2:start:staging:websocket-rest` |
| `staging:grpc` | Start staging runtime profile. | `pnpm run staging:grpc` | `pnpm run pm2:start:staging:grpc-rest` |
| `prod:serverless` | Start production runtime profile. | `pnpm run prod:serverless` | `pnpm run lint && NODE_ENV=prod serverless dev` |
| `docker:composeredis` | Start/stop containerized dependencies and services. | `pnpm run docker:composeredis` | `docker compose -f "apps/backend-template/docker-compose-redis.yml" up -d --build` |
| `docker:composemessaging` | Start/stop containerized dependencies and services. | `pnpm run docker:composemessaging` | `docker compose -f "apps/backend-template/docker-compose-messaging.yml" up -d --build` |
| `docker:compose:platform-services` | Start/stop containerized dependencies and services. | `pnpm run docker:compose:platform-services` | `docker compose -f "apps/backend-template/docker-compose-platform-services.yml" up -d --build` |
| `docker:up:postgresql` | Start/stop containerized dependencies and services. | `pnpm run docker:up:postgresql` | `docker compose -f "apps/backend-template/docker-compose-postgresql.yml" up -d --build` |
| `docker:up:mysql` | Start/stop containerized dependencies and services. | `pnpm run docker:up:mysql` | `docker compose -f "apps/backend-template/docker-compose-mysql.yml" up -d --build` |
| `docker:up:mssql` | Start/stop containerized dependencies and services. | `pnpm run docker:up:mssql` | `docker compose -f "apps/backend-template/docker-compose-mssql.yml" up -d --build` |
| `docker:up:oracle` | Start/stop containerized dependencies and services. | `pnpm run docker:up:oracle` | `docker compose -f "apps/backend-template/docker-compose-oracle.yml" up -d --build` |
| `docker:up:mongodb` | Start/stop containerized dependencies and services. | `pnpm run docker:up:mongodb` | `docker compose -f "apps/backend-template/docker-compose-mongodb.yml" up -d --build` |
| `docker:up:cassandra` | Start/stop containerized dependencies and services. | `pnpm run docker:up:cassandra` | `docker compose -f "apps/backend-template/docker-compose-cassandra.yml" up -d --build` |
| `docker:up:dynamodb` | Start/stop containerized dependencies and services. | `pnpm run docker:up:dynamodb` | `docker compose -f "apps/backend-template/docker-compose-dynamodb.yml" up -d --build` |
| `docker:up:firebase` | Start/stop containerized dependencies and services. | `pnpm run docker:up:firebase` | `docker compose -f "apps/backend-template/docker-compose-firebase.yml" up -d --build` |
| `docker:up:aurora` | Start/stop containerized dependencies and services. | `pnpm run docker:up:aurora` | `docker compose -f "apps/backend-template/docker-compose-aurora.yml" up -d --build` |
| `docker:up:rds` | Start/stop containerized dependencies and services. | `pnpm run docker:up:rds` | `docker compose -f "apps/backend-template/docker-compose-rds.yml" up -d --build` |
| `docker:down:postgresql` | Start/stop containerized dependencies and services. | `pnpm run docker:down:postgresql` | `docker compose -f "apps/backend-template/docker-compose-postgresql.yml" down` |
| `docker:down:mysql` | Start/stop containerized dependencies and services. | `pnpm run docker:down:mysql` | `docker compose -f "apps/backend-template/docker-compose-mysql.yml" down` |
| `docker:down:mssql` | Start/stop containerized dependencies and services. | `pnpm run docker:down:mssql` | `docker compose -f "apps/backend-template/docker-compose-mssql.yml" down` |
| `docker:down:oracle` | Start/stop containerized dependencies and services. | `pnpm run docker:down:oracle` | `docker compose -f "apps/backend-template/docker-compose-oracle.yml" down` |
| `docker:down:mongodb` | Start/stop containerized dependencies and services. | `pnpm run docker:down:mongodb` | `docker compose -f "apps/backend-template/docker-compose-mongodb.yml" down` |
| `docker:down:cassandra` | Start/stop containerized dependencies and services. | `pnpm run docker:down:cassandra` | `docker compose -f "apps/backend-template/docker-compose-cassandra.yml" down` |
| `docker:down:dynamodb` | Start/stop containerized dependencies and services. | `pnpm run docker:down:dynamodb` | `docker compose -f "apps/backend-template/docker-compose-dynamodb.yml" down` |
| `docker:down:firebase` | Start/stop containerized dependencies and services. | `pnpm run docker:down:firebase` | `docker compose -f "apps/backend-template/docker-compose-firebase.yml" down` |
| `docker:down:aurora` | Start/stop containerized dependencies and services. | `pnpm run docker:down:aurora` | `docker compose -f "apps/backend-template/docker-compose-aurora.yml" down` |
| `docker:down:rds` | Start/stop containerized dependencies and services. | `pnpm run docker:down:rds` | `docker compose -f "apps/backend-template/docker-compose-rds.yml" down` |
| `docker:compose:service-template` | Start/stop containerized dependencies and services. | `pnpm run docker:compose:service-template` | `docker compose -f "apps/backend-template/docker-compose-service-templates.yml" --profile ${AAA_SERVICE_PROFILE:-rest} up -d --build` |
| `docker:composerabbit` | Start/stop containerized dependencies and services. | `pnpm run docker:composerabbit` | `docker compose -f "apps/backend-template/docker-compose-messaging.yml" up -d rabbitmq` |
| `docker:stop` | Start/stop containerized dependencies and services. | `pnpm run docker:stop` | `docker-compose stop` |
| `docker:restart` | Start/stop containerized dependencies and services. | `pnpm run docker:restart` | `docker compose -f "apps/backend-template/docker-compose-redis.yml" down && pnpm run docker:composeredis` |
| `docker:restart:messaging` | Start/stop containerized dependencies and services. | `pnpm run docker:restart:messaging` | `docker compose -f "apps/backend-template/docker-compose-messaging.yml" down && pnpm run docker:composemessaging` |
| `smoke:realtime:redis-streams` | Run smoke checks for fast environment validation. | `pnpm run smoke:realtime:redis-streams` | `pnpm run docker:composeredis && pnpm run test:integration:realtime:redis-streams && docker compose -f "apps/backend-template/docker-compose-redis.yml" down` |
| `docker:stop:platform-services` | Start/stop containerized dependencies and services. | `pnpm run docker:stop:platform-services` | `docker compose -f "apps/backend-template/docker-compose-platform-services.yml" down` |
| `docker:stop:service-template` | Start/stop containerized dependencies and services. | `pnpm run docker:stop:service-template` | `docker compose -f "apps/backend-template/docker-compose-service-templates.yml" down` |
| `docker:clean` | Start/stop containerized dependencies and services. | `pnpm run docker:clean` | `docker system prune -a` |
