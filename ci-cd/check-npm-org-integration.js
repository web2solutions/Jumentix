#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require('node:child_process');

function run(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

try {
  const whoami = run('npm whoami');
  if (!whoami) {
    fail('[npm-org-check] Unable to resolve current npm user.');
  }
  console.log(`[npm-org-check] Authenticated as: ${whoami}`);
} catch (error) {
  fail('[npm-org-check] npm authentication is not configured. Run npm login for the target account.');
}

try {
  const orgUsersRaw = run('npm org ls xpertminds --json');
  let orgUsers;
  try {
    orgUsers = JSON.parse(orgUsersRaw);
  } catch {
    orgUsers = null;
  }
  if (!orgUsers || typeof orgUsers !== 'object') {
    fail('[npm-org-check] Could not parse xpertminds org members from npm CLI.');
  }
  console.log('[npm-org-check] xpertminds org membership data is accessible.');
} catch (error) {
  fail('[npm-org-check] Unable to access xpertminds org membership. Ensure account has org access.');
}

console.log('[npm-org-check] npm integration check passed.');
