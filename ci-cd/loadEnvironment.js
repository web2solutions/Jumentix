const fs = require('fs');
const path = require('path');
const NODE_ENV = process.env.NODE_ENV || 'dev';

const envFilesByEnv = {
  dev: ['apps/backend-template/src/config/.env.dev', 'apps/backend-template/src/config/.env.dev.example', 'apps/backend-template/src/config/.env.ci'],
  ci: ['apps/backend-template/src/config/.env.ci', 'apps/backend-template/src/config/.env.dev.example'],
  prod: ['apps/backend-template/src/config/.env.prod'],
  staging: ['apps/backend-template/src/config/.env.staging'],
};

const candidateFiles = envFilesByEnv[NODE_ENV] || envFilesByEnv.dev;
const selectedFile = candidateFiles.find((file) => fs.existsSync(path.resolve(file)));

if (selectedFile) {
  const envFile = fs.readFileSync(path.resolve(selectedFile)).toString();
  const envFileLines = envFile.split('\n');

  for (const line of envFileLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const [key, ...valueParts] = trimmedLine.split('=');
    if (!key || valueParts.length === 0) {
      continue;
    }

    const value = valueParts.join('=');
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/*
 * Temporary dual-read: promote legacy AAA_* values to JUMENTIX_* when the new
 * key is unset. Remove once external deployments no longer ship AAA_* files.
 */
for (const [key, value] of Object.entries(process.env)) {
  if (!key.startsWith('AAA_') || value === undefined) continue;
  const nextKey = `JUMENTIX_${key.slice('AAA_'.length)}`;
  const current = process.env[nextKey];
  if (current === undefined || current.trim() === '') {
    process.env[nextKey] = value;
  }
}

/*
 * Message mediator: in-memory unless a suite explicitly asks for a broker.
 *
 * This file is loaded only by test runners — `bunfig.toml` `[test] preload` and
 * Jest `setupFiles` — so the override applies to tests and never to a running
 * application.
 *
 * `.env.dev` declares `JUMENTIX_MESSAGE_MEDIATOR_ADAPTER=rabbitmq`, which is the
 * right default for a developer running the app. It is the wrong default for a
 * test suite: the Lambda integration suites inherited it and failed with
 * `ECONNREFUSED 127.0.0.1:5672` on any machine without a broker, while passing
 * in CI, where `.env.ci` selects `inmemory`. A suite whose outcome depends on
 * what happens to be listening on a developer's laptop is not a test — and the
 * failure names a port rather than the reason.
 *
 * `JUMENTIX_TEST_MESSAGE_BROKER=1` opts back in, matching the existing
 * `RUN_REDIS_INTEGRATION=1` convention for suites that need the real service.
 */
if (!process.env.JUMENTIX_TEST_MESSAGE_BROKER) {
  process.env.JUMENTIX_MESSAGE_MEDIATOR_ADAPTER = 'inmemory';
}

if (NODE_ENV === 'ci' && !process.env.JUMENTIX_JWT_TOKEN_SECRET_KEY) {
  process.env.JUMENTIX_JWT_TOKEN_SECRET_KEY = 'ci_jwt_secret_key';
}

if (!process.env.JUMENTIX_JWT_TOKEN_SECRET_KEY) {
  process.env.JUMENTIX_JWT_TOKEN_SECRET_KEY = 'dev_jwt_secret_key';
}
