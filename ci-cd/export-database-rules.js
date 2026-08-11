/* eslint-disable no-console */
/**
 * JUM-656 — write the live Realtime Database rules to `database.rules.json`.
 *
 * The rules governing the Requirement 129 agent bus exist only in the Firebase
 * console. Nothing in this repository can read them, review them or diff them,
 * so a missing `.indexOn` — or a missing access restriction — is invisible to
 * every check we have.
 *
 * This is deliberately an *export*, not an author-from-scratch. `firebase
 * deploy --only database` replaces the entire ruleset, so a hand-written file
 * committed here and deployed would silently drop whatever protections are
 * live today. The safe order is: export what is running, commit that verbatim,
 * review the diff, then edit.
 *
 * Read-only. It performs one GET against `/.settings/rules.json` and never
 * writes to the database or to the project.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_KEY="$(cat /path/to/key.json)" \
 *     node ci-cd/export-database-rules.js
 *
 * `FIREBASE_DATABASE_URL` is optional: without it, the database instance is
 * discovered through the Firebase Management API, which is what the console
 * itself lists.
 */
const fs = require('fs');
const path = require('path');
const { isEntryPoint } = require('./lib/entry-point.js');

const RULES_FILE = 'database.rules.json';
const SCOPES = [
  'https://www.googleapis.com/auth/firebase.database',
  'https://www.googleapis.com/auth/firebase',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

/**
 * The service account, parsed from the environment.
 *
 * The key is never logged, never echoed and never written anywhere: only
 * `project_id` leaves this function's caller, and only to build a URL.
 */
function serviceAccount(env = process.env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw || raw.trim() === '') {
    throw new Error(
      'Missing FIREBASE_SERVICE_ACCOUNT_KEY. Export the key JSON into the '
      + 'environment; do not pass a path and do not commit it.'
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON: ${error.message}`);
  }
  if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is missing project_id, private_key or client_email');
  }
  return parsed;
}

/**
 * Minted through `firebase-admin`, which the repository already depends on for
 * the bus itself. Reaching for `google-auth-library` directly would add a
 * dependency to read one token.
 */
async function accessToken(account) {
  const { cert } = require('firebase-admin/app');
  const credential = cert(account);
  const token = await credential.getAccessToken();
  const value = token && token.access_token;
  if (!value) throw new Error('Could not mint an access token for the service account');
  return value;
}

/**
 * The database instance URL.
 *
 * Guessing `https://<project>-default-rtdb.firebaseio.com` is wrong for every
 * project created in a non-US region, and a wrong guess here reads an empty
 * ruleset that looks like a legitimate answer. Ask the API that the console
 * asks.
 */
async function databaseUrl(account, token, env = process.env) {
  if (env.FIREBASE_DATABASE_URL && env.FIREBASE_DATABASE_URL.trim() !== '') {
    return env.FIREBASE_DATABASE_URL.trim().replace(/\/+$/, '');
  }
  const endpoint = 'https://firebasedatabase.googleapis.com/v1beta/projects/'
    + `${account.project_id}/locations/-/instances`;
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new Error(
      `Could not list database instances (${response.status}). Set FIREBASE_DATABASE_URL `
      + 'explicitly, or grant the service account the Firebase Viewer role.'
    );
  }
  const body = await response.json();
  const instances = Array.isArray(body.instances) ? body.instances : [];
  if (instances.length === 0) {
    throw new Error(`Project ${account.project_id} has no Realtime Database instance`);
  }
  const chosen = instances.find((instance) => instance.type === 'DEFAULT_DATABASE') || instances[0];
  if (!chosen.databaseUrl) throw new Error('Database instance has no databaseUrl');
  return chosen.databaseUrl.replace(/\/+$/, '');
}

async function fetchRules(url, token) {
  const response = await fetch(`${url}/.settings/rules.json`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error(
      `Reading ${url}/.settings/rules.json returned ${response.status}. The service account `
      + 'needs the Firebase Realtime Database Viewer role to read rules.'
    );
  }
  return response.text();
}

async function run(rootDir = process.cwd(), env = process.env) {
  try {
    const account = serviceAccount(env);
    const token = await accessToken(account);
    const url = await databaseUrl(account, token, env);
    const rules = await fetchRules(url, token);

    const target = path.join(rootDir, RULES_FILE);
    const existed = fs.existsSync(target);
    fs.writeFileSync(target, rules.endsWith('\n') ? rules : `${rules}\n`, 'utf8');

    console.log(
      `${existed ? 'Updated' : 'Wrote'} ${RULES_FILE} from the live rules of ${url}.`
    );
    console.log('Review the diff before deploying: a deploy replaces the whole ruleset.');
    return 0;
  } catch (error) {
    console.error(`[database-rules] ${error.message}`);
    return 1;
  }
}

if (isEntryPoint(module)) {
  run().then((code) => { process.exitCode = code; });
}

module.exports = { databaseUrl, fetchRules, run, serviceAccount };
