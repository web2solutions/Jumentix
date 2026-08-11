/* eslint-disable no-console */
import {
  initializeApp,
  cert,
  getApps,
  deleteApp
} from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import {
  loadServiceAccount,
  resolveDatabaseUrl
} from './firebase-credentials';
import type { RtdbLike } from './types';

/**
 * Ensure the Admin app exists with a Realtime Database URL.
 *
 * RTDB requires `databaseURL` at initialize time. When an app was already
 * created without it (Firestore-only path), fail closed rather than pretending
 * the bus is available.
 */
function ensureAppWithDatabaseUrl(databaseURL: string): void {
  const apps = getApps();
  if (apps.length > 0) {
    const existing = apps[0] as { options?: { databaseURL?: string } };
    const existingUrl = existing.options?.databaseURL;
    if (!existingUrl) {
      throw new Error(
        'Firebase app is already initialized without a Realtime Database URL. '
        + 'Create the RTDB client before Firestore, or set FIREBASE_DATABASE_URL '
        + '(or rely on the project_id-derived default) before the first Firebase '
        + 'initialize call.'
      );
    }
    if (existingUrl !== databaseURL) {
      throw new Error(
        'Firebase app databaseURL does not match the resolved RTDB URL.'
      );
    }
    return;
  }

  const serviceAccount = loadServiceAccount();
  initializeApp({
    credential: cert({
      projectId: String(serviceAccount.project_id),
      privateKey: String(serviceAccount.private_key).replace(/\\n/g, '\n'),
      clientEmail: String(serviceAccount.client_email)
    }),
    databaseURL
  });
}

/**
 * Create an RTDB client against the existing Firebase project used by the
 * agent registry (same service account as Firestore).
 *
 * `FIREBASE_DATABASE_URL` is optional: when unset, the default
 * `https://<project_id>-default-rtdb.firebaseio.com` is derived from the
 * service account.
 */
export function createRtdbClient(): RtdbLike {
  const databaseURL = resolveDatabaseUrl();
  ensureAppWithDatabaseUrl(databaseURL);
  return getDatabase() as unknown as RtdbLike;
}

export async function closeRtdb(): Promise<void> {
  const apps = getApps() as unknown[];
  await Promise.all(apps.map((app) => deleteApp(app as Parameters<typeof deleteApp>[0])));
}

/**
 * Sanitize a value for use as an RTDB path segment.
 * RTDB keys cannot contain `.` `#` `$` `[` `]`.
 */
export function sanitizeRtdbKey(value: string): string {
  const cleaned = value.trim().replace(/[.#$[\]/]/g, '_');
  return cleaned.slice(0, 200) || 'unknown';
}
