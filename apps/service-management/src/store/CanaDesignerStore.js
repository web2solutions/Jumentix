import { IDesignerStore } from './IDesignerStore.js';

/**
 * CanaDesignerStore — the `IDesignerStore` adapter over the Cana client
 * (JUM-483), the first stone of the H3 Cana adoption wave.
 *
 * This is the adapter the port was shaped for (JUM-468) and, since JUM-484's
 * one-way migration of `service-management.v1`, the SOLE implementation of
 * the port: the transitional `LocalStorageDesignerStore` is retired and
 * deleted, and Cana has no fallback to localStorage (decision 2026-07-29), so
 * every failure state the port expresses is genuinely produced here — nothing
 * behind this store catches the designer.
 *
 * ## How the Cana error taxonomy maps onto the port
 *
 * The mapping never reports a non-success as success, and each Cana condition
 * surfaces distinctly through the `reason` string (the port's state sets are
 * fixed by JUM-468, so distinctness within a state is carried by `reason`):
 *
 * - **Missing/unusable IndexedDB** — Cana rejects `open()` with code
 *   `'Unavailable'` (private browsing, unsupported browser; terminal under the
 *   no-fallback rule). `probe()`/`load()` → `'unavailable'`. `save()` has no
 *   `'unavailable'` state in the port, so it → `'unknown'` with an
 *   `unavailable:` reason — never `'persisted'`.
 * - **Eviction** — Cana's quota/persistence/eviction policy (Cana JUM-560)
 *   detects a previously-existing database that is gone or empty and raises
 *   `storageState().evicted`. A `load()` that finds no record while that flag
 *   is set → `'lost'`, NEVER `'empty'`: an evicted database and a first run
 *   are indistinguishable by inspection, and only the tombstone verdict tells
 *   them apart. A record that IS found loads normally — data re-saved after
 *   the eviction open is real data, not a loss.
 * - **Quota exhaustion** — a write rejected with `'QuotaExceeded'` did NOT
 *   happen (Cana's taxonomy says so explicitly). The port has no
 *   deterministic-failure save state, so `save()` → `'unknown'` with a
 *   `quota:` reason: the designer takes its not-saved path and the cause is
 *   distinguishable from a genuinely indeterminate outcome. Quota PRESSURE
 *   that has not yet failed a write (`storageState().nearQuota`, or
 *   non-persistent storage) is surfaced at `probe()` as `'available'` with a
 *   diagnostic `reason`, feeding JUM-484's environment states — reads still
 *   work, so the state stays `'available'`.
 * - **Unknown outcome** — a transaction torn down after dispatch (worker
 *   crash, tab kill; Cana JUM-411/559) resolves with outcome `'unknown'`.
 *   The adapter reports `'unknown'` and embeds `correlationId`/`attemptedAt`
 *   in the reason — the two values `client.resolveWrite()` needs to reconcile
 *   the write later. Writes are routed through `client.transaction()` rather
 *   than the auto-commit table precisely so those handles exist on the one
 *   outcome that needs them. An unknown save is never reported as success.
 * - **Other backend failures** (aborts, backpressure, internal) → reads
 *   report `'unavailable'` with the Cana code in the reason (the backend
 *   could not serve the read; claiming `'lost'` would assert data loss we
 *   cannot know); writes report `'unknown'` with the code in the reason.
 *
 * ## The wire format is unchanged
 *
 * Records are stored in one object store (`designerDocuments`, outbound keys)
 * under the pinned Requirement 126 Contract 2 keys — `service-management.v1`
 * and `service-management.schema-baseline.v1` — and each value is the exact
 * `JSON.stringify` of the same document the retired localStorage adapter
 * wrote. JUM-484's migration was therefore a byte copy, not a transformation,
 * and a stored value that no longer parses reports `'lost'` exactly as the
 * retired adapter's corrupt-JSON path did.
 *
 * ## Client injection
 *
 * The Cana client is INJECTED (`client`) or lazily acquired
 * (`clientProvider`), never imported by this module — the same convention as
 * `buildDatabaseClientCompilers`'s `indexedDbClient` (packages/cana's
 * adapter): a module that imports the browser package cannot be loaded by
 * hosts that only serve static files or run server-side. With neither
 * supplied, every operation reports `'unavailable'` — selected-but-not-wired
 * is an honest terminal state, not a silent fallback.
 *
 * This module stays DOM-free and import-safe in any runtime (browser, Bun,
 * Node, jest): Cana errors are recognised by their `canaError: true` tag
 * rather than an imported guard, because the tag is the contract
 * (structured-clone-safe data, see packages/cana/src/contracts.ts).
 */

/** Database name for the designer's Cana database. */
export const CANA_DESIGNER_DATABASE_NAME = 'service-management';

/** Object store holding both documents, keyed by the pinned wire keys. */
export const CANA_DESIGNER_STORE_NAME = 'designerDocuments';

/**
 * Client options for the designer database, used by the default provider in
 * `designerStoreFactory.js`. Version 1; schema changes MUST bump `version`
 * (IndexedDB applies them only on version increase).
 */
export const CANA_DESIGNER_CLIENT_OPTIONS = Object.freeze({
  name: CANA_DESIGNER_DATABASE_NAME,
  schema: Object.freeze({
    version: 1,
    stores: Object.freeze([Object.freeze({ name: CANA_DESIGNER_STORE_NAME })])
  })
});

/** State document record key, pinned by Requirement 126 Contract 2. */
export const CANA_STATE_KEY = 'service-management.v1';
/** Schema-diff baseline record key, pinned by Requirement 126 Contract 2. */
export const CANA_BASELINE_KEY = 'service-management.schema-baseline.v1';

const NO_CLIENT_REASON = 'Cana storage is selected but no Cana client is wired into this host.';

/** Flatten any thrown value to a diagnostic string (mirrors the port's style). */
function errorReason(error) {
  return String((error && error.message) || error);
}

/**
 * Read the Cana error code off a rejected value. Duck-typed on the
 * `canaError: true` tag — the taxonomy is data, not classes, so this survives
 * the worker boundary and needs no import from the browser package.
 */
function canaCodeOf(error) {
  return error && error.canaError === true ? error.code : undefined;
}

/** Human diagnostic for a Cana (or foreign) failure, tagged with its code. */
function describeFailure(error) {
  const code = canaCodeOf(error);
  return code ? `cana ${code}: ${errorReason(error)}` : errorReason(error);
}

/** Reason for a write that could not confirm durability, distinctly tagged. */
function writeFailureReason(error) {
  const code = canaCodeOf(error);
  if (code === 'QuotaExceeded') return `quota: ${errorReason(error)}`;
  if (code === 'Evicted') return `evicted: ${errorReason(error)}`;
  if (code === 'Unavailable') return `unavailable: ${errorReason(error)}`;
  if (code === 'UnknownOutcome') return `unknown-outcome: ${errorReason(error)}`;
  return describeFailure(error);
}

const EVICTED_REASON = 'evicted: Cana detected that designer data stored previously is gone '
  + '(storage eviction or an external wipe). With no fallback store this is data loss, '
  + 'distinct from an empty first run.';

export class CanaDesignerStore extends IDesignerStore {
  /**
   * @param {Object} [options]
   * @param {Object} [options.client] - a Cana client (`open()`, `table()`,
   *   `transaction()`, `storageState()`), e.g. `createCanaDatabaseClient(...).cana`.
   * @param {Function} [options.clientProvider] - async factory used when no
   *   client is injected; called once per (re)connection attempt.
   * @param {string} [options.stateKey] - state document key override (tests).
   * @param {string} [options.baselineKey] - baseline document key override (tests).
   */
  constructor({
    client, clientProvider, stateKey, baselineKey
  } = {}) {
    super();
    this.client = client;
    this.clientProvider = clientProvider;
    this.stateKey = stateKey || CANA_STATE_KEY;
    this.baselineKey = baselineKey || CANA_BASELINE_KEY;
    this.storeName = CANA_DESIGNER_STORE_NAME;
    this.openPromise = undefined;
  }

  /**
   * Open the client, lazily and once. A failed attempt is NOT cached — the
   * next operation retries, because some open failures are transient
   * (`UpgradeBlocked` is retryable) and a cached failure would turn one bad
   * moment into a permanent outage with no fallback behind it.
   * @returns {Promise<{ok: true}|{ok: false, reason: string}>}
   */
  async ensureOpen() {
    if (!this.client && typeof this.clientProvider !== 'function') {
      return { ok: false, reason: NO_CLIENT_REASON };
    }
    if (!this.openPromise) {
      this.openPromise = (async () => {
        if (!this.client) this.client = await this.clientProvider();
        await this.client.open();
      })();
    }
    try {
      await this.openPromise;
      return { ok: true };
    } catch (error) {
      this.openPromise = undefined;
      return { ok: false, reason: describeFailure(error) };
    }
  }

  /** Raw durability state, or undefined when it cannot be read. */
  async storageStateSafe() {
    try {
      return await this.client.storageState();
    } catch (_) {
      return undefined;
    }
  }

  /** @returns {Promise<import('./IDesignerStore.js').DesignerStoreStatus>} */
  async probe() {
    const open = await this.ensureOpen();
    if (!open.ok) return { status: 'unavailable', reason: open.reason };
    const state = await this.storageStateSafe();
    if (state && state.evicted === true) {
      return { status: 'lost', reason: EVICTED_REASON };
    }
    if (state && state.nearQuota === true) {
      const usage = state.usageBytes !== undefined && state.quotaBytes !== undefined
        ? ` (${state.usageBytes}/${state.quotaBytes} bytes)`
        : '';
      return {
        status: 'available',
        reason: `quota: storage usage is near the origin quota${usage}; writes may start failing.`
      };
    }
    if (state && state.persistent === false) {
      return {
        status: 'available',
        reason: 'durability: storage is not persistent; the browser may reclaim it under pressure.'
      };
    }
    return { status: 'available' };
  }

  /** @returns {Promise<import('./IDesignerStore.js').DesignerStoreLoadResult>} */
  load() {
    return this.readKey(this.stateKey);
  }

  /** @returns {Promise<import('./IDesignerStore.js').DesignerStoreLoadResult>} */
  loadBaseline() {
    return this.readKey(this.baselineKey);
  }

  async readKey(key) {
    const open = await this.ensureOpen();
    if (!open.ok) {
      return { status: 'unavailable', payload: null, reason: open.reason };
    }
    let record;
    try {
      record = await this.client.table(this.storeName).get(key);
    } catch (error) {
      if (canaCodeOf(error) === 'Evicted') {
        return { status: 'lost', payload: null, reason: EVICTED_REASON };
      }
      return { status: 'unavailable', payload: null, reason: describeFailure(error) };
    }
    if (record === undefined || record === null) {
      // Absent record: only the eviction verdict separates a first run from a
      // wiped database — the two are indistinguishable by inspection.
      const state = await this.storageStateSafe();
      if (state && state.evicted === true) {
        return { status: 'lost', payload: null, reason: EVICTED_REASON };
      }
      return { status: 'empty', payload: null };
    }
    try {
      return { status: 'ok', payload: JSON.parse(record) };
    } catch (error) {
      return {
        status: 'lost',
        payload: null,
        reason: `Stored payload under "${key}" is not readable JSON: ${errorReason(error)}`
      };
    }
  }

  /**
   * `JSON.stringify` runs synchronously before the async path, so an
   * unserializable payload throws to the caller as a programmer error —
   * exactly the port's reserved synchronous throw.
   * @param {Object} payload
   * @returns {Promise<import('./IDesignerStore.js').DesignerStoreSaveResult>}
   */
  save(payload) {
    return this.writeKey(this.stateKey, JSON.stringify(payload));
  }

  /** @param {Object} snapshot @returns {Promise<import('./IDesignerStore.js').DesignerStoreSaveResult>} */
  saveBaseline(snapshot) {
    return this.writeKey(this.baselineKey, JSON.stringify(snapshot));
  }

  /**
   * Writes go through `client.transaction`, not the auto-commit table, so the
   * one outcome that needs reconciling (`'unknown'`) carries the
   * `correlationId`/`attemptedAt` handles `client.resolveWrite()` requires.
   */
  async writeKey(key, json) {
    const open = await this.ensureOpen();
    if (!open.ok) {
      return { status: 'unknown', reason: `unavailable: ${open.reason}` };
    }
    let tx;
    try {
      tx = await this.client.transaction(
        'readwrite',
        [this.storeName],
        (scope) => scope.table(this.storeName).put(json, key)
      );
    } catch (error) {
      return { status: 'unknown', reason: writeFailureReason(error) };
    }
    if (tx && tx.outcome === 'committed') {
      return { status: 'persisted' };
    }
    const handles = tx && tx.correlationId !== undefined
      ? ` (correlationId ${tx.correlationId}, attemptedAt ${tx.attemptedAt})`
      : '';
    return {
      status: 'unknown',
      reason: `unknown-outcome: the write was dispatched but its outcome is indeterminate${handles}; `
        + 'reconcile with client.resolveWrite() before retrying.'
    };
  }

  /** @returns {Promise<import('./IDesignerStore.js').DesignerStoreSaveResult>} */
  clear() {
    return this.deleteKey(this.stateKey);
  }

  /** @returns {Promise<import('./IDesignerStore.js').DesignerStoreSaveResult>} */
  clearBaseline() {
    return this.deleteKey(this.baselineKey);
  }

  async deleteKey(key) {
    const open = await this.ensureOpen();
    if (!open.ok) {
      return { status: 'unknown', reason: `unavailable: ${open.reason}` };
    }
    let tx;
    try {
      tx = await this.client.transaction(
        'readwrite',
        [this.storeName],
        (scope) => scope.table(this.storeName).delete(key)
      );
    } catch (error) {
      return { status: 'unknown', reason: writeFailureReason(error) };
    }
    if (tx && tx.outcome === 'committed') {
      return { status: 'persisted' };
    }
    const handles = tx && tx.correlationId !== undefined
      ? ` (correlationId ${tx.correlationId}, attemptedAt ${tx.attemptedAt})`
      : '';
    return {
      status: 'unknown',
      reason: `unknown-outcome: the delete was dispatched but its outcome is indeterminate${handles}.`
    };
  }
}
