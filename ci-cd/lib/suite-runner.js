/* eslint-disable no-console */
/**
 * Runner-agnostic suite invocation (JUM-554).
 * Callers select suites; this module maps runner → package-script / bun test.
 */
const { spawnSync } = require('child_process');

function runViaPackageScript(scriptName, options = {}) {
  const spawn = options.spawn || spawnSync;
  const result = spawn('bun', ['run', scriptName], {
    stdio: options.stdio || 'inherit',
    env: { ...process.env, ...(options.env || {}), CI: process.env.CI || 'true' },
    timeout: options.timeoutMs,
    killSignal: 'SIGTERM'
  });
  if (result.error?.code === 'ETIMEDOUT') return 124;
  return Number.isInteger(result.status) ? result.status : 1;
}

function runBunTestFiles(files, options = {}) {
  if (!files || files.length === 0) return 0;
  const spawn = options.spawn || spawnSync;
  const args = ['test', ...(options.watch ? ['--watch'] : []), ...files];
  const result = spawn('bun', args, {
    stdio: options.stdio || 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'dev', ...(options.env || {}) }
  });
  return Number.isInteger(result.status) ? result.status : 1;
}

function runNodeJestFiles(files, options = {}) {
  if (!files || files.length === 0) return 0;
  const spawn = options.spawn || spawnSync;
  const args = [
    'jest',
    '--runInBand',
    options.coverage === true ? '--coverage' : '--coverage=false',
    ...(options.testTimeoutMs ? [`--testTimeout=${String(options.testTimeoutMs)}`] : []),
    ...(options.findRelated ? ['--findRelatedTests'] : []),
    ...files
  ];
  const result = spawn('bunx', args, {
    stdio: options.stdio || 'inherit',
    env: { ...process.env, ...(options.env || {}) }
  });
  return Number.isInteger(result.status) ? result.status : 1;
}

/**
 * Execute unit suites partitioned by runner, preferring package scripts when present.
 * Env JUMENTIX_SUITE_SCRIPT_UNIT overrides the unit package script (default test:unit:selected).
 */
function runUnitSuites(suites, options = {}) {
  const bunSuites = suites.filter((s) => s.runner !== 'node').map((s) => s.path || s);
  const nodeSuites = suites.filter((s) => s.runner === 'node').map((s) => s.path || s);
  const scriptUnit = process.env.JUMENTIX_SUITE_SCRIPT_UNIT;

  if (scriptUnit && bunSuites.length + nodeSuites.length > 0) {
    return runViaPackageScript(scriptUnit, {
      ...options,
      env: {
        ...(options.env || {}),
        JUMENTIX_SELECTED_SUITES: JSON.stringify([...bunSuites, ...nodeSuites])
      }
    });
  }

  let status = 0;
  if (bunSuites.length > 0) {
    status = runBunTestFiles(bunSuites, options);
    if (status !== 0) return status;
  }
  if (nodeSuites.length > 0) {
    status = runNodeJestFiles(nodeSuites, options);
  }
  return status;
}

module.exports = {
  runBunTestFiles,
  runNodeJestFiles,
  runUnitSuites,
  runViaPackageScript
};
