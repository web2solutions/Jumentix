# Referência de Scripts do Package.json (Consumidor)

Esta página lista todos os scripts do `package.json` raiz e como usar cada comando.

Padrão de uso:

```bash
pnpm run <comando>
```

| Comando | Quando usar | Como executar | Comando executado |
|---|---|---|---|
| `check-node-version` | Use quando precisar desta operação específica do workspace. | `pnpm run check-node-version` | `node ci-cd/check-node-version.js` |
| `preinstall` | Use quando precisar desta operação específica do workspace. | `pnpm run preinstall` | `node ci-cd/check-node-version.js` |
| `mono:build` | Execute operações recursivas no workspace inteiro. | `pnpm run mono:build` | `pnpm -r --workspace-concurrency=1 --if-present build` |
| `mono:test` | Execute operações recursivas no workspace inteiro. | `pnpm run mono:test` | `pnpm -r --workspace-concurrency=1 --if-present test` |
| `mono:lint` | Execute operações recursivas no workspace inteiro. | `pnpm run mono:lint` | `pnpm -r --workspace-concurrency=1 --if-present lint` |
| `mono:typecheck` | Execute operações recursivas no workspace inteiro. | `pnpm run mono:typecheck` | `pnpm -r --workspace-concurrency=1 --if-present typecheck` |
| `docs:translate:ptbr` | Gera ou sincroniza artefatos de documentação. | `pnpm run docs:translate:ptbr` | `node tooling/scripts/generate-ptbr-docs.mjs` |
| `docs:translate:ptbr:links` | Gera ou sincroniza artefatos de documentação. | `pnpm run docs:translate:ptbr:links` | `node tooling/scripts/patch-ptbr-links.mjs` |
| `docs:consumers:package-scripts` | Gera ou sincroniza artefatos de documentação. | `pnpm run docs:consumers:package-scripts` | `node tooling/scripts/generate-consumer-package-scripts-docs.mjs` |
| `prepare` | Instala hooks de git (husky). Geralmente roda automaticamente. | `pnpm run prepare` | `husky install` |
| `changelog:update` | Gera ou valida changelog a partir do histórico git. | `pnpm run changelog:update` | `node ci-cd/update-changelog.js` |
| `changelog:check` | Gera ou valida changelog a partir do histórico git. | `pnpm run changelog:check` | `node ci-cd/update-changelog.js --check` |
| `oas:check-routes` | Valida contratos OpenAPI e resolução de rotas. | `pnpm run oas:check-routes` | `node ci-cd/check-oas-route-resolution.js` |
| `deps:check-cycles` | Use quando precisar desta operação específica do workspace. | `pnpm run deps:check-cycles` | `node ci-cd/check-core-import-cycles.js` |
| `arch:check-boundaries` | Valida limites e restrições de arquitetura. | `pnpm run arch:check-boundaries` | `node ci-cd/check-hexagonal-boundaries.js` |
| `arch:check-users-legacy-imports` | Valida limites e restrições de arquitetura. | `pnpm run arch:check-users-legacy-imports` | `node ci-cd/check-users-legacy-imports.js` |
| `arch:check-workspace-boundaries` | Valida limites e restrições de arquitetura. | `pnpm run arch:check-workspace-boundaries` | `node ci-cd/check-workspace-boundaries.js` |
| `workspace:check-coverage-policy` | Valida políticas em nível de workspace. | `pnpm run workspace:check-coverage-policy` | `node ci-cd/check-workspace-coverage-policy.js` |
| `workspace:check-quality` | Valida políticas em nível de workspace. | `pnpm run workspace:check-quality` | `node ci-cd/check-workspace-quality.js` |
| `ci:affected` | Use em validações de CI e gates de entrega. | `pnpm run ci:affected` | `node ci-cd/check-affected-workspaces.js` |
| `ci:monorepo` | Use em validações de CI e gates de entrega. | `pnpm run ci:monorepo` | `node ci-cd/run-monorepo-ci.js` |
| `release:dry-run` | Executa governança de release e rotinas de dry-run. | `pnpm run release:dry-run` | `node ci-cd/release-dry-run.js all` |
| `release:dry-run:packages` | Executa governança de release e rotinas de dry-run. | `pnpm run release:dry-run:packages` | `node ci-cd/release-dry-run.js packages` |
| `release:dry-run:apps` | Executa governança de release e rotinas de dry-run. | `pnpm run release:dry-run:apps` | `node ci-cd/release-dry-run.js apps` |
| `agent-registry:check` | Use quando precisar desta operação específica do workspace. | `pnpm run agent-registry:check` | `node ci-cd/check-agent-registry-source.js --check` |
| `agent-registry:sync` | Use quando precisar desta operação específica do workspace. | `pnpm run agent-registry:sync` | `node ci-cd/check-agent-registry-source.js --sync` |
| `agent-registry:url` | Use quando precisar desta operação específica do workspace. | `pnpm run agent-registry:url` | `node ci-cd/check-agent-registry-source.js --url` |
| `release:governance:check` | Executa governança de release e rotinas de dry-run. | `pnpm run release:governance:check` | `node ci-cd/check-release-governance.js` |
| `pr:governance:check` | Use quando precisar desta operação específica do workspace. | `pnpm run pr:governance:check` | `node ci-cd/check-pr-governance.js` |
| `serverless:check-handlers` | Use quando precisar desta operação específica do workspace. | `pnpm run serverless:check-handlers` | `node ci-cd/check-serverless-handler-paths.js` |
| `ci:smoke` | Use em validações de CI e gates de entrega. | `pnpm run ci:smoke` | `AAA_JWT_TOKEN_SECRET_KEY=${AAA_JWT_TOKEN_SECRET_KEY:-ci_jwt_secret_key} NODE_ENV=ci node ci-cd/run-api-smoke.js` |
| `ci:integration` | Use em validações de CI e gates de entrega. | `pnpm run ci:integration` | `AAA_JWT_TOKEN_SECRET_KEY=${AAA_JWT_TOKEN_SECRET_KEY:-ci_jwt_secret_key} node ci-cd/run-integration-tests.js` |
| `ci:security-smoke` | Use em validações de CI e gates de entrega. | `pnpm run ci:security-smoke` | `NODE_ENV=ci node ci-cd/run-security-smoke.js` |
| `ci:gate` | Use em validações de CI e gates de entrega. | `pnpm run ci:gate` | `pnpm run lint && pnpm run deps:check-cycles && pnpm run arch:check-boundaries && pnpm run arch:check-users-legacy-imports && pnpm run arch:check-workspace-boundaries && pnpm run workspace:check-quality && pnpm run workspace:check-coverage-policy && pnpm run release:governance:check && pnpm run agent-registry:check && pnpm run test:unit && pnpm run ci:security-smoke && pnpm run oas:check-routes && pnpm run serverless:check-handlers && pnpm run build:dev && pnpm run ci:smoke` |
| `ci:gate:branch` | Use em validações de CI e gates de entrega. | `pnpm run ci:gate:branch` | `node ci-cd/run-branch-quality-gate.js` |
| `ci:gate:task` | Use em validações de CI e gates de entrega. | `pnpm run ci:gate:task` | `node ci-cd/run-task-change-tests.js` |
| `ci:gate:strict` | Use em validações de CI e gates de entrega. | `pnpm run ci:gate:strict` | `node ci-cd/run-full-test-matrix.js` |
| `dev` | Entrypoint local padrão; inicia perfil PM2 de desenvolvimento. | `pnpm run dev` | `pnpm run pm2:start:dev:restapi` |
| `website:dev` | Opera o ciclo de vida do site comercial. | `pnpm run website:dev` | `pnpm --filter @jumentix/website dev` |
| `website:build` | Opera o ciclo de vida do site comercial. | `pnpm run website:build` | `pnpm --filter @jumentix/website build` |
| `website:start` | Opera o ciclo de vida do site comercial. | `pnpm run website:start` | `pnpm --filter @jumentix/website start` |
| `website:storybook` | Opera o ciclo de vida do site comercial. | `pnpm run website:storybook` | `pnpm --filter @jumentix/website storybook` |
| `website:storybook:build` | Opera o ciclo de vida do site comercial. | `pnpm run website:storybook:build` | `pnpm --filter @jumentix/website storybook:build` |
| `website:storybook:smoke` | Opera o ciclo de vida do site comercial. | `pnpm run website:storybook:smoke` | `pnpm --filter @jumentix/website storybook:smoke` |
| `website:test:prepublish` | Opera o ciclo de vida do site comercial. | `pnpm run website:test:prepublish` | `pnpm --filter @jumentix/website test:prepublish` |
| `website:vercel:link` | Opera o ciclo de vida do site comercial. | `pnpm run website:vercel:link` | `pnpm dlx vercel link --cwd apps/jumentix-website --project jumentix-website --yes` |
| `website:vercel:pull:preview` | Opera o ciclo de vida do site comercial. | `pnpm run website:vercel:pull:preview` | `pnpm dlx vercel pull --cwd apps/jumentix-website --environment=preview --yes` |
| `website:vercel:pull:prod` | Opera o ciclo de vida do site comercial. | `pnpm run website:vercel:pull:prod` | `pnpm dlx vercel pull --cwd apps/jumentix-website --environment=production --yes` |
| `website:deploy:vercel` | Opera o ciclo de vida do site comercial. | `pnpm run website:deploy:vercel` | `pnpm dlx vercel --cwd apps/jumentix-website --prod` |
| `website:publish` | Opera o ciclo de vida do site comercial. | `pnpm run website:publish` | `pnpm run website:test:prepublish && pnpm run website:deploy:vercel` |
| `website:deploy:vercel:preview` | Opera o ciclo de vida do site comercial. | `pnpm run website:deploy:vercel:preview` | `pnpm dlx vercel --cwd apps/jumentix-website` |
| `npm:whoami` | Executa comandos auxiliares de organização e publicação npm. | `pnpm run npm:whoami` | `pnpm whoami` |
| `npm:org:check:xpertminds` | Executa comandos auxiliares de organização e publicação npm. | `pnpm run npm:org:check:xpertminds` | `node ci-cd/check-npm-org-integration.js` |
| `npm:publish:dry-run:packages` | Executa comandos auxiliares de organização e publicação npm. | `pnpm run npm:publish:dry-run:packages` | `node ci-cd/npm-publish-dry-run.js` |
| `pm2:list` | Gerencia processos de runtime com PM2. | `pnpm run pm2:list` | `pm2 ls` |
| `pm2:logs` | Gerencia processos de runtime com PM2. | `pnpm run pm2:logs` | `pm2 logs` |
| `pm2:stop:all` | Gerencia processos de runtime com PM2. | `pnpm run pm2:stop:all` | `pm2 stop all` |
| `pm2:delete:all` | Gerencia processos de runtime com PM2. | `pnpm run pm2:delete:all` | `pm2 delete all` |
| `pm2:start:dev:restapi` | Gerencia processos de runtime com PM2. | `pnpm run pm2:start:dev:restapi` | `pm2 start ./pm2/ecosystem.dev.cjs --only aaa-dev-service-management,aaa-dev-restapi --update-env` |
| `pm2:start:dev:websocket-rest` | Gerencia processos de runtime com PM2. | `pnpm run pm2:start:dev:websocket-rest` | `pm2 start ./pm2/ecosystem.dev.cjs --only aaa-dev-service-management,aaa-dev-restapi,aaa-dev-websocketapi --update-env` |
| `pm2:start:dev:grpc-rest` | Gerencia processos de runtime com PM2. | `pnpm run pm2:start:dev:grpc-rest` | `pm2 start ./pm2/ecosystem.dev.cjs --only aaa-dev-service-management,aaa-dev-restapi,aaa-dev-grpcapi --update-env` |
| `pm2:start:staging:restapi` | Gerencia processos de runtime com PM2. | `pnpm run pm2:start:staging:restapi` | `pm2 start ./pm2/ecosystem.staging.cjs --only aaa-staging-service-management,aaa-staging-restapi --update-env` |
| `pm2:start:staging:websocket-rest` | Gerencia processos de runtime com PM2. | `pnpm run pm2:start:staging:websocket-rest` | `pm2 start ./pm2/ecosystem.staging.cjs --only aaa-staging-service-management,aaa-staging-restapi,aaa-staging-websocketapi --update-env` |
| `pm2:start:staging:grpc-rest` | Gerencia processos de runtime com PM2. | `pnpm run pm2:start:staging:grpc-rest` | `pm2 start ./pm2/ecosystem.staging.cjs --only aaa-staging-service-management,aaa-staging-restapi,aaa-staging-grpcapi --update-env` |
| `pm2:start:prod:restapi` | Gerencia processos de runtime com PM2. | `pnpm run pm2:start:prod:restapi` | `pm2 start ./pm2/ecosystem.production.cjs --only aaa-prod-service-management,aaa-prod-restapi --update-env` |
| `pm2:start:prod:websocket-rest` | Gerencia processos de runtime com PM2. | `pnpm run pm2:start:prod:websocket-rest` | `pm2 start ./pm2/ecosystem.production.cjs --only aaa-prod-service-management,aaa-prod-restapi,aaa-prod-websocketapi --update-env` |
| `pm2:start:prod:grpc-rest` | Gerencia processos de runtime com PM2. | `pnpm run pm2:start:prod:grpc-rest` | `pm2 start ./pm2/ecosystem.production.cjs --only aaa-prod-service-management,aaa-prod-restapi,aaa-prod-grpcapi --update-env` |
| `commit` | Use quando precisar desta operação específica do workspace. | `pnpm run commit` | `pnpm run lint && pnpm run test && node -r ts-node/register ci-cd/bumpPackage.ts && git add . && git-cz` |
| `lint` | Roda checks de lint antes de commit/PR. | `pnpm run lint` | `eslint . --ext .ts` |
| `lint:fix` | Use quando precisar desta operação específica do workspace. | `pnpm run lint:fix` | `eslint . --ext .ts --fix` |
| `build:dev` | Use quando precisar desta operação específica do workspace. | `pnpm run build:dev` | `NODE_ENV=dev tsc -p tsconfig.build.json` |
| `build:prod` | Use quando precisar desta operação específica do workspace. | `pnpm run build:prod` | `NODE_ENV=prod tsc -p tsconfig.build.json` |
| `tdd` | Use quando precisar desta operação específica do workspace. | `pnpm run tdd` | `NODE_ENV=dev pnpm exec jest --watchAll` |
| `npm` | Use quando precisar desta operação específica do workspace. | `pnpm run npm` | `NODE_ENV=ci pnpm exec jest ./apps/backend-template/test` |
| `test` | Executa a suíte padrão de testes do backend-template. | `pnpm run test` | `NODE_ENV=dev pnpm exec jest ./apps/backend-template/test` |
| `test:unit` | Roda testes para escopo ou perfil específico. | `pnpm run test:unit` | `NODE_ENV=dev node ci-cd/run-unit-tests.js` |
| `coverage:patch` | Use quando precisar desta operação específica do workspace. | `pnpm run coverage:patch` | `node ci-cd/check-patch-coverage.js` |
| `test:integration` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration` | `node ci-cd/run-integration-tests.js` |
| `test:integration:express` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:express` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Express --runInBand --coverage=false` |
| `test:integration:fastify` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:fastify` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Fastify --runInBand --coverage=false` |
| `test:integration:restify` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:restify` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Restify --runInBand --coverage=false` |
| `test:integration:lambda` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:lambda` | `AAA_MESSAGE_MEDIATOR_ADAPTER=inmemory NODE_ENV=dev jest ./apps/backend-template/test/integration/Lambda --runInBand --coverage=false` |
| `test:integration:hyper-express` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:hyper-express` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Hyper-Express --runInBand --coverage=false` |
| `test:integration:cloudflare-workers` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:cloudflare-workers` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Cloudflare-Workers --runInBand --coverage=false` |
| `test:integration:vercel-functions` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:vercel-functions` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Vercel-Functions --runInBand --coverage=false` |
| `test:integration:loopback` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:loopback` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/LoopBack --runInBand --coverage=false` |
| `test:integration:sails-js` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:sails-js` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Sails-JS --runInBand --coverage=false` |
| `test:integration:feathers` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:feathers` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Feathers --runInBand --coverage=false` |
| `test:integration:derby-js` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:derby-js` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Derby-JS --runInBand --coverage=false` |
| `test:integration:adonis-js` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:adonis-js` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Adonis-JS --runInBand --coverage=false` |
| `test:integration:total-js` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:total-js` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/Total-JS --runInBand --coverage=false` |
| `test:integration:service-management` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:service-management` | `NODE_ENV=dev node ci-cd/run-service-management-integration.js` |
| `test:integration:service-mangement` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:service-mangement` | `pnpm run test:integration:service-management` |
| `test:integration:realtime:websocket` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:realtime:websocket` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/realtime/websocket.basic.integration.test.ts --runInBand --coverage=false` |
| `test:integration:realtime:grpc` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:realtime:grpc` | `NODE_ENV=dev jest ./apps/backend-template/test/integration/realtime/grpc.basic.integration.test.ts --runInBand --coverage=false` |
| `test:integration:realtime` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:realtime` | `pnpm run test:integration:realtime:websocket && pnpm run test:integration:realtime:grpc` |
| `test:integration:realtime:redis-streams` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:realtime:redis-streams` | `RUN_REDIS_INTEGRATION=1 NODE_ENV=dev jest ./apps/backend-template/test/integration/realtime/socketio.redis-streams.multi-instance.test.ts --runInBand --coverage=false` |
| `test:integration:db` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:db` | `pnpm run test:smoke:db:all` |
| `test:integration:db:inmemory` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:db:inmemory` | `pnpm run test:smoke:db:inmemory` |
| `test:integration:db:sqlite` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:db:sqlite` | `pnpm run test:smoke:db:sqlite` |
| `test:integration:db:postgresql` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:db:postgresql` | `pnpm run smoke:db:postgresql` |
| `test:integration:db:mysql` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:db:mysql` | `pnpm run smoke:db:mysql` |
| `test:integration:db:mssql` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:db:mssql` | `pnpm run smoke:db:mssql` |
| `test:integration:db:oracle` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:db:oracle` | `pnpm run smoke:db:oracle` |
| `test:integration:db:mongo` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:db:mongo` | `pnpm run smoke:db:mongodb` |
| `test:integration:db:cassandra` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:db:cassandra` | `pnpm run smoke:db:cassandra` |
| `test:integration:db:dynamodb` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:db:dynamodb` | `pnpm run smoke:db:dynamodb` |
| `test:integration:db:firebase` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:db:firebase` | `pnpm run smoke:db:firebase` |
| `test:integration:db:aurora` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:db:aurora` | `pnpm run smoke:db:aurora` |
| `test:integration:db:rds` | Roda testes para escopo ou perfil específico. | `pnpm run test:integration:db:rds` | `pnpm run smoke:db:rds` |
| `test:smoke` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke` | `pnpm run ci:smoke` |
| `test:smoke:security` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:security` | `pnpm run ci:security-smoke` |
| `test:smoke:api` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:api` | `pnpm run ci:smoke` |
| `test:smoke:db` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:db` | `RUN_DB_SMOKE=1 NODE_ENV=dev jest ./apps/backend-template/test/smoke/database/DatabaseDrivers.smoke.test.ts --runInBand --coverage=false` |
| `test:smoke:realtime` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:realtime` | `NODE_ENV=dev jest ./apps/backend-template/test/smoke/realtime/RealtimeApis.smoke.test.ts --runInBand --coverage=false` |
| `test:smoke:db:inmemory` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:db:inmemory` | `AAA_DB_SMOKE_DRIVERS=InMemory pnpm run test:smoke:db` |
| `test:smoke:db:postgresql` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:db:postgresql` | `AAA_DB_SMOKE_DRIVERS=PostgreSQL pnpm run test:smoke:db` |
| `test:smoke:db:mysql` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:db:mysql` | `AAA_DB_SMOKE_DRIVERS=MySQL pnpm run test:smoke:db` |
| `test:smoke:db:mssql` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:db:mssql` | `AAA_DB_SMOKE_DRIVERS=MSSQL pnpm run test:smoke:db` |
| `test:smoke:db:oracle` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:db:oracle` | `AAA_DB_SMOKE_DRIVERS=Oracle pnpm run test:smoke:db` |
| `test:smoke:db:sqlite` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:db:sqlite` | `AAA_DB_SMOKE_DRIVERS=SQLite pnpm run test:smoke:db` |
| `test:smoke:db:mongo` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:db:mongo` | `AAA_DATABASE_CONNECTION_URL=mongodb://127.0.0.1:27027/aaa AAA_DB_SMOKE_DRIVERS=Mongo pnpm run test:smoke:db` |
| `test:smoke:db:cassandra` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:db:cassandra` | `AAA_DB_SMOKE_DRIVERS=Cassandra pnpm run test:smoke:db` |
| `test:smoke:db:dynamodb` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:db:dynamodb` | `AAA_DB_SMOKE_DRIVERS=DynamoDB pnpm run test:smoke:db` |
| `test:smoke:db:firebase` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:db:firebase` | `AAA_DB_SMOKE_DRIVERS=Firebase pnpm run test:smoke:db` |
| `test:smoke:db:aurora` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:db:aurora` | `AAA_DB_SMOKE_DRIVERS=Aurora pnpm run test:smoke:db` |
| `test:smoke:db:rds` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:db:rds` | `AAA_DB_SMOKE_DRIVERS=RDS pnpm run test:smoke:db` |
| `test:smoke:db:all` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:db:all` | `pnpm run smoke:db:inmemory && pnpm run smoke:db:sqlite && pnpm run smoke:db:postgresql && pnpm run smoke:db:mongodb && pnpm run smoke:db:mysql && pnpm run smoke:db:mssql && pnpm run smoke:db:dynamodb && pnpm run smoke:db:cassandra && pnpm run smoke:db:oracle && pnpm run smoke:db:firebase && pnpm run smoke:db:aurora && pnpm run smoke:db:rds` |
| `test:smoke:all` | Roda testes para escopo ou perfil específico. | `pnpm run test:smoke:all` | `pnpm run test:smoke:security && pnpm run test:smoke:api && pnpm run test:smoke:realtime && pnpm run test:smoke:db:all` |
| `smoke:db:postgresql` | Executa smoke checks para validação rápida de ambiente. | `pnpm run smoke:db:postgresql` | `pnpm run docker:up:postgresql && pnpm run test:smoke:db:postgresql && pnpm run docker:down:postgresql` |
| `smoke:db:mysql` | Executa smoke checks para validação rápida de ambiente. | `pnpm run smoke:db:mysql` | `pnpm run docker:up:mysql && pnpm run test:smoke:db:mysql && pnpm run docker:down:mysql` |
| `smoke:db:mssql` | Executa smoke checks para validação rápida de ambiente. | `pnpm run smoke:db:mssql` | `pnpm run docker:up:mssql && pnpm run test:smoke:db:mssql && pnpm run docker:down:mssql` |
| `smoke:db:oracle` | Executa smoke checks para validação rápida de ambiente. | `pnpm run smoke:db:oracle` | `pnpm run docker:up:oracle && pnpm run test:smoke:db:oracle && pnpm run docker:down:oracle` |
| `smoke:db:mongodb` | Executa smoke checks para validação rápida de ambiente. | `pnpm run smoke:db:mongodb` | `pnpm run docker:up:mongodb && pnpm run test:smoke:db:mongo && pnpm run docker:down:mongodb` |
| `smoke:db:cassandra` | Executa smoke checks para validação rápida de ambiente. | `pnpm run smoke:db:cassandra` | `pnpm run docker:up:cassandra && pnpm run test:smoke:db:cassandra && pnpm run docker:down:cassandra` |
| `smoke:db:dynamodb` | Executa smoke checks para validação rápida de ambiente. | `pnpm run smoke:db:dynamodb` | `pnpm run docker:up:dynamodb && pnpm run test:smoke:db:dynamodb && pnpm run docker:down:dynamodb` |
| `smoke:db:firebase` | Executa smoke checks para validação rápida de ambiente. | `pnpm run smoke:db:firebase` | `pnpm run docker:up:firebase && pnpm run test:smoke:db:firebase && pnpm run docker:down:firebase` |
| `smoke:db:aurora` | Executa smoke checks para validação rápida de ambiente. | `pnpm run smoke:db:aurora` | `pnpm run docker:up:aurora && pnpm run test:smoke:db:aurora && pnpm run docker:down:aurora` |
| `smoke:db:rds` | Executa smoke checks para validação rápida de ambiente. | `pnpm run smoke:db:rds` | `pnpm run docker:up:rds && pnpm run test:smoke:db:rds && pnpm run docker:down:rds` |
| `smoke:db:sqlite` | Executa smoke checks para validação rápida de ambiente. | `pnpm run smoke:db:sqlite` | `pnpm run test:smoke:db:sqlite` |
| `smoke:db:inmemory` | Executa smoke checks para validação rápida de ambiente. | `pnpm run smoke:db:inmemory` | `pnpm run test:smoke:db:inmemory` |
| `dev:http` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:http` | `pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-http --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:express` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:express` | `AAA_HTTP_FRAMEWORK=express pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-express --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:fastify` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:fastify` | `AAA_HTTP_FRAMEWORK=fastify pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-fastify --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:restify` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:restify` | `AAA_HTTP_FRAMEWORK=restify pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-restify --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:hyper-express` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:hyper-express` | `AAA_HTTP_FRAMEWORK=hyper-express pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-hyper-express --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:cloudflare-workers` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:cloudflare-workers` | `AAA_HTTP_FRAMEWORK=cloudflare-workers pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-cloudflare-workers --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:vercel-functions` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:vercel-functions` | `AAA_HTTP_FRAMEWORK=vercel-functions pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-vercel-functions --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:loopback` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:loopback` | `AAA_HTTP_FRAMEWORK=loopback pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-loopback --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:sails-js` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:sails-js` | `AAA_HTTP_FRAMEWORK=sails-js pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-sails-js --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:feathers` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:feathers` | `AAA_HTTP_FRAMEWORK=feathers pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-feathers --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:derby-js` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:derby-js` | `AAA_HTTP_FRAMEWORK=derby-js pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-derby-js --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:adonis-js` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:adonis-js` | `AAA_HTTP_FRAMEWORK=adonis-js pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-adonis-js --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:total-js` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:total-js` | `AAA_HTTP_FRAMEWORK=total-js pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name aaa-dev-total-js --interpreter node --node-args='-r ts-node/register -r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:websocket` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:websocket` | `pnpm run pm2:start:dev:websocket-rest` |
| `dev:grpc` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:grpc` | `pnpm run pm2:start:dev:grpc-rest` |
| `dev:serverless` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:serverless` | `pnpm run lint && NODE_ENV=dev serverless dev` |
| `cli` | Use quando precisar desta operação específica do workspace. | `pnpm run cli` | `pnpm run dev:cli` |
| `cli:bootstrap` | Use quando precisar desta operação específica do workspace. | `pnpm run cli:bootstrap` | `node ./bin/aaa-bootstrap.js` |
| `dev:cli` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:cli` | `node -r ts-node/register -r tsconfig-paths/register ./apps/backend-template/src/interface/CLI/index.ts` |
| `dev:service-management` | Inicia o modo de runtime para desenvolvimento. | `pnpm run dev:service-management` | `pm2 start ./apps/service-management/server.js --name aaa-dev-service-management --interpreter node --update-env` |
| `start:cli` | Use quando precisar desta operação específica do workspace. | `pnpm run start:cli` | `pnpm run dev:cli` |
| `prod:http` | Inicia o perfil de runtime de produção. | `pnpm run prod:http` | `pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-http --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:express` | Inicia o perfil de runtime de produção. | `pnpm run prod:express` | `AAA_HTTP_FRAMEWORK=express pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-express --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:fastify` | Inicia o perfil de runtime de produção. | `pnpm run prod:fastify` | `AAA_HTTP_FRAMEWORK=fastify pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-fastify --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:restify` | Inicia o perfil de runtime de produção. | `pnpm run prod:restify` | `AAA_HTTP_FRAMEWORK=restify pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-restify --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:hyper-express` | Inicia o perfil de runtime de produção. | `pnpm run prod:hyper-express` | `AAA_HTTP_FRAMEWORK=hyper-express pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-hyper-express --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:cloudflare-workers` | Inicia o perfil de runtime de produção. | `pnpm run prod:cloudflare-workers` | `AAA_HTTP_FRAMEWORK=cloudflare-workers pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-cloudflare-workers --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:vercel-functions` | Inicia o perfil de runtime de produção. | `pnpm run prod:vercel-functions` | `AAA_HTTP_FRAMEWORK=vercel-functions pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-vercel-functions --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:loopback` | Inicia o perfil de runtime de produção. | `pnpm run prod:loopback` | `AAA_HTTP_FRAMEWORK=loopback pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-loopback --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:sails-js` | Inicia o perfil de runtime de produção. | `pnpm run prod:sails-js` | `AAA_HTTP_FRAMEWORK=sails-js pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-sails-js --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:feathers` | Inicia o perfil de runtime de produção. | `pnpm run prod:feathers` | `AAA_HTTP_FRAMEWORK=feathers pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-feathers --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:derby-js` | Inicia o perfil de runtime de produção. | `pnpm run prod:derby-js` | `AAA_HTTP_FRAMEWORK=derby-js pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-derby-js --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:adonis-js` | Inicia o perfil de runtime de produção. | `pnpm run prod:adonis-js` | `AAA_HTTP_FRAMEWORK=adonis-js pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-adonis-js --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:total-js` | Inicia o perfil de runtime de produção. | `pnpm run prod:total-js` | `AAA_HTTP_FRAMEWORK=total-js pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name aaa-prod-total-js --interpreter node --node-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:websocket` | Inicia o perfil de runtime de produção. | `pnpm run prod:websocket` | `pnpm run pm2:start:prod:websocket-rest` |
| `prod:grpc` | Inicia o perfil de runtime de produção. | `pnpm run prod:grpc` | `pnpm run pm2:start:prod:grpc-rest` |
| `staging:restapi` | Inicia o perfil de runtime de staging. | `pnpm run staging:restapi` | `pnpm run pm2:start:staging:restapi` |
| `staging:websocket` | Inicia o perfil de runtime de staging. | `pnpm run staging:websocket` | `pnpm run pm2:start:staging:websocket-rest` |
| `staging:grpc` | Inicia o perfil de runtime de staging. | `pnpm run staging:grpc` | `pnpm run pm2:start:staging:grpc-rest` |
| `prod:serverless` | Inicia o perfil de runtime de produção. | `pnpm run prod:serverless` | `pnpm run lint && NODE_ENV=prod serverless dev` |
| `docker:composeredis` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:composeredis` | `docker compose -f "apps/backend-template/docker-compose-redis.yml" up -d --build` |
| `docker:composemessaging` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:composemessaging` | `docker compose -f "apps/backend-template/docker-compose-messaging.yml" up -d --build` |
| `docker:compose:platform-services` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:compose:platform-services` | `docker compose -f "apps/backend-template/docker-compose-platform-services.yml" up -d --build` |
| `docker:up:postgresql` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:up:postgresql` | `docker compose -f "apps/backend-template/docker-compose-postgresql.yml" up -d --build` |
| `docker:up:mysql` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:up:mysql` | `docker compose -f "apps/backend-template/docker-compose-mysql.yml" up -d --build` |
| `docker:up:mssql` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:up:mssql` | `docker compose -f "apps/backend-template/docker-compose-mssql.yml" up -d --build` |
| `docker:up:oracle` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:up:oracle` | `docker compose -f "apps/backend-template/docker-compose-oracle.yml" up -d --build` |
| `docker:up:mongodb` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:up:mongodb` | `docker compose -f "apps/backend-template/docker-compose-mongodb.yml" up -d --build` |
| `docker:up:cassandra` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:up:cassandra` | `docker compose -f "apps/backend-template/docker-compose-cassandra.yml" up -d --build` |
| `docker:up:dynamodb` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:up:dynamodb` | `docker compose -f "apps/backend-template/docker-compose-dynamodb.yml" up -d --build` |
| `docker:up:firebase` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:up:firebase` | `docker compose -f "apps/backend-template/docker-compose-firebase.yml" up -d --build` |
| `docker:up:aurora` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:up:aurora` | `docker compose -f "apps/backend-template/docker-compose-aurora.yml" up -d --build` |
| `docker:up:rds` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:up:rds` | `docker compose -f "apps/backend-template/docker-compose-rds.yml" up -d --build` |
| `docker:down:postgresql` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:down:postgresql` | `docker compose -f "apps/backend-template/docker-compose-postgresql.yml" down` |
| `docker:down:mysql` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:down:mysql` | `docker compose -f "apps/backend-template/docker-compose-mysql.yml" down` |
| `docker:down:mssql` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:down:mssql` | `docker compose -f "apps/backend-template/docker-compose-mssql.yml" down` |
| `docker:down:oracle` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:down:oracle` | `docker compose -f "apps/backend-template/docker-compose-oracle.yml" down` |
| `docker:down:mongodb` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:down:mongodb` | `docker compose -f "apps/backend-template/docker-compose-mongodb.yml" down` |
| `docker:down:cassandra` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:down:cassandra` | `docker compose -f "apps/backend-template/docker-compose-cassandra.yml" down` |
| `docker:down:dynamodb` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:down:dynamodb` | `docker compose -f "apps/backend-template/docker-compose-dynamodb.yml" down` |
| `docker:down:firebase` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:down:firebase` | `docker compose -f "apps/backend-template/docker-compose-firebase.yml" down` |
| `docker:down:aurora` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:down:aurora` | `docker compose -f "apps/backend-template/docker-compose-aurora.yml" down` |
| `docker:down:rds` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:down:rds` | `docker compose -f "apps/backend-template/docker-compose-rds.yml" down` |
| `docker:compose:service-template` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:compose:service-template` | `docker compose -f "apps/backend-template/docker-compose-service-templates.yml" --profile ${AAA_SERVICE_PROFILE:-rest} up -d --build` |
| `docker:composerabbit` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:composerabbit` | `docker compose -f "apps/backend-template/docker-compose-messaging.yml" up -d rabbitmq` |
| `docker:stop` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:stop` | `docker-compose stop` |
| `docker:restart` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:restart` | `docker compose -f "apps/backend-template/docker-compose-redis.yml" down && pnpm run docker:composeredis` |
| `docker:restart:messaging` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:restart:messaging` | `docker compose -f "apps/backend-template/docker-compose-messaging.yml" down && pnpm run docker:composemessaging` |
| `smoke:realtime:redis-streams` | Executa smoke checks para validação rápida de ambiente. | `pnpm run smoke:realtime:redis-streams` | `pnpm run docker:composeredis && pnpm run test:integration:realtime:redis-streams && docker compose -f "apps/backend-template/docker-compose-redis.yml" down` |
| `docker:stop:platform-services` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:stop:platform-services` | `docker compose -f "apps/backend-template/docker-compose-platform-services.yml" down` |
| `docker:stop:service-template` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:stop:service-template` | `docker compose -f "apps/backend-template/docker-compose-service-templates.yml" down` |
| `docker:clean` | Sobe/derruba dependências e serviços em containers. | `pnpm run docker:clean` | `docker system prune -a` |
