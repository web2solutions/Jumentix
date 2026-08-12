/* eslint-disable no-console */
const { spawnSync } = require('child_process');
const { isEntryPoint } = require('./lib/entry-point.js');

const DEFAULT_INTEGRATION_TIMEOUT_MS = 120_000;
const INTEGRATION_TIMEOUT_OVERRIDES_MS = Object.freeze({
  'test:integration:express': 300_000,
  'test:integration:fastify': 300_000,
  'test:integration:restify': 600_000,
  // The service-management matrix boots real WebKit browsers over a real
  // server (JUM-466+); the default 120s was sized for a single-suite harness.
  'test:integration:service-management': 1_200_000,
});

const INTEGRATION_SCRIPTS = Object.freeze([
  'test:integration:express',
  'test:integration:fastify',
  'test:integration:restify',
  'test:integration:lambda',
  'test:integration:cloudflare-workers',
  'test:integration:vercel-functions',
  // loopback, sails-js, feathers, derby-js: removed by JUM-698. Their framework
  // packages are not installed, so the adapters cannot be started by any suite
  // here; what is left of those suites is a unit test of the handler (JUM-704).
  'test:integration:adonis-js',
  'test:integration:total-js',
  'test:integration:realtime',
  'test:integration:service-management'
  // mutex: reclaimed in test-map.json (tier=nightly, script test:integration:mutex) — JUM-556
]);

function executeIntegrationScript(scriptName, options = {}) {
  const spawn = options.spawn || spawnSync;
  const timeoutMs = options.timeoutMs
    ?? INTEGRATION_TIMEOUT_OVERRIDES_MS[scriptName]
    ?? DEFAULT_INTEGRATION_TIMEOUT_MS;
  const result = spawn('bun', ['run', scriptName], {
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' },
    timeout: timeoutMs,
    killSignal: 'SIGTERM'
  });

  if (result.error?.code === 'ETIMEDOUT') {
    return 124;
  }

  return result.status === 0 ? 0 : (result.status || 1);
}

function validateIntegrationManifest(scripts) {
  if (!Array.isArray(scripts) || scripts.length === 0) {
    throw new Error('Integration matrix must declare at least one required target.');
  }

  const uniqueScripts = new Set(scripts);
  if (uniqueScripts.size !== scripts.length) {
    throw new Error('Integration matrix contains duplicate required targets.');
  }

  for (const scriptName of scripts) {
    if (typeof scriptName !== 'string' || scriptName.trim().length === 0) {
      throw new Error('Integration matrix targets must be non-empty script names.');
    }
  }
}

function runIntegrationTests(options = {}) {
  const scripts = options.scripts || INTEGRATION_SCRIPTS;
  const execute = options.execute || executeIntegrationScript;
  const logger = options.logger || console;
  const failures = [];

  validateIntegrationManifest(scripts);

  for (const scriptName of scripts) {
    logger.log(`\n[ci] integration target: ${scriptName}`);

    try {
      const status = execute(scriptName);
      if (status !== 0) {
        failures.push({ scriptName, status });
      }
    } catch (error) {
      logger.error(`[ci] integration target crashed: ${scriptName}`);
      logger.error(error);
      failures.push({ scriptName, status: 1 });
    }
  }

  if (failures.length > 0) {
    logger.error('\n[ci] integration gate failed:');
    for (const failure of failures) {
      logger.error(`- ${failure.scriptName} (exit ${String(failure.status)})`);
    }
    return failures;
  }

  logger.log(`\n[ci] integration gate passed (${String(scripts.length)} targets).`);
  return failures;
}

if (isEntryPoint(module)) {
  try {
    const failures = runIntegrationTests();
    if (failures.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('[ci] integration matrix configuration is invalid.');
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_INTEGRATION_TIMEOUT_MS,
  INTEGRATION_SCRIPTS,
  INTEGRATION_TIMEOUT_OVERRIDES_MS,
  executeIntegrationScript,
  runIntegrationTests,
  validateIntegrationManifest
};
