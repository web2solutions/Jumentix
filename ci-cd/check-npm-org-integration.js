#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { isEntryPoint } = require('./lib/entry-point.js');

const NPM_SCOPE = 'jumentix';

/**
 * Resolve the npm CLI to an absolute invocation instead of the bare `npm` name.
 *
 * Spawning `npm` lets the operating system search PATH, and PATH is inherited
 * from whoever started the process. A writable directory earlier in that list
 * shadows the real CLI, and this check then asks that impostor who the
 * authenticated npm user is — the exact shadowing vector Sonar reports as
 * `javascript:S4036` on the bare-name form.
 *
 * npm has no root-owned location the way git does (ci-cd/lib/git-binary.js), so
 * resolution works from most to least specific: npm's own absolute self-report
 * (`npm_execpath` + `npm_node_execpath`, set when this runs as a package
 * script), then the npm bundled next to the running node binary, then fixed
 * install locations that are never discovered through PATH order. When none
 * resolves it fails closed — a credential check that cannot say which binary
 * it is running must stop, not guess.
 */
const NPM_INSTALL_CANDIDATES = Object.freeze([
  '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js',
  '/usr/local/lib/node_modules/npm/bin/npm-cli.js',
  '/usr/lib/node_modules/npm/bin/npm-cli.js'
]);

function resolveNpmCommand({
  env = process.env,
  execPath = process.execPath,
  exists = fs.existsSync
} = {}) {
  const npmCli = env.npm_execpath;
  const npmNode = env.npm_node_execpath;
  // Bun exports its own path as npm_execpath for script compatibility; only an
  // npm-owned CLI passes this check.
  if (npmCli && /npm/i.test(path.basename(npmCli))) {
    return { command: npmNode || execPath, argsPrefix: [npmCli] };
  }
  const bundled = path.join(
    path.dirname(execPath),
    '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'
  );
  if (exists(bundled)) {
    return { command: execPath, argsPrefix: [bundled] };
  }
  for (const candidate of NPM_INSTALL_CANDIDATES) {
    if (exists(candidate)) {
      return { command: execPath, argsPrefix: [candidate] };
    }
  }
  throw new Error(
    'Could not resolve the npm CLI to an absolute path '
      + `(looked next to ${execPath} and in: ${NPM_INSTALL_CANDIDATES.join(', ')}).\n`
      + '  This check resolves npm without PATH on purpose: a writable PATH entry\n'
      + '  can shadow the real CLI and this check trusts what npm tells it about\n'
      + '  authentication. Run it through an npm script (npm_execpath) or add the\n'
      + '  npm-cli.js location to NPM_INSTALL_CANDIDATES in ci-cd/check-npm-org-integration.js.'
  );
}

function run(args, resolverOptions) {
  const env = { ...process.env };
  if (env.NPM_JUMENTIX_CI_CD) env.NODE_AUTH_TOKEN = env.NPM_JUMENTIX_CI_CD;
  const npm = resolveNpmCommand(resolverOptions);
  return execFileSync(npm.command, [...npm.argsPrefix, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

/**
 * The credential checks themselves, injectable for the suite: `runCommand`
 * stands in for the real npm invocation so the failure and parse branches run
 * without touching npm or the network. Messages preserve the CLI's contract.
 */
function checkNpmOrgAccess(runCommand = run) {
  let whoami = '';
  try {
    whoami = runCommand(['whoami']);
  } catch {
    throw new Error('npm authentication is not configured. Run npm login for the target account.');
  }
  if (!whoami) {
    throw new Error('Unable to resolve current npm user.');
  }

  let orgUsersRaw = '';
  try {
    orgUsersRaw = runCommand(['org', 'ls', NPM_SCOPE, '--json']);
  } catch {
    throw new Error(`Unable to access ${NPM_SCOPE} org membership. Ensure account has org access.`);
  }
  let orgUsers = null;
  try {
    orgUsers = JSON.parse(orgUsersRaw);
  } catch {
    orgUsers = null;
  }
  if (!orgUsers || typeof orgUsers !== 'object') {
    throw new Error(`Could not parse ${NPM_SCOPE} org members from npm CLI.`);
  }
  return whoami;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function main() {
  try {
    const whoami = checkNpmOrgAccess();
    console.log(`[npm-org-check] Authenticated as: ${whoami}`);
    console.log(`[npm-org-check] ${NPM_SCOPE} org membership data is accessible.`);
    console.log('[npm-org-check] npm integration check passed.');
  } catch (error) {
    fail(`[npm-org-check] ${error.message}`);
  }
}

module.exports = {
  NPM_INSTALL_CANDIDATES,
  NPM_SCOPE,
  checkNpmOrgAccess,
  resolveNpmCommand,
  run
};

if (isEntryPoint(module)) {
  main();
}
