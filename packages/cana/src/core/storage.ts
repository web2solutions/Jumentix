/**
 * Storage durability: quota, persistence and eviction detection (JUM-560).
 *
 * Cana is offline-first, which means the browser copy is sometimes the only copy.
 * Two mechanisms take that copy away, and neither announces itself:
 *
 * 1. **Quota exhaustion** — a write fails with `QuotaExceededError`, possibly
 *    partway through a bulk.
 * 2. **Eviction** — the browser reclaims non-persisted storage under pressure, or
 *    after inactivity. No event, no error. The database is simply empty on the
 *    next open.
 *
 * When the client is on IndexedDB, eviction is not a quiet degradation — it is
 * data loss for that backend. (A separate localStorage fallback may open when
 * IndexedDB itself is unavailable; that path does not restore an evicted IDB.)
 * The central problem here is not quota handling. It is this:
 *
 *   **An evicted database and a brand-new one are indistinguishable by
 *   inspection. Both open empty.**
 *
 * Reporting the first as the second presents a user's lost work as a welcome
 * screen. That is the failure this module exists to make impossible.
 *
 * ## How eviction is detected
 *
 * A sentinel is written outside IndexedDB, in `localStorage`, on first successful
 * open. It records that a database of this name existed and at what version.
 *
 * For IndexedDB eviction detection, `localStorage` is used **deliberately as a
 * tombstone**: it holds no user data for that purpose, only the fact that an
 * IndexedDB database once existed. The optional localStorage *data* fallback
 * (JUM-615) is a separate key namespace (`cana.ls.v1:`) and is not this tombstone.
 *
 * The pairing works because the two are evicted on different schedules. Browsers
 * clear IndexedDB under storage pressure far more readily than `localStorage`,
 * so "sentinel present, database empty" is a strong eviction signal.
 *
 * It is not a perfect signal, and the limits are stated rather than implied:
 *
 * - "Clear site data" removes both, so eviction becomes indistinguishable from a
 *   deliberate user reset. That is acceptable: the user did it on purpose.
 * - Private browsing gives no durable sentinel, so eviction cannot be detected
 *   there. Also acceptable: private sessions are `Unavailable` territory anyway.
 * - A user who clears only IndexedDB via devtools is reported as evicted. Correct
 *   for our purposes — their data is in fact gone.
 */

import type { CanaStorageState } from '../contracts';

/** Default headroom at which `nearQuota` flips, as a fraction of quota. */
const DEFAULT_NEAR_QUOTA_RATIO = 0.85;

const SENTINEL_PREFIX = 'cana.existed.v1:';

/**
 * The environment capabilities this module needs, injected rather than reached
 * for, so the logic is testable without a browser.
 */
export interface StorageEnvironment {
  /** `navigator.storage`, when present. */
  readonly estimate?: () => Promise<{ usage?: number; quota?: number }>;
  readonly persist?: () => Promise<boolean>;
  readonly persisted?: () => Promise<boolean>;
  /** Durable key/value used only for the existence tombstone. */
  readonly tombstone?: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
  };
}

export interface DatabaseObservation {
  readonly databaseName: string;
  /**
   * Version found before opening: 0 when the database did not exist, and
   * `undefined` when the engine could not determine it.
   *
   * The three-way distinction is load-bearing. `IDBFactory.databases()` is not
   * universally available — Safari lacked it for years — and an implementation
   * that reports "cannot tell" as 0 turns every open in those browsers into
   * "the database is gone", which classifies healthy populated databases as
   * evicted. Absence and ignorance are different facts.
   */
  readonly foundVersion: number | undefined;
  /** True when the opened database contains no records in any store. */
  readonly isEmpty: boolean;
}

export interface EvictionVerdict {
  readonly evicted: boolean;
  /**
   * Why the verdict was reached, so a consumer can surface something specific
   * instead of a generic warning.
   */
  readonly reason:
    | 'first-run'
    | 'existing-data'
    | 'evicted-database-absent'
    | 'evicted-database-empty'
    | 'undetectable-no-tombstone';
}

function sentinelKey(databaseName: string): string {
  return `${SENTINEL_PREFIX}${databaseName}`;
}

/**
 * Decide whether a database that opened empty was evicted or simply new.
 *
 * Pure, so the decision table is testable exhaustively rather than by luck.
 */
/**
 * Whether the tombstone records that this database was ever seen holding data.
 *
 * A stored flag rather than an inference, because `isEmpty` at open time cannot
 * distinguish "wiped" from "never written to". Tombstones written before this
 * field existed read as false, which errs towards not claiming a loss.
 */
function recordedData(tombstoneValue: string | null): boolean {
  if (tombstoneValue === null) return false;
  try {
    return (JSON.parse(tombstoneValue) as { hadData?: unknown }).hadData === true;
  } catch {
    return false;
  }
}

export function classifyOpen(
  observation: DatabaseObservation,
  tombstoneValue: string | null
): EvictionVerdict {
  const hadDatabaseBefore = tombstoneValue !== null;

  if (!hadDatabaseBefore) {
    // No record of a previous life. Either genuinely first run, or a session
    // where no durable marker is available at all — the caller distinguishes
    // those via `recordExistence` returning false.
    return { evicted: false, reason: 'first-run' };
  }

  if (observation.foundVersion === 0) {
    // We know it existed, and now it is not there at all.
    return { evicted: true, reason: 'evicted-database-absent' };
  }

  // `undefined` means the pre-open probe could not answer, not that the database
  // was missing. Falling through to the contents check is the only sound move:
  // claiming eviction on an unanswered question would report loss every time in
  // any browser without `databases()`.

  if (observation.isEmpty && !recordedData(tombstoneValue)) {
    // Present and empty, and we have no record that it ever held anything. This
    // is the ordinary case of a user who opened the app and has not written
    // anything yet — reporting it as eviction would tell them they lost data
    // they never had, which is exactly as damaging as missing a real loss.
    return { evicted: false, reason: 'existing-data' };
  }

  if (observation.isEmpty) {
    // The database exists but is empty, and we know it held data before. Some
    // browsers recreate the store shell while dropping contents.
    return { evicted: true, reason: 'evicted-database-empty' };
  }

  return { evicted: false, reason: 'existing-data' };
}

export class StorageDurability {
  private readonly environment: StorageEnvironment;

  private readonly nearQuotaRatio: number;

  private evictedFlag = false;

  private lastVerdict: EvictionVerdict | null = null;

  constructor(environment: StorageEnvironment, nearQuotaRatio = DEFAULT_NEAR_QUOTA_RATIO) {
    this.environment = environment;
    this.nearQuotaRatio = nearQuotaRatio;
  }

  /**
   * Ask for persistent storage.
   *
   * Returns `'unknown'` rather than `false` when the API is absent. Those are
   * genuinely different: `false` means the browser refused, `'unknown'` means we
   * cannot claim durability either way — and flattening the second into the first
   * would let an application report a guarantee it does not have.
   */
  async requestPersistence(): Promise<boolean | 'unknown'> {
    const { persist, persisted } = this.environment;
    if (!persist && !persisted) {
      return 'unknown';
    }

    try {
      if (persisted) {
        const already = await persisted();
        if (already) return true;
      }
      if (persist) {
        return await persist();
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Record that this database exists, so a later empty open is recognisable as
   * eviction.
   *
   * @returns false when no durable marker could be written, which means eviction
   *   will be undetectable for this origin. The caller is expected to surface
   *   that rather than assume detection works.
   */
  recordExistence(databaseName: string, version: number, hadData = false): boolean {
    const { tombstone } = this.environment;
    if (!tombstone) return false;
    try {
      // `hadData` is sticky: once this database has been seen holding records, a
      // later empty open is a loss rather than a fresh start. Clearing it on an
      // empty open would erase the only evidence eviction is detectable by.
      const seenData = hadData || recordedData(this.readTombstone(databaseName));
      tombstone.set(
        sentinelKey(databaseName),
        JSON.stringify({ version, at: Date.now(), hadData: seenData })
      );
      return true;
    } catch {
      // Private browsing throws on write in some browsers. Undetectable, not fatal.
      return false;
    }
  }

  /** Read the raw tombstone, treating any failure to read as absent. */
  private readTombstone(databaseName: string): string | null {
    const { tombstone } = this.environment;
    if (!tombstone) return null;
    try {
      return tombstone.get(sentinelKey(databaseName));
    } catch {
      return null;
    }
  }

  /** Evaluate an open against the tombstone. Records the verdict for `state()`. */
  evaluateOpen(observation: DatabaseObservation): EvictionVerdict {
    const { tombstone } = this.environment;

    if (!tombstone) {
      const verdict: EvictionVerdict = { evicted: false, reason: 'undetectable-no-tombstone' };
      this.lastVerdict = verdict;
      return verdict;
    }

    const verdict = classifyOpen(observation, this.readTombstone(observation.databaseName));
    this.lastVerdict = verdict;
    this.evictedFlag = verdict.evicted;
    return verdict;
  }

  /** Clear the eviction flag once the consumer has acknowledged the loss. */
  acknowledgeEviction(): void {
    this.evictedFlag = false;
  }

  get lastEvictionVerdict(): EvictionVerdict | null {
    return this.lastVerdict;
  }

  /** Current durability state, for `CanaClient.storageState()`. */
  async state(): Promise<CanaStorageState> {
    const persistent = await this.currentPersistence();
    const { usageBytes, quotaBytes } = await this.currentUsage();

    const nearQuota = usageBytes !== undefined
      && quotaBytes !== undefined
      && quotaBytes > 0
      && usageBytes / quotaBytes >= this.nearQuotaRatio;

    return {
      persistent,
      usageBytes,
      quotaBytes,
      nearQuota,
      evicted: this.evictedFlag
    };
  }

  private async currentPersistence(): Promise<boolean | 'unknown'> {
    const { persisted } = this.environment;
    if (!persisted) return 'unknown';
    try {
      return await persisted();
    } catch {
      return 'unknown';
    }
  }

  private async currentUsage(): Promise<{ usageBytes?: number; quotaBytes?: number }> {
    const { estimate } = this.environment;
    if (!estimate) return {};
    try {
      const result = await estimate();
      return { usageBytes: result.usage, quotaBytes: result.quota };
    } catch {
      return {};
    }
  }
}

/**
 * Build the environment from real browser globals.
 *
 * Kept separate from the class so every test path can inject a fake and the
 * browser-only reach happens in exactly one place.
 */
export function browserStorageEnvironment(): StorageEnvironment {
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  const storage = nav?.storage;
  const local = typeof localStorage === 'undefined' ? undefined : localStorage;

  return {
    estimate: storage?.estimate ? () => storage.estimate() : undefined,
    persist: storage?.persist ? () => storage.persist() : undefined,
    persisted: storage?.persisted ? () => storage.persisted() : undefined,
    tombstone: local
      ? {
        get: (key) => local.getItem(key),
        set: (key, value) => local.setItem(key, value),
        remove: (key) => local.removeItem(key)
      }
      : undefined
  };
}
