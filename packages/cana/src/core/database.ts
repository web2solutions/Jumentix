/**
 * Database lifecycle: open, upgrade, close, delete (JUM-403).
 *
 * First engine task deliberately, because this is where offline-first products
 * lose data. An IndexedDB upgrade runs inside a `versionchange` transaction the
 * browser controls; if it fails partway the database is left at an indeterminate
 * version with partially-applied schema changes, and unlike a server database
 * there is no operator to repair it.
 *
 * Three behaviours here are decisions rather than mechanics:
 *
 * 1. **A blocked upgrade times out instead of hanging forever.** `onblocked`
 *    fires when another tab holds an old connection open. The naive
 *    implementation waits indefinitely and the application simply never
 *    finishes starting — a hang is worse than an error, because an error can be
 *    displayed.
 *
 * 2. **A downgrade is refused, not attempted.** IndexedDB throws `VersionError`
 *    for a lower version, but the useful part is saying *why*: an older build of
 *    the app opened a database written by a newer one, which is routine when a
 *    user has two tabs across a deploy.
 *
 * 3. **Eviction is evaluated on every open.** The engine cannot tell an evicted
 *    database from a new one by inspection — both open empty — so it consults
 *    the durability tombstone before reporting anything to the caller. See
 *    `storage.ts`.
 */

import type { CanaSchema } from '../contracts';
import { canaError, requestToPromise, translateError } from './errors';
import { applySchema, assertSchema } from './schema';
import type { EvictionVerdict } from './storage';
import { StorageDurability } from './storage';

export interface OpenOptions {
  readonly name: string;
  readonly schema: CanaSchema;
  /** How long to wait for another connection to release a version change. */
  readonly blockedTimeoutMs?: number;
  /** Injected so the engine is testable without a browser global. */
  readonly factory?: IDBFactory;
  readonly durability?: StorageDurability;
}

export interface OpenResult {
  readonly database: IDBDatabase;
  readonly eviction: EvictionVerdict;
  /** True when this open ran an upgrade. */
  readonly upgraded: boolean;
}

const DEFAULT_BLOCKED_TIMEOUT_MS = 10_000;

function resolveFactory(explicit?: IDBFactory): IDBFactory {
  if (explicit) return explicit;
  if (typeof indexedDB !== 'undefined' && indexedDB) return indexedDB;
  throw canaError(
    'Unavailable',
    'No usable IndexedDB in this environment. Private browsing or an unsupported '
      + 'browser — there is no fallback store, so this is terminal rather than degraded.'
  );
}

/** Read the current version without triggering an upgrade. 0 when absent. */
async function currentVersion(factory: IDBFactory, name: string): Promise<number> {
  // `databases()` is the only non-destructive way to ask, and it is not
  // universally available. Where it is missing the caller still gets a correct
  // answer from the open itself; this is an optimisation for the pre-check.
  if (typeof factory.databases === 'function') {
    try {
      const listed = await factory.databases();
      const match = listed.find((entry) => entry.name === name);
      return match?.version ?? 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

/** True when every store in the database is empty. */
async function isDatabaseEmpty(database: IDBDatabase): Promise<boolean> {
  const names = Array.from(database.objectStoreNames);
  if (names.length === 0) return true;

  const transaction = database.transaction(names, 'readonly');
  for (const name of names) {
    // Sequential on purpose: the transaction's auto-commit window stays open
    // only while requests are outstanding, and interleaving awaits from other
    // sources here is exactly how it closes underneath you.
    // eslint-disable-next-line no-await-in-loop
    const count = await requestToPromise(transaction.objectStore(name).count(), { store: name });
    if (count > 0) return false;
  }
  return true;
}

/**
 * Open a database, applying the schema when the version requires it.
 *
 * Rejects with a `CanaError`; no `DOMException` escapes.
 */
export async function openDatabase(options: OpenOptions): Promise<OpenResult> {
  assertSchema(options.schema);

  const factory = resolveFactory(options.factory);
  const durability = options.durability ?? new StorageDurability({});
  const blockedTimeoutMs = options.blockedTimeoutMs ?? DEFAULT_BLOCKED_TIMEOUT_MS;

  const existingVersion = await currentVersion(factory, options.name);
  if (existingVersion > options.schema.version) {
    throw canaError(
      'UpgradeFailed',
      `Refusing to downgrade "${options.name}" from version ${existingVersion} to `
        + `${options.schema.version}. A newer build of the application wrote this database; `
        + 'downgrades are not attempted because they cannot be made safe.'
    );
  }

  let upgraded = false;
  let upgradeFailure: unknown;

  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    let settled = false;
    const request = factory.open(options.name, options.schema.version);

    const blockedTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(canaError(
        'UpgradeBlocked',
        `Upgrading "${options.name}" is blocked by another open connection and did not `
          + `clear within ${blockedTimeoutMs}ms. Another tab is holding the previous version.`
      ));
    }, blockedTimeoutMs);

    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(blockedTimer);
      action();
    };

    request.onupgradeneeded = () => {
      upgraded = true;
      const { transaction } = request;
      if (!transaction) {
        upgradeFailure = canaError('UpgradeFailed', 'Upgrade started without a transaction.');
        return;
      }
      try {
        applySchema(request.result, transaction, options.schema);
      } catch (error) {
        // Record and abort rather than throw: throwing here is swallowed by the
        // DOM event handler, and the open would resolve with a half-applied
        // schema — the indeterminate state this task exists to prevent.
        upgradeFailure = translateError(error);
        transaction.abort();
      }
    };

    request.onsuccess = () => finish(() => {
      if (upgradeFailure !== undefined) {
        request.result.close();
        reject(translateError(upgradeFailure));
        return;
      }
      resolve(request.result);
    });

    request.onerror = () => finish(() => {
      reject(upgradeFailure !== undefined
        ? translateError(upgradeFailure)
        : translateError(request.error, {}));
    });

    request.onblocked = () => {
      // Leave the timer running; this only tells us why we are waiting.
    };
  });

  // Only now, with a live connection, can eviction be judged: it needs both the
  // tombstone and the observed contents.
  const eviction = durability.evaluateOpen({
    databaseName: options.name,
    foundVersion: existingVersion,
    isEmpty: await isDatabaseEmpty(database)
  });

  durability.recordExistence(options.name, options.schema.version);

  return { database, eviction, upgraded };
}

export function closeDatabase(database: IDBDatabase): void {
  database.close();
}

/** Delete a database, refusing to hang when another connection blocks it. */
export async function deleteDatabase(
  name: string,
  options: { factory?: IDBFactory; blockedTimeoutMs?: number } = {}
): Promise<void> {
  const factory = resolveFactory(options.factory);
  const blockedTimeoutMs = options.blockedTimeoutMs ?? DEFAULT_BLOCKED_TIMEOUT_MS;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const request = factory.deleteDatabase(name);

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(canaError(
        'UpgradeBlocked',
        `Deleting "${name}" is blocked by another open connection.`
      ));
    }, blockedTimeoutMs);

    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };

    request.onsuccess = () => finish(resolve);
    request.onerror = () => finish(() => reject(translateError(request.error)));
  });
}
