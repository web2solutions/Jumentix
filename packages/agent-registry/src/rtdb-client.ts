/* eslint-disable no-console */
import {
  initializeApp,
  cert,
  getApps,
  deleteApp
} from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import type { RtdbLike } from './types';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function parseServiceAccount(): Record<string, unknown> {
  const raw = requiredEnv('FIREBASE_SERVICE_ACCOUNT_KEY');
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
      throw new Error('Invalid service account structure');
    }
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON: ${error.message}`);
    }
    throw error;
  }
}

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
        'Firebase app is already initialized without FIREBASE_DATABASE_URL. '
        + 'Create the RTDB client before Firestore, or set FIREBASE_DATABASE_URL '
        + 'before the first Firebase initialize call.'
      );
    }
    if (existingUrl !== databaseURL) {
      throw new Error(
        'Firebase app databaseURL does not match FIREBASE_DATABASE_URL.'
      );
    }
    return;
  }

  const serviceAccount = parseServiceAccount();
  initializeApp({
    credential: cert({
      projectId: String(serviceAccount.project_id),
      privateKey: String(serviceAccount.private_key).replace(/\\n/g, '\n'),
      clientEmail: String(serviceAccount.client_email)
    }),
    databaseURL
  });
}

export function createRtdbClient(): RtdbLike {
  const databaseURL = requiredEnv('FIREBASE_DATABASE_URL');
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
