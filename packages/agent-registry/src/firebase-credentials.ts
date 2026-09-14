import { readFileSync } from 'node:fs';

/**
 * Shared credential resolution for the existing Firebase project
 * (`jumentix-service-registry`): same service account as Firestore (089),
 * optional RTDB URL override, otherwise derived from `project_id`.
 */

export function defaultDatabaseUrl(projectId: string): string {
  const id = projectId.trim();
  if (!id) {
    throw new Error('Cannot derive FIREBASE_DATABASE_URL: empty project_id');
  }
  // Canonical URL for jumentix-service-registry (trailing slash optional / stripped).
  return `https://${id}-default-rtdb.firebaseio.com`;
}

/** Normalize explicit RTDB URLs so a trailing slash does not fork config. */
export function normalizeDatabaseUrl(url: string): string {
  const trimmed = url.trim();
  let end = trimmed.length;
  while (end > 0 && trimmed.charAt(end - 1) === '/') {
    end -= 1;
  }
  return trimmed.slice(0, end);
}

function parseServiceAccountJson(raw: string, source: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
      throw new Error('Invalid service account structure');
    }
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${source} is not valid JSON: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Load the Firebase Admin service account.
 *
 * Precedence:
 * 1. `FIREBASE_SERVICE_ACCOUNT_KEY` (inline JSON)
 * 2. `FIREBASE_SERVICE_ACCOUNT_KEY_FILE` (path to the existing adminsdk JSON)
 */
export function loadServiceAccount(): Record<string, unknown> {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (inline) {
    return parseServiceAccountJson(inline, 'FIREBASE_SERVICE_ACCOUNT_KEY');
  }

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE?.trim();
  if (filePath) {
    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Unable to read FIREBASE_SERVICE_ACCOUNT_KEY_FILE (${filePath}): ${message}`
      );
    }
    return parseServiceAccountJson(raw, 'FIREBASE_SERVICE_ACCOUNT_KEY_FILE');
  }

  throw new Error(
    'Missing Firebase credentials: set FIREBASE_SERVICE_ACCOUNT_KEY '
    + 'or FIREBASE_SERVICE_ACCOUNT_KEY_FILE (reuse the existing '
    + 'jumentix-service-registry adminsdk JSON).'
  );
}

/**
 * Resolve the Realtime Database URL for the agent bus.
 *
 * Prefer explicit `FIREBASE_DATABASE_URL`. Otherwise derive the default RTDB
 * URL from the service-account `project_id` so operators reuse the same
 * Firebase project as Firestore without a second secret.
 */
export function resolveDatabaseUrl(
  serviceAccount?: Record<string, unknown>
): string {
  const explicit = process.env.FIREBASE_DATABASE_URL?.trim();
  if (explicit) return normalizeDatabaseUrl(explicit);
  const account = serviceAccount ?? loadServiceAccount();
  return defaultDatabaseUrl(String(account.project_id));
}

export function hasFirebaseCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim()
    || process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE?.trim()
  );
}
