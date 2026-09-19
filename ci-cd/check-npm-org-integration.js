#!/usr/bin/env node
/* eslint-disable no-console */
const { execFileSync } = require('node:child_process');

const NPM_SCOPE = 'jumentix';

function run(args) {
  const env = { ...process.env };
  if (env.NPM_JUMENTIX_CI_CD) env.NODE_AUTH_TOKEN = env.NPM_JUMENTIX_CI_CD;
  return execFileSync('npm', args, { env, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

try {
  const whoami = run(['whoami']);
  if (!whoami) {
    fail('[npm-org-check] Unable to resolve current npm user.');
  }
  console.log(`[npm-org-check] Authenticated as: ${whoami}`);
} catch (error) {
  fail('[npm-org-check] npm authentication is not configured. Run npm login for the target account.');
}

try {
  const orgUsersRaw = run(['org', 'ls', NPM_SCOPE, '--json']);
  let orgUsers;
  try {
    orgUsers = JSON.parse(orgUsersRaw);
  } catch {
    orgUsers = null;
  }
  if (!orgUsers || typeof orgUsers !== 'object') {
    fail(`[npm-org-check] Could not parse ${NPM_SCOPE} org members from npm CLI.`);
  }
  console.log(`[npm-org-check] ${NPM_SCOPE} org membership data is accessible.`);
} catch (error) {
  fail(`[npm-org-check] Unable to access ${NPM_SCOPE} org membership. Ensure account has org access.`);
}

console.log('[npm-org-check] npm integration check passed.');
