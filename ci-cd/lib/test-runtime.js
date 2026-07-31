/* eslint-disable no-console */
/**
 * Local vs CI test runtime selection (Requirement 106).
 * - Local default: bun
 * - Node only when CI=true or JUMENTIX_TEST_RUNTIME=node
 */
function resolveTestRuntime(env = process.env) {
  const forced = String(env.JUMENTIX_TEST_RUNTIME || '').toLowerCase().trim();
  if (forced === 'node' || forced === 'jest') return 'node';
  if (forced === 'bun') return 'bun';
  if (env.CI === 'true' || env.CI === '1') return 'node';
  return 'bun';
}

function isCiNodeRuntime(env = process.env) {
  return resolveTestRuntime(env) === 'node';
}

function suiteLocalRunner(suite) {
  return suite?.runner || 'bun';
}

function suiteCiRunner(suite) {
  return suite?.ciRunner || suite?.runner || 'bun';
}

function effectiveRunner(suite, env = process.env) {
  return isCiNodeRuntime(env) ? suiteCiRunner(suite) : suiteLocalRunner(suite);
}

module.exports = {
  effectiveRunner,
  isCiNodeRuntime,
  resolveTestRuntime,
  suiteCiRunner,
  suiteLocalRunner
};
