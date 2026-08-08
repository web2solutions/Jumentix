# Referência de Scripts do Package.json (Consumidor)

Esta página lista todos os scripts do `package.json` raiz e como usar cada comando.

Padrão de uso:

```bash
bun run <comando>
```

| Comando | Quando usar | Como executar | Comando executado |
|---|---|---|---|
| `check-bun-version` | Use quando precisar desta operação específica do workspace. | `bun run check-bun-version` | `bun ci-cd/check-bun-version.js` |
| `compat:check-node-version` | Use quando precisar desta operação específica do workspace. | `bun run compat:check-node-version` | `node ci-cd/check-node-version.js` |
| `preinstall` | Use quando precisar desta operação específica do workspace. | `bun run preinstall` | `bun ci-cd/check-bun-version.js` |
| `deps:check-overrides` | Use quando precisar desta operação específica do workspace. | `bun run deps:check-overrides` | `bun ci-cd/check-dependency-override-integrity.js` |
| `mono:build` | Execute operações recursivas no workspace inteiro. | `bun run mono:build` | `bun run --filter '*' build` |
| `mono:test` | Execute operações recursivas no workspace inteiro. | `bun run mono:test` | `bun run workspace:test` |
| `mono:lint` | Execute operações recursivas no workspace inteiro. | `bun run mono:lint` | `bun run --filter '*' lint` |
| `mono:typecheck` | Execute operações recursivas no workspace inteiro. | `bun run mono:typecheck` | `bun run --filter '*' typecheck` |
| `docs:translate:ptbr` | Gera ou sincroniza artefatos de documentação. | `bun run docs:translate:ptbr` | `bun tooling/scripts/generate-ptbr-docs.mjs` |
| `docs:translate:ptbr:links` | Gera ou sincroniza artefatos de documentação. | `bun run docs:translate:ptbr:links` | `bun tooling/scripts/patch-ptbr-links.mjs` |
| `docs:consumers:package-scripts` | Gera ou sincroniza artefatos de documentação. | `bun run docs:consumers:package-scripts` | `bun tooling/scripts/generate-consumer-package-scripts-docs.mjs` |
| `prepare` | Instala hooks de git (husky). Geralmente roda automaticamente. | `bun run prepare` | `husky install` |
| `changelog:update` | Gera ou valida changelog a partir do histórico git. | `bun run changelog:update` | `bun ci-cd/update-changelog.js` |
| `changelog:check` | Gera ou valida changelog a partir do histórico git. | `bun run changelog:check` | `bun ci-cd/update-changelog.js --check` |
| `oas:check-routes` | Valida contratos OpenAPI e resolução de rotas. | `bun run oas:check-routes` | `bun ci-cd/check-oas-route-resolution.js` |
| `deps:check-cycles` | Use quando precisar desta operação específica do workspace. | `bun run deps:check-cycles` | `bun ci-cd/check-core-import-cycles.js` |
| `arch:check-boundaries` | Valida limites e restrições de arquitetura. | `bun run arch:check-boundaries` | `bun ci-cd/check-hexagonal-boundaries.js` |
| `arch:check-users-legacy-imports` | Valida limites e restrições de arquitetura. | `bun run arch:check-users-legacy-imports` | `bun ci-cd/check-users-legacy-imports.js` |
| `arch:check-workspace-boundaries` | Valida limites e restrições de arquitetura. | `bun run arch:check-workspace-boundaries` | `bun ci-cd/check-workspace-boundaries.js` |
| `workspace:check-coverage-policy` | Valida políticas em nível de workspace. | `bun run workspace:check-coverage-policy` | `bun ci-cd/check-workspace-coverage-policy.js` |
| `workspace:check-quality` | Valida políticas em nível de workspace. | `bun run workspace:check-quality` | `bun ci-cd/check-workspace-quality.js` |
| `ci:affected` | Use em validações de CI e gates de entrega. | `bun run ci:affected` | `bun ci-cd/check-affected-workspaces.js` |
| `ci:monorepo` | Use em validações de CI e gates de entrega. | `bun run ci:monorepo` | `bun ci-cd/run-monorepo-ci.js` |
| `release:dry-run` | Executa governança de release e rotinas de dry-run. | `bun run release:dry-run` | `bun ci-cd/release-dry-run.js all` |
| `release:dry-run:packages` | Executa governança de release e rotinas de dry-run. | `bun run release:dry-run:packages` | `bun ci-cd/release-dry-run.js packages` |
| `release:dry-run:apps` | Executa governança de release e rotinas de dry-run. | `bun run release:dry-run:apps` | `bun ci-cd/release-dry-run.js apps` |
| `agent-registry:register` | Use quando precisar desta operação específica do workspace. | `bun run agent-registry:register` | `bun ci-cd/agent-registry-cli.js register` |
| `agent-registry:heartbeat` | Use quando precisar desta operação específica do workspace. | `bun run agent-registry:heartbeat` | `bun ci-cd/agent-registry-cli.js heartbeat` |
| `agent-registry:assign` | Use quando precisar desta operação específica do workspace. | `bun run agent-registry:assign` | `bun ci-cd/agent-registry-cli.js assign` |
| `agent-registry:complete` | Use quando precisar desta operação específica do workspace. | `bun run agent-registry:complete` | `bun ci-cd/agent-registry-cli.js complete` |
| `agent-registry:sync` | Use quando precisar desta operação específica do workspace. | `bun run agent-registry:sync` | `bun ci-cd/agent-registry-cli.js sync` |
| `agent-registry:check` | Use quando precisar desta operação específica do workspace. | `bun run agent-registry:check` | `bun ci-cd/agent-registry-cli.js check` |
| `arch:check-http-adapters` | Valida limites e restrições de arquitetura. | `bun run arch:check-http-adapters` | `bun ci-cd/check-http-adapter-authenticity.js` |
| `ci:check-provider` | Use em validações de CI e gates de entrega. | `bun run ci:check-provider` | `bun ci-cd/check-ci-provider.js` |
| `ci:check-third-party-review` | Use em validações de CI e gates de entrega. | `bun run ci:check-third-party-review` | `bun ci-cd/check-third-party-review.js` |
| `requirements:check` | Use quando precisar desta operação específica do workspace. | `bun run requirements:check` | `bun ci-cd/check-requirements-registry.js` |
| `test-map:generate` | Use quando precisar desta operação específica do workspace. | `bun run test-map:generate` | `bun ci-cd/generate-test-map.js` |
| `test-map:check` | Use quando precisar desta operação específica do workspace. | `bun run test-map:check` | `bun ci-cd/check-test-map.js` |
| `integration-migration:check` | Use quando precisar desta operação específica do workspace. | `bun run integration-migration:check` | `bun ci-cd/check-integration-migration.js` |
| `release:governance:check` | Executa governança de release e rotinas de dry-run. | `bun run release:governance:check` | `bun ci-cd/check-release-governance.js` |
| `governance:check-authorship` | Use quando precisar desta operação específica do workspace. | `bun run governance:check-authorship` | `bun ci-cd/check-commit-authorship.js` |
| `packages:check-suites` | Use quando precisar desta operação específica do workspace. | `bun run packages:check-suites` | `bun ci-cd/check-package-suites.js` |
| `governance:check-identity` | Use quando precisar desta operação específica do workspace. | `bun run governance:check-identity` | `bun ci-cd/check-commit-authorship.js --identity` |
| `pr:governance:check` | Use quando precisar desta operação específica do workspace. | `bun run pr:governance:check` | `bun ci-cd/check-pr-governance.js` |
| `serverless:check-handlers` | Use quando precisar desta operação específica do workspace. | `bun run serverless:check-handlers` | `bun ci-cd/check-serverless-handler-paths.js` |
| `ci:smoke` | Use em validações de CI e gates de entrega. | `bun run ci:smoke` | `JUMENTIX_JWT_TOKEN_SECRET_KEY=${JUMENTIX_JWT_TOKEN_SECRET_KEY:-ci_jwt_secret_key} NODE_ENV=ci bun ci-cd/run-api-smoke.js` |
| `ci:integration` | Use em validações de CI e gates de entrega. | `bun run ci:integration` | `JUMENTIX_JWT_TOKEN_SECRET_KEY=${JUMENTIX_JWT_TOKEN_SECRET_KEY:-ci_jwt_secret_key} bun ci-cd/run-integration-tests.js` |
| `ci:security-smoke` | Use em validações de CI e gates de entrega. | `bun run ci:security-smoke` | `NODE_ENV=ci bun ci-cd/run-security-smoke.js` |
| `ci:gate` | Use em validações de CI e gates de entrega. | `bun run ci:gate` | `bun run check-bun-version && bun run deps:check-overrides && bun run deps:audit && bun run lint && bun run deps:check-cycles && bun run arch:check-boundaries && bun run arch:check-users-legacy-imports && bun run arch:check-workspace-boundaries && bun run arch:check-http-adapters && bun run workspace:check-quality && bun run workspace:check-coverage-policy && bun run release:governance:check && bun run governance:check-authorship && bun run requirements:check && bun run packages:check-suites && bun run test-map:check && bun run ci:check-provider && bun run ci:check-third-party-review && bun run integrations:check && bun run integration-migration:check && bun run agent-registry:check && bun run test:unit && bun run ci:security-smoke && bun run oas:check-routes && bun run serverless:check-handlers && bun run build:dev && bun run ci:smoke` |
| `ci:gate:branch` | Use em validações de CI e gates de entrega. | `bun run ci:gate:branch` | `bun ci-cd/run-branch-quality-gate.js` |
| `ci:gate:task` | Use em validações de CI e gates de entrega. | `bun run ci:gate:task` | `bun ci-cd/run-task-change-tests.js` |
| `ci:gate:strict` | Use em validações de CI e gates de entrega. | `bun run ci:gate:strict` | `bun ci-cd/run-full-test-matrix.js` |
| `dev` | Entrypoint local padrão; inicia perfil PM2 de desenvolvimento. | `bun run dev` | `bun run pm2:start:dev:restapi` |
| `website:dev` | Opera o ciclo de vida do site comercial. | `bun run website:dev` | `bun run --filter @jumentix/website dev` |
| `website:build` | Opera o ciclo de vida do site comercial. | `bun run website:build` | `bun run --filter @jumentix/website build` |
| `website:start` | Opera o ciclo de vida do site comercial. | `bun run website:start` | `bun run --filter @jumentix/website start` |
| `website:storybook` | Opera o ciclo de vida do site comercial. | `bun run website:storybook` | `bun run --filter @jumentix/website storybook` |
| `website:storybook:build` | Opera o ciclo de vida do site comercial. | `bun run website:storybook:build` | `bun run --filter @jumentix/website storybook:build` |
| `website:storybook:smoke` | Opera o ciclo de vida do site comercial. | `bun run website:storybook:smoke` | `bun run --filter @jumentix/website storybook:smoke` |
| `website:test:prepublish` | Opera o ciclo de vida do site comercial. | `bun run website:test:prepublish` | `bun run --filter @jumentix/website test:prepublish` |
| `website:test:cypress` | Opera o ciclo de vida do site comercial. | `bun run website:test:cypress` | `bun run --filter @jumentix/website test:cypress` |
| `website:test:quality` | Opera o ciclo de vida do site comercial. | `bun run website:test:quality` | `bun run --filter @jumentix/website test:quality` |
| `website:vercel:link` | Opera o ciclo de vida do site comercial. | `bun run website:vercel:link` | `bun x vercel link --cwd apps/jumentix-website --project jumentix-website --yes` |
| `website:vercel:pull:preview` | Opera o ciclo de vida do site comercial. | `bun run website:vercel:pull:preview` | `bun x vercel pull --cwd apps/jumentix-website --environment=preview --yes` |
| `website:vercel:pull:prod` | Opera o ciclo de vida do site comercial. | `bun run website:vercel:pull:prod` | `bun x vercel pull --cwd apps/jumentix-website --environment=production --yes` |
| `website:deploy:vercel` | Opera o ciclo de vida do site comercial. | `bun run website:deploy:vercel` | `bun x vercel --cwd apps/jumentix-website --prod` |
| `website:publish` | Opera o ciclo de vida do site comercial. | `bun run website:publish` | `bun run website:test:prepublish && bun run website:deploy:vercel` |
| `website:deploy:vercel:preview` | Opera o ciclo de vida do site comercial. | `bun run website:deploy:vercel:preview` | `bun x vercel --cwd apps/jumentix-website` |
| `npm:whoami` | Executa comandos auxiliares de organização e publicação npm. | `bun run npm:whoami` | `bun pm whoami` |
| `npm:org:check:xpertminds` | Executa comandos auxiliares de organização e publicação npm. | `bun run npm:org:check:xpertminds` | `bun ci-cd/check-npm-org-integration.js` |
| `npm:publish:dry-run:packages` | Executa comandos auxiliares de organização e publicação npm. | `bun run npm:publish:dry-run:packages` | `bun ci-cd/npm-publish-dry-run.js` |
| `pm2:list` | Gerencia processos de runtime com PM2. | `bun run pm2:list` | `pm2 ls` |
| `pm2:logs` | Gerencia processos de runtime com PM2. | `bun run pm2:logs` | `pm2 logs` |
| `pm2:stop:all` | Gerencia processos de runtime com PM2. | `bun run pm2:stop:all` | `pm2 stop all` |
| `pm2:delete:all` | Gerencia processos de runtime com PM2. | `bun run pm2:delete:all` | `pm2 delete all` |
| `pm2:start:dev:restapi` | Gerencia processos de runtime com PM2. | `bun run pm2:start:dev:restapi` | `pm2 start ./pm2/ecosystem.dev.cjs --only jumentix-dev-service-management,jumentix-dev-restapi --update-env` |
| `pm2:start:dev:websocket-rest` | Gerencia processos de runtime com PM2. | `bun run pm2:start:dev:websocket-rest` | `pm2 start ./pm2/ecosystem.dev.cjs --only jumentix-dev-service-management,jumentix-dev-restapi,jumentix-dev-websocketapi --update-env` |
| `pm2:start:dev:grpc-rest` | Gerencia processos de runtime com PM2. | `bun run pm2:start:dev:grpc-rest` | `pm2 start ./pm2/ecosystem.dev.cjs --only jumentix-dev-service-management,jumentix-dev-restapi,jumentix-dev-grpcapi --update-env` |
| `pm2:start:staging:restapi` | Gerencia processos de runtime com PM2. | `bun run pm2:start:staging:restapi` | `pm2 start ./pm2/ecosystem.staging.cjs --only jumentix-staging-service-management,jumentix-staging-restapi --update-env` |
| `pm2:start:staging:websocket-rest` | Gerencia processos de runtime com PM2. | `bun run pm2:start:staging:websocket-rest` | `pm2 start ./pm2/ecosystem.staging.cjs --only jumentix-staging-service-management,jumentix-staging-restapi,jumentix-staging-websocketapi --update-env` |
| `pm2:start:staging:grpc-rest` | Gerencia processos de runtime com PM2. | `bun run pm2:start:staging:grpc-rest` | `pm2 start ./pm2/ecosystem.staging.cjs --only jumentix-staging-service-management,jumentix-staging-restapi,jumentix-staging-grpcapi --update-env` |
| `pm2:start:prod:restapi` | Gerencia processos de runtime com PM2. | `bun run pm2:start:prod:restapi` | `pm2 start ./pm2/ecosystem.production.cjs --only jumentix-prod-service-management,jumentix-prod-restapi --update-env` |
| `pm2:start:prod:websocket-rest` | Gerencia processos de runtime com PM2. | `bun run pm2:start:prod:websocket-rest` | `pm2 start ./pm2/ecosystem.production.cjs --only jumentix-prod-service-management,jumentix-prod-restapi,jumentix-prod-websocketapi --update-env` |
| `pm2:start:prod:grpc-rest` | Gerencia processos de runtime com PM2. | `bun run pm2:start:prod:grpc-rest` | `pm2 start ./pm2/ecosystem.production.cjs --only jumentix-prod-service-management,jumentix-prod-restapi,jumentix-prod-grpcapi --update-env` |
| `commit` | Use quando precisar desta operação específica do workspace. | `bun run commit` | `bun run lint && bun run test && bun ci-cd/bumpPackage.ts && git add . && git-cz` |
| `lint` | Roda checks de lint antes de commit/PR. | `bun run lint` | `eslint . --ext .ts` |
| `lint:fix` | Use quando precisar desta operação específica do workspace. | `bun run lint:fix` | `eslint . --ext .ts --fix` |
| `build:dev` | Use quando precisar desta operação específica do workspace. | `bun run build:dev` | `NODE_ENV=dev tsc -p tsconfig.build.json` |
| `build:prod` | Use quando precisar desta operação específica do workspace. | `bun run build:prod` | `NODE_ENV=prod tsc -p tsconfig.build.json` |
| `tdd` | Use quando precisar desta operação específica do workspace. | `bun run tdd` | `NODE_ENV=dev bun ci-cd/run-tdd.js` |
| `npm` | Use quando precisar desta operação específica do workspace. | `bun run npm` | `NODE_ENV=dev bun test ./apps/backend-template/test` |
| `test` | Executa a suíte padrão de testes do backend-template. | `bun run test` | `NODE_ENV=dev bun test ./apps/backend-template/test` |
| `test:unit` | Roda testes para escopo ou perfil específico. | `bun run test:unit` | `NODE_ENV=dev bun ci-cd/run-unit-tests.js` |
| `coverage:patch` | Use quando precisar desta operação específica do workspace. | `bun run coverage:patch` | `bun ci-cd/check-patch-coverage.js` |
| `coverage:browser-lcov` | Use quando precisar desta operação específica do workspace. | `bun run coverage:browser-lcov` | `bun ci-cd/write-browser-lcov.js` |
| `test:integration` | Roda testes para escopo ou perfil específico. | `bun run test:integration` | `bun ci-cd/run-integration-tests.js` |
| `test:integration:express` | Roda testes para escopo ou perfil específico. | `bun run test:integration:express` | `NODE_ENV=dev bun ci-cd/run-suite.js --script-label express apps/backend-template/test/integration/Express` |
| `test:integration:fastify` | Roda testes para escopo ou perfil específico. | `bun run test:integration:fastify` | `NODE_ENV=dev bun ci-cd/run-suite.js --script-label fastify apps/backend-template/test/integration/Fastify` |
| `test:integration:restify` | Roda testes para escopo ou perfil específico. | `bun run test:integration:restify` | `NODE_ENV=dev bun ci-cd/run-suite.js --script-label restify --timeout 15000 apps/backend-template/test/integration/Restify` |
| `test:integration:lambda` | Roda testes para escopo ou perfil específico. | `bun run test:integration:lambda` | `JUMENTIX_MESSAGE_MEDIATOR_ADAPTER=inmemory NODE_ENV=dev bun ci-cd/run-suite.js --script-label lambda apps/backend-template/test/integration/Lambda` |
| `test:integration:cloudflare-workers` | Roda testes para escopo ou perfil específico. | `bun run test:integration:cloudflare-workers` | `NODE_ENV=dev bun ci-cd/run-suite.js --script-label cloudflare-workers apps/backend-template/test/integration/Cloudflare-Workers` |
| `test:integration:vercel-functions` | Roda testes para escopo ou perfil específico. | `bun run test:integration:vercel-functions` | `NODE_ENV=dev bun ci-cd/run-suite.js --script-label vercel-functions apps/backend-template/test/integration/Vercel-Functions` |
| `test:integration:loopback` | Roda testes para escopo ou perfil específico. | `bun run test:integration:loopback` | `NODE_ENV=dev bun ci-cd/run-suite.js --script-label loopback apps/backend-template/test/integration/LoopBack` |
| `test:integration:sails-js` | Roda testes para escopo ou perfil específico. | `bun run test:integration:sails-js` | `NODE_ENV=dev bun ci-cd/run-suite.js --script-label sails-js apps/backend-template/test/integration/Sails-JS` |
| `test:integration:feathers` | Roda testes para escopo ou perfil específico. | `bun run test:integration:feathers` | `NODE_ENV=dev bun ci-cd/run-suite.js --script-label feathers apps/backend-template/test/integration/Feathers` |
| `test:integration:derby-js` | Roda testes para escopo ou perfil específico. | `bun run test:integration:derby-js` | `NODE_ENV=dev bun ci-cd/run-suite.js --script-label derby-js apps/backend-template/test/integration/Derby-JS` |
| `test:integration:adonis-js` | Roda testes para escopo ou perfil específico. | `bun run test:integration:adonis-js` | `NODE_ENV=dev bun ci-cd/run-suite.js --script-label adonis-js apps/backend-template/test/integration/Adonis-JS` |
| `test:integration:total-js` | Roda testes para escopo ou perfil específico. | `bun run test:integration:total-js` | `NODE_ENV=dev bun ci-cd/run-suite.js --script-label total-js apps/backend-template/test/integration/Total-JS` |
| `test:integration:service-management` | Roda testes para escopo ou perfil específico. | `bun run test:integration:service-management` | `NODE_ENV=dev bun ci-cd/run-service-management-integration.js` |
| `test:integration:realtime:websocket` | Roda testes para escopo ou perfil específico. | `bun run test:integration:realtime:websocket` | `NODE_ENV=dev bun ci-cd/run-suite.js --script-label realtime-ws apps/backend-template/test/integration/realtime/websocket.basic.integration.test.ts` |
| `test:integration:realtime:grpc` | Roda testes para escopo ou perfil específico. | `bun run test:integration:realtime:grpc` | `NODE_ENV=dev bun ci-cd/run-suite.js --script-label realtime-grpc apps/backend-template/test/integration/realtime/grpc.basic.integration.test.ts` |
| `test:integration:realtime` | Roda testes para escopo ou perfil específico. | `bun run test:integration:realtime` | `bun run test:integration:realtime:websocket && bun run test:integration:realtime:grpc` |
| `test:integration:realtime:redis-streams` | Roda testes para escopo ou perfil específico. | `bun run test:integration:realtime:redis-streams` | `RUN_REDIS_INTEGRATION=1 NODE_ENV=dev bun ci-cd/run-suite.js --script-label redis-streams apps/backend-template/test/integration/realtime/socketio.redis-streams.multi-instance.test.ts` |
| `test:integration:db` | Roda testes para escopo ou perfil específico. | `bun run test:integration:db` | `bun run test:smoke:db:all` |
| `test:integration:db:inmemory` | Roda testes para escopo ou perfil específico. | `bun run test:integration:db:inmemory` | `bun run test:smoke:db:inmemory` |
| `test:integration:db:sqlite` | Roda testes para escopo ou perfil específico. | `bun run test:integration:db:sqlite` | `bun run test:smoke:db:sqlite` |
| `test:integration:db:postgresql` | Roda testes para escopo ou perfil específico. | `bun run test:integration:db:postgresql` | `bun run smoke:db:postgresql` |
| `test:integration:db:mysql` | Roda testes para escopo ou perfil específico. | `bun run test:integration:db:mysql` | `bun run smoke:db:mysql` |
| `test:integration:db:mssql` | Roda testes para escopo ou perfil específico. | `bun run test:integration:db:mssql` | `bun run smoke:db:mssql` |
| `test:integration:db:oracle` | Roda testes para escopo ou perfil específico. | `bun run test:integration:db:oracle` | `bun run smoke:db:oracle` |
| `test:integration:db:mongo` | Roda testes para escopo ou perfil específico. | `bun run test:integration:db:mongo` | `bun run smoke:db:mongodb` |
| `test:integration:db:cassandra` | Roda testes para escopo ou perfil específico. | `bun run test:integration:db:cassandra` | `bun run smoke:db:cassandra` |
| `test:integration:db:dynamodb` | Roda testes para escopo ou perfil específico. | `bun run test:integration:db:dynamodb` | `bun run smoke:db:dynamodb` |
| `test:integration:db:firebase` | Roda testes para escopo ou perfil específico. | `bun run test:integration:db:firebase` | `bun run smoke:db:firebase` |
| `test:integration:db:aurora` | Roda testes para escopo ou perfil específico. | `bun run test:integration:db:aurora` | `bun run smoke:db:aurora` |
| `test:integration:db:rds` | Roda testes para escopo ou perfil específico. | `bun run test:integration:db:rds` | `bun run smoke:db:rds` |
| `test:smoke` | Roda testes para escopo ou perfil específico. | `bun run test:smoke` | `bun run ci:smoke` |
| `test:smoke:security` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:security` | `bun run ci:security-smoke` |
| `test:smoke:api` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:api` | `bun run ci:smoke` |
| `test:smoke:db` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:db` | `RUN_DB_SMOKE=1 NODE_ENV=dev bun ci-cd/run-suite.js --script-label smoke-db apps/backend-template/test/smoke/database/DatabaseDrivers.smoke.test.ts` |
| `test:smoke:realtime` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:realtime` | `NODE_ENV=dev bun ci-cd/run-suite.js --script-label smoke-realtime apps/backend-template/test/smoke/realtime/RealtimeApis.smoke.test.ts` |
| `test:smoke:db:inmemory` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:db:inmemory` | `JUMENTIX_DB_SMOKE_DRIVERS=InMemory bun run test:smoke:db` |
| `test:smoke:db:postgresql` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:db:postgresql` | `JUMENTIX_DB_SMOKE_DRIVERS=PostgreSQL bun run test:smoke:db` |
| `test:smoke:db:mysql` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:db:mysql` | `JUMENTIX_DB_SMOKE_DRIVERS=MySQL bun run test:smoke:db` |
| `test:smoke:db:mssql` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:db:mssql` | `JUMENTIX_DB_SMOKE_DRIVERS=MSSQL bun run test:smoke:db` |
| `test:smoke:db:oracle` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:db:oracle` | `JUMENTIX_DB_SMOKE_DRIVERS=Oracle bun run test:smoke:db` |
| `test:smoke:db:sqlite` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:db:sqlite` | `JUMENTIX_DB_SMOKE_DRIVERS=SQLite bun run test:smoke:db` |
| `test:smoke:db:mongo` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:db:mongo` | `JUMENTIX_DATABASE_CONNECTION_URL=mongodb://127.0.0.1:27027/jumentix JUMENTIX_DB_SMOKE_DRIVERS=Mongo bun run test:smoke:db` |
| `test:smoke:db:cassandra` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:db:cassandra` | `JUMENTIX_DB_SMOKE_DRIVERS=Cassandra bun run test:smoke:db` |
| `test:smoke:db:dynamodb` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:db:dynamodb` | `JUMENTIX_DB_SMOKE_DRIVERS=DynamoDB bun run test:smoke:db` |
| `test:smoke:db:firebase` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:db:firebase` | `JUMENTIX_DB_SMOKE_DRIVERS=Firebase bun run test:smoke:db` |
| `test:smoke:db:aurora` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:db:aurora` | `JUMENTIX_DB_SMOKE_DRIVERS=Aurora bun run test:smoke:db` |
| `test:smoke:db:rds` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:db:rds` | `JUMENTIX_DB_SMOKE_DRIVERS=RDS bun run test:smoke:db` |
| `test:smoke:db:all` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:db:all` | `bun run smoke:db:inmemory && bun run smoke:db:sqlite && bun run smoke:db:postgresql && bun run smoke:db:mongodb && bun run smoke:db:mysql && bun run smoke:db:mssql && bun run smoke:db:dynamodb && bun run smoke:db:cassandra && bun run smoke:db:oracle && bun run smoke:db:firebase && bun run smoke:db:aurora && bun run smoke:db:rds` |
| `test:smoke:all` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:all` | `bun run test:smoke:security && bun run test:smoke:api && bun run test:smoke:realtime && bun run test:smoke:db:all` |
| `smoke:db:postgresql` | Executa smoke checks para validação rápida de ambiente. | `bun run smoke:db:postgresql` | `bun run docker:up:postgresql && bun run test:smoke:db:postgresql && bun run docker:down:postgresql` |
| `smoke:db:mysql` | Executa smoke checks para validação rápida de ambiente. | `bun run smoke:db:mysql` | `bun run docker:up:mysql && bun run test:smoke:db:mysql && bun run docker:down:mysql` |
| `smoke:db:mssql` | Executa smoke checks para validação rápida de ambiente. | `bun run smoke:db:mssql` | `bun run docker:up:mssql && bun run test:smoke:db:mssql && bun run docker:down:mssql` |
| `smoke:db:oracle` | Executa smoke checks para validação rápida de ambiente. | `bun run smoke:db:oracle` | `bun run docker:up:oracle && bun run test:smoke:db:oracle && bun run docker:down:oracle` |
| `smoke:db:mongodb` | Executa smoke checks para validação rápida de ambiente. | `bun run smoke:db:mongodb` | `bun run docker:up:mongodb && bun run test:smoke:db:mongo && bun run docker:down:mongodb` |
| `smoke:db:cassandra` | Executa smoke checks para validação rápida de ambiente. | `bun run smoke:db:cassandra` | `bun run docker:up:cassandra && bun run test:smoke:db:cassandra && bun run docker:down:cassandra` |
| `smoke:db:dynamodb` | Executa smoke checks para validação rápida de ambiente. | `bun run smoke:db:dynamodb` | `bun run docker:up:dynamodb && bun run test:smoke:db:dynamodb && bun run docker:down:dynamodb` |
| `smoke:db:firebase` | Executa smoke checks para validação rápida de ambiente. | `bun run smoke:db:firebase` | `bun run docker:up:firebase && bun run test:smoke:db:firebase && bun run docker:down:firebase` |
| `smoke:db:aurora` | Executa smoke checks para validação rápida de ambiente. | `bun run smoke:db:aurora` | `bun run docker:up:aurora && bun run test:smoke:db:aurora && bun run docker:down:aurora` |
| `smoke:db:rds` | Executa smoke checks para validação rápida de ambiente. | `bun run smoke:db:rds` | `bun run docker:up:rds && bun run test:smoke:db:rds && bun run docker:down:rds` |
| `smoke:db:sqlite` | Executa smoke checks para validação rápida de ambiente. | `bun run smoke:db:sqlite` | `bun run test:smoke:db:sqlite` |
| `smoke:db:inmemory` | Executa smoke checks para validação rápida de ambiente. | `bun run smoke:db:inmemory` | `bun run test:smoke:db:inmemory` |
| `dev:http` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:http` | `pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name jumentix-dev-http --interpreter bun --interpreter-args='-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:express` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:express` | `JUMENTIX_HTTP_FRAMEWORK=express pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name jumentix-dev-express --interpreter bun --interpreter-args='-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:fastify` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:fastify` | `JUMENTIX_HTTP_FRAMEWORK=fastify pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name jumentix-dev-fastify --interpreter bun --interpreter-args='-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:restify` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:restify` | `JUMENTIX_HTTP_FRAMEWORK=restify pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name jumentix-dev-restify --interpreter bun --interpreter-args='-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:cloudflare-workers` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:cloudflare-workers` | `JUMENTIX_HTTP_FRAMEWORK=cloudflare-workers pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name jumentix-dev-cloudflare-workers --interpreter bun --interpreter-args='-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:vercel-functions` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:vercel-functions` | `JUMENTIX_HTTP_FRAMEWORK=vercel-functions pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name jumentix-dev-vercel-functions --interpreter bun --interpreter-args='-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:loopback` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:loopback` | `JUMENTIX_HTTP_FRAMEWORK=loopback pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name jumentix-dev-loopback --interpreter bun --interpreter-args='-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:sails-js` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:sails-js` | `JUMENTIX_HTTP_FRAMEWORK=sails-js pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name jumentix-dev-sails-js --interpreter bun --interpreter-args='-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:feathers` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:feathers` | `JUMENTIX_HTTP_FRAMEWORK=feathers pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name jumentix-dev-feathers --interpreter bun --interpreter-args='-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:derby-js` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:derby-js` | `JUMENTIX_HTTP_FRAMEWORK=derby-js pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name jumentix-dev-derby-js --interpreter bun --interpreter-args='-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:adonis-js` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:adonis-js` | `JUMENTIX_HTTP_FRAMEWORK=adonis-js pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name jumentix-dev-adonis-js --interpreter bun --interpreter-args='-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:total-js` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:total-js` | `JUMENTIX_HTTP_FRAMEWORK=total-js pm2 start ./apps/backend-template/src/interface/HTTP/adapters/start-rest-api.ts --name jumentix-dev-total-js --interpreter bun --interpreter-args='-r tsconfig-paths/register --env-file=./apps/backend-template/src/config/.env.dev' --update-env` |
| `dev:websocket` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:websocket` | `bun run pm2:start:dev:websocket-rest` |
| `dev:grpc` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:grpc` | `bun run pm2:start:dev:grpc-rest` |
| `dev:serverless` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:serverless` | `bun run lint && NODE_ENV=dev serverless dev` |
| `cli` | Use quando precisar desta operação específica do workspace. | `bun run cli` | `bun run dev:cli` |
| `cli:bootstrap` | Use quando precisar desta operação específica do workspace. | `bun run cli:bootstrap` | `node ./bin/jumentix-bootstrap.js` |
| `dev:cli` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:cli` | `bun -r tsconfig-paths/register ./apps/backend-template/src/interface/CLI/index.ts` |
| `dev:service-management` | Inicia o modo de runtime para desenvolvimento. | `bun run dev:service-management` | `pm2 start ./apps/service-management/server.js --name jumentix-dev-service-management --interpreter bun --update-env` |
| `start:cli` | Use quando precisar desta operação específica do workspace. | `bun run start:cli` | `bun run dev:cli` |
| `prod:http` | Inicia o perfil de runtime de produção. | `bun run prod:http` | `pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name jumentix-prod-http --interpreter bun --interpreter-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:express` | Inicia o perfil de runtime de produção. | `bun run prod:express` | `JUMENTIX_HTTP_FRAMEWORK=express pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name jumentix-prod-express --interpreter bun --interpreter-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:fastify` | Inicia o perfil de runtime de produção. | `bun run prod:fastify` | `JUMENTIX_HTTP_FRAMEWORK=fastify pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name jumentix-prod-fastify --interpreter bun --interpreter-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:restify` | Inicia o perfil de runtime de produção. | `bun run prod:restify` | `JUMENTIX_HTTP_FRAMEWORK=restify pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name jumentix-prod-restify --interpreter bun --interpreter-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:cloudflare-workers` | Inicia o perfil de runtime de produção. | `bun run prod:cloudflare-workers` | `JUMENTIX_HTTP_FRAMEWORK=cloudflare-workers pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name jumentix-prod-cloudflare-workers --interpreter bun --interpreter-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:vercel-functions` | Inicia o perfil de runtime de produção. | `bun run prod:vercel-functions` | `JUMENTIX_HTTP_FRAMEWORK=vercel-functions pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name jumentix-prod-vercel-functions --interpreter bun --interpreter-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:loopback` | Inicia o perfil de runtime de produção. | `bun run prod:loopback` | `JUMENTIX_HTTP_FRAMEWORK=loopback pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name jumentix-prod-loopback --interpreter bun --interpreter-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:sails-js` | Inicia o perfil de runtime de produção. | `bun run prod:sails-js` | `JUMENTIX_HTTP_FRAMEWORK=sails-js pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name jumentix-prod-sails-js --interpreter bun --interpreter-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:feathers` | Inicia o perfil de runtime de produção. | `bun run prod:feathers` | `JUMENTIX_HTTP_FRAMEWORK=feathers pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name jumentix-prod-feathers --interpreter bun --interpreter-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:derby-js` | Inicia o perfil de runtime de produção. | `bun run prod:derby-js` | `JUMENTIX_HTTP_FRAMEWORK=derby-js pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name jumentix-prod-derby-js --interpreter bun --interpreter-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:adonis-js` | Inicia o perfil de runtime de produção. | `bun run prod:adonis-js` | `JUMENTIX_HTTP_FRAMEWORK=adonis-js pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name jumentix-prod-adonis-js --interpreter bun --interpreter-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:total-js` | Inicia o perfil de runtime de produção. | `bun run prod:total-js` | `JUMENTIX_HTTP_FRAMEWORK=total-js pm2 start ./.build/apps/backend-template/src/interface/HTTP/adapters/start-rest-api.js --name jumentix-prod-total-js --interpreter bun --interpreter-args='--env-file=./.build/apps/backend-template/src/config/.env.prod' --update-env` |
| `prod:websocket` | Inicia o perfil de runtime de produção. | `bun run prod:websocket` | `bun run pm2:start:prod:websocket-rest` |
| `prod:grpc` | Inicia o perfil de runtime de produção. | `bun run prod:grpc` | `bun run pm2:start:prod:grpc-rest` |
| `staging:restapi` | Inicia o perfil de runtime de staging. | `bun run staging:restapi` | `bun run pm2:start:staging:restapi` |
| `staging:websocket` | Inicia o perfil de runtime de staging. | `bun run staging:websocket` | `bun run pm2:start:staging:websocket-rest` |
| `staging:grpc` | Inicia o perfil de runtime de staging. | `bun run staging:grpc` | `bun run pm2:start:staging:grpc-rest` |
| `prod:serverless` | Inicia o perfil de runtime de produção. | `bun run prod:serverless` | `bun run lint && NODE_ENV=prod serverless dev` |
| `docker:composeredis` | Sobe/derruba dependências e serviços em containers. | `bun run docker:composeredis` | `docker compose -f "apps/backend-template/docker-compose-redis.yml" up -d --build` |
| `docker:composemessaging` | Sobe/derruba dependências e serviços em containers. | `bun run docker:composemessaging` | `docker compose -f "apps/backend-template/docker-compose-messaging.yml" up -d --build` |
| `docker:compose:platform-services` | Sobe/derruba dependências e serviços em containers. | `bun run docker:compose:platform-services` | `docker compose -f "apps/backend-template/docker-compose-platform-services.yml" up -d --build` |
| `docker:up:postgresql` | Sobe/derruba dependências e serviços em containers. | `bun run docker:up:postgresql` | `docker compose -f "apps/backend-template/docker-compose-postgresql.yml" up -d --build` |
| `docker:up:mysql` | Sobe/derruba dependências e serviços em containers. | `bun run docker:up:mysql` | `docker compose -f "apps/backend-template/docker-compose-mysql.yml" up -d --build` |
| `docker:up:mssql` | Sobe/derruba dependências e serviços em containers. | `bun run docker:up:mssql` | `docker compose -f "apps/backend-template/docker-compose-mssql.yml" up -d --build` |
| `docker:up:oracle` | Sobe/derruba dependências e serviços em containers. | `bun run docker:up:oracle` | `docker compose -f "apps/backend-template/docker-compose-oracle.yml" up -d --build` |
| `docker:up:mongodb` | Sobe/derruba dependências e serviços em containers. | `bun run docker:up:mongodb` | `docker compose -f "apps/backend-template/docker-compose-mongodb.yml" up -d --build` |
| `docker:up:cassandra` | Sobe/derruba dependências e serviços em containers. | `bun run docker:up:cassandra` | `docker compose -f "apps/backend-template/docker-compose-cassandra.yml" up -d --build` |
| `docker:up:dynamodb` | Sobe/derruba dependências e serviços em containers. | `bun run docker:up:dynamodb` | `docker compose -f "apps/backend-template/docker-compose-dynamodb.yml" up -d --build` |
| `docker:up:firebase` | Sobe/derruba dependências e serviços em containers. | `bun run docker:up:firebase` | `docker compose -f "apps/backend-template/docker-compose-firebase.yml" up -d --build` |
| `docker:up:aurora` | Sobe/derruba dependências e serviços em containers. | `bun run docker:up:aurora` | `docker compose -f "apps/backend-template/docker-compose-aurora.yml" up -d --build` |
| `docker:up:rds` | Sobe/derruba dependências e serviços em containers. | `bun run docker:up:rds` | `docker compose -f "apps/backend-template/docker-compose-rds.yml" up -d --build` |
| `docker:down:postgresql` | Sobe/derruba dependências e serviços em containers. | `bun run docker:down:postgresql` | `docker compose -f "apps/backend-template/docker-compose-postgresql.yml" down` |
| `docker:down:mysql` | Sobe/derruba dependências e serviços em containers. | `bun run docker:down:mysql` | `docker compose -f "apps/backend-template/docker-compose-mysql.yml" down` |
| `docker:down:mssql` | Sobe/derruba dependências e serviços em containers. | `bun run docker:down:mssql` | `docker compose -f "apps/backend-template/docker-compose-mssql.yml" down` |
| `docker:down:oracle` | Sobe/derruba dependências e serviços em containers. | `bun run docker:down:oracle` | `docker compose -f "apps/backend-template/docker-compose-oracle.yml" down` |
| `docker:down:mongodb` | Sobe/derruba dependências e serviços em containers. | `bun run docker:down:mongodb` | `docker compose -f "apps/backend-template/docker-compose-mongodb.yml" down` |
| `docker:down:cassandra` | Sobe/derruba dependências e serviços em containers. | `bun run docker:down:cassandra` | `docker compose -f "apps/backend-template/docker-compose-cassandra.yml" down` |
| `docker:down:dynamodb` | Sobe/derruba dependências e serviços em containers. | `bun run docker:down:dynamodb` | `docker compose -f "apps/backend-template/docker-compose-dynamodb.yml" down` |
| `docker:down:firebase` | Sobe/derruba dependências e serviços em containers. | `bun run docker:down:firebase` | `docker compose -f "apps/backend-template/docker-compose-firebase.yml" down` |
| `docker:down:aurora` | Sobe/derruba dependências e serviços em containers. | `bun run docker:down:aurora` | `docker compose -f "apps/backend-template/docker-compose-aurora.yml" down` |
| `docker:down:rds` | Sobe/derruba dependências e serviços em containers. | `bun run docker:down:rds` | `docker compose -f "apps/backend-template/docker-compose-rds.yml" down` |
| `docker:compose:service-template` | Sobe/derruba dependências e serviços em containers. | `bun run docker:compose:service-template` | `docker compose -f "apps/backend-template/docker-compose-service-templates.yml" --profile ${JUMENTIX_SERVICE_PROFILE:-rest} up -d --build` |
| `docker:composerabbit` | Sobe/derruba dependências e serviços em containers. | `bun run docker:composerabbit` | `docker compose -f "apps/backend-template/docker-compose-messaging.yml" up -d rabbitmq` |
| `docker:stop` | Sobe/derruba dependências e serviços em containers. | `bun run docker:stop` | `docker-compose stop` |
| `docker:restart` | Sobe/derruba dependências e serviços em containers. | `bun run docker:restart` | `docker compose -f "apps/backend-template/docker-compose-redis.yml" down && bun run docker:composeredis` |
| `docker:restart:messaging` | Sobe/derruba dependências e serviços em containers. | `bun run docker:restart:messaging` | `docker compose -f "apps/backend-template/docker-compose-messaging.yml" down && bun run docker:composemessaging` |
| `smoke:realtime:redis-streams` | Executa smoke checks para validação rápida de ambiente. | `bun run smoke:realtime:redis-streams` | `bun run docker:composeredis && bun run test:integration:realtime:redis-streams && docker compose -f "apps/backend-template/docker-compose-redis.yml" down` |
| `docker:stop:platform-services` | Sobe/derruba dependências e serviços em containers. | `bun run docker:stop:platform-services` | `docker compose -f "apps/backend-template/docker-compose-platform-services.yml" down` |
| `docker:stop:service-template` | Sobe/derruba dependências e serviços em containers. | `bun run docker:stop:service-template` | `docker compose -f "apps/backend-template/docker-compose-service-templates.yml" down` |
| `docker:clean` | Sobe/derruba dependências e serviços em containers. | `bun run docker:clean` | `docker system prune -a` |
| `ci:fail-closed` | Use em validações de CI e gates de entrega. | `bun run ci:fail-closed` | `bun ci-cd/check-fail-closed.js` |
| `integrations:check` | Use quando precisar desta operação específica do workspace. | `bun run integrations:check` | `bun ci-cd/check-canonical-integrations.js` |
| `deps:audit` | Use quando precisar desta operação específica do workspace. | `bun run deps:audit` | `bun packages/security-scanner/audit.js` |
| `test:integration:express:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:express:ci` | `JUMENTIX_TEST_RUNTIME=node NODE_ENV=dev bun ci-cd/run-suite.js --script-label express apps/backend-template/test/integration/Express` |
| `test:integration:fastify:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:fastify:ci` | `JUMENTIX_TEST_RUNTIME=node NODE_ENV=dev bun ci-cd/run-suite.js --script-label fastify apps/backend-template/test/integration/Fastify` |
| `test:integration:restify:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:restify:ci` | `JUMENTIX_TEST_RUNTIME=node NODE_ENV=dev bun ci-cd/run-suite.js --script-label restify --timeout 15000 apps/backend-template/test/integration/Restify` |
| `test:integration:lambda:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:lambda:ci` | `JUMENTIX_TEST_RUNTIME=node JUMENTIX_MESSAGE_MEDIATOR_ADAPTER=inmemory NODE_ENV=dev bun ci-cd/run-suite.js --script-label lambda apps/backend-template/test/integration/Lambda` |
| `test:integration:cloudflare-workers:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:cloudflare-workers:ci` | `JUMENTIX_TEST_RUNTIME=node NODE_ENV=dev bun ci-cd/run-suite.js --script-label cloudflare-workers apps/backend-template/test/integration/Cloudflare-Workers` |
| `test:integration:vercel-functions:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:vercel-functions:ci` | `JUMENTIX_TEST_RUNTIME=node NODE_ENV=dev bun ci-cd/run-suite.js --script-label vercel-functions apps/backend-template/test/integration/Vercel-Functions` |
| `test:integration:loopback:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:loopback:ci` | `JUMENTIX_TEST_RUNTIME=node NODE_ENV=dev bun ci-cd/run-suite.js --script-label loopback apps/backend-template/test/integration/LoopBack` |
| `test:integration:sails-js:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:sails-js:ci` | `JUMENTIX_TEST_RUNTIME=node NODE_ENV=dev bun ci-cd/run-suite.js --script-label sails-js apps/backend-template/test/integration/Sails-JS` |
| `test:integration:feathers:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:feathers:ci` | `JUMENTIX_TEST_RUNTIME=node NODE_ENV=dev bun ci-cd/run-suite.js --script-label feathers apps/backend-template/test/integration/Feathers` |
| `test:integration:derby-js:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:derby-js:ci` | `JUMENTIX_TEST_RUNTIME=node NODE_ENV=dev bun ci-cd/run-suite.js --script-label derby-js apps/backend-template/test/integration/Derby-JS` |
| `test:integration:adonis-js:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:adonis-js:ci` | `JUMENTIX_TEST_RUNTIME=node NODE_ENV=dev bun ci-cd/run-suite.js --script-label adonis-js apps/backend-template/test/integration/Adonis-JS` |
| `test:integration:total-js:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:total-js:ci` | `JUMENTIX_TEST_RUNTIME=node NODE_ENV=dev bun ci-cd/run-suite.js --script-label total-js apps/backend-template/test/integration/Total-JS` |
| `test:integration:mutex` | Roda testes para escopo ou perfil específico. | `bun run test:integration:mutex` | `NODE_ENV=dev RUN_REDIS_INTEGRATION=1 bun ci-cd/run-suite.js --script-label mutex apps/backend-template/test/integration/mutex` |
| `test:integration:mutex:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:mutex:ci` | `JUMENTIX_TEST_RUNTIME=node NODE_ENV=dev RUN_REDIS_INTEGRATION=1 bun ci-cd/run-suite.js --script-label mutex apps/backend-template/test/integration/mutex` |
| `test:integration:realtime:websocket:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:realtime:websocket:ci` | `JUMENTIX_TEST_RUNTIME=node NODE_ENV=dev bun ci-cd/run-suite.js --script-label realtime-ws apps/backend-template/test/integration/realtime/websocket.basic.integration.test.ts` |
| `test:integration:realtime:grpc:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:realtime:grpc:ci` | `JUMENTIX_TEST_RUNTIME=node NODE_ENV=dev bun ci-cd/run-suite.js --script-label realtime-grpc apps/backend-template/test/integration/realtime/grpc.basic.integration.test.ts` |
| `test:integration:realtime:redis-streams:ci` | Roda testes para escopo ou perfil específico. | `bun run test:integration:realtime:redis-streams:ci` | `JUMENTIX_TEST_RUNTIME=node RUN_REDIS_INTEGRATION=1 NODE_ENV=dev bun ci-cd/run-suite.js --script-label redis-streams apps/backend-template/test/integration/realtime/socketio.redis-streams.multi-instance.test.ts` |
| `test:smoke:db:ci` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:db:ci` | `JUMENTIX_TEST_RUNTIME=node RUN_DB_SMOKE=1 NODE_ENV=dev bun ci-cd/run-suite.js --script-label smoke-db apps/backend-template/test/smoke/database/DatabaseDrivers.smoke.test.ts` |
| `test:smoke:realtime:ci` | Roda testes para escopo ou perfil específico. | `bun run test:smoke:realtime:ci` | `JUMENTIX_TEST_RUNTIME=node NODE_ENV=dev bun ci-cd/run-suite.js --script-label smoke-realtime apps/backend-template/test/smoke/realtime/RealtimeApis.smoke.test.ts` |
| `tdd:domain` | Use quando precisar desta operação específica do workspace. | `bun run tdd:domain` | `NODE_ENV=dev bun ci-cd/run-tdd.js domain` |
| `tdd:application` | Use quando precisar desta operação específica do workspace. | `bun run tdd:application` | `NODE_ENV=dev bun ci-cd/run-tdd.js application` |
| `tdd:adapters` | Use quando precisar desta operação específica do workspace. | `bun run tdd:adapters` | `NODE_ENV=dev bun ci-cd/run-tdd.js adapters/in` |
| `tdd:infra` | Use quando precisar desta operação específica do workspace. | `bun run tdd:infra` | `NODE_ENV=dev bun ci-cd/run-tdd.js adapters/out+infra` |
| `tdd:contracts` | Use quando precisar desta operação específica do workspace. | `bun run tdd:contracts` | `NODE_ENV=dev bun ci-cd/run-tdd.js contracts` |
| `tdd:interface` | Use quando precisar desta operação específica do workspace. | `bun run tdd:interface` | `NODE_ENV=dev bun ci-cd/run-tdd.js interface/runtime` |
| `tdd:tooling` | Use quando precisar desta operação específica do workspace. | `bun run tdd:tooling` | `NODE_ENV=dev bun ci-cd/run-tdd.js tooling` |
| `test:contract` | Roda testes para escopo ou perfil específico. | `bun run test:contract` | `bun ci-cd/run-contract-tests.js` |
| `test:nightly` | Roda testes para escopo ou perfil específico. | `bun run test:nightly` | `bun ci-cd/run-nightly-tier.js` |
| `coverage:merge` | Use quando precisar desta operação específica do workspace. | `bun run coverage:merge` | `bun ci-cd/merge-coverage-reports.js` |
| `workspace:test` | Valida políticas em nível de workspace. | `bun run workspace:test` | `bun ci-cd/run-workspace-tests.js` |
| `quarantine:flake` | Use quando precisar desta operação específica do workspace. | `bun run quarantine:flake` | `bun ci-cd/quarantine-flake.js` |
| `test:coverage` | Roda testes para escopo ou perfil específico. | `bun run test:coverage` | `NODE_ENV=dev bun x jest apps/backend-template/test/unit 'packages/[^/]+/test' --coverage --coverageThreshold='{}' --forceExit` |
| `coverage:check` | Use quando precisar desta operação específica do workspace. | `bun run coverage:check` | `bun ci-cd/check-coverage-thresholds.js` |
| `test:browser` | Roda testes para escopo ou perfil específico. | `bun run test:browser` | `bun ci-cd/run-browser-tests.js` |
| `test:integration:key-value` | Roda testes para escopo ou perfil específico. | `bun run test:integration:key-value` | `bun ci-cd/run-redis-key-value-integration.js` |
| `smoke:key-value:redis` | Executa smoke checks para validação rápida de ambiente. | `bun run smoke:key-value:redis` | `bun run docker:composeredis && bun run test:integration:key-value && docker compose -f "apps/backend-template/docker-compose-redis.yml" down` |
| `test:integration:message-mediator` | Roda testes para escopo ou perfil específico. | `bun run test:integration:message-mediator` | `NODE_ENV=dev RUN_BROKER_INTEGRATION=1 bun ci-cd/run-suite.js --script-label message-mediator --timeout 60000 packages/message-mediator/test/integration` |
| `smoke:message-mediator` | Executa smoke checks para validação rápida de ambiente. | `bun run smoke:message-mediator` | `bun run docker:composemessaging && bun run test:integration:message-mediator && docker compose -f "apps/backend-template/docker-compose-messaging.yml" down` |
