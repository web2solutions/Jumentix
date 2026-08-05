import { IDesignerStore } from './IDesignerStore.js';

/**
 * LocalStorageDesignerStore — TRANSITIONAL `IDesignerStore` adapter over
 * `window.localStorage` (JUM-468).
 *
 * This adapter exists only to carry the designer from H2 until JUM-484's
 * one-way migration of `service-management.v1` moves the state to Cana, and
 * JUM-484 RETIRES it. It is not a permanent second adapter and not a
 * fallback: Cana has no fallback to localStorage (decision 2026-07-29), so
 * nothing new may depend on this class being present.
 *
 * The port is shaped around Cana's semantics; this adapter stretches to fit:
 * - localStorage is synchronous, so every method performs its work before
 *   returning an already-resolved Promise. Errors thrown by `setItem`/
 *   `removeItem` (quota, blocked storage) still propagate synchronously to
 *   the caller, exactly as the pre-extraction direct `localStorage` access
 *   behaved.
 * - `'lost'` is reported when a stored payload exists but is not valid JSON
 *   (the only corruption localStorage can express); true eviction has no
 *   localStorage analogue and is never reported by this adapter.
 * - `'unknown'` is never reported: a `setItem` that returns is durable by
 *   the HTML storage contract, and one that throws propagates.
 *
 * The wire format — key names and JSON payload shapes — is pinned by
 * Requirement 126 Contract 2 and MUST NOT change here; the schema belongs to
 * JUM-484's migration to change.
 */

/** State document key, pinned by Requirement 126 Contract 2. */
export const LOCAL_STORAGE_STATE_KEY = 'service-management.v1';
/** Schema-diff baseline key, pinned by Requirement 126 Contract 2. */
export const LOCAL_STORAGE_BASELINE_KEY = 'service-management.schema-baseline.v1';

const UNAVAILABLE_REASON = 'localStorage is not accessible in this browsing context.';

function errorReason(error) {
  return String((error && error.message) || error);
}

/**
 * Resolve the ambient localStorage without assuming a DOM: the module must
 * import and run under Bun/Node with no DOM shim, so the global is looked up
 * lazily and defensively (property access itself can throw when storage is
 * blocked).
 */
function resolveDefaultStorage() {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined;
  } catch (_) {
    return undefined;
  }
}

export class LocalStorageDesignerStore extends IDesignerStore {
  /**
   * @param {Object} [options]
   * @param {Storage} [options.storage] - storage backend; defaults to the
   * ambient `globalThis.localStorage`. Injected in tests.
   * @param {string} [options.stateKey] - state document key override (tests).
   * @param {string} [options.baselineKey] - baseline document key override (tests).
   */
  constructor({ storage, stateKey, baselineKey } = {}) {
    super();
    this.storage = storage !== undefined ? storage : resolveDefaultStorage();
    this.stateKey = stateKey || LOCAL_STORAGE_STATE_KEY;
    this.baselineKey = baselineKey || LOCAL_STORAGE_BASELINE_KEY;
  }

  /** @returns {Promise<import('./IDesignerStore.js').DesignerStoreStatus>} */
  probe() {
    if (!this.storage) return Promise.resolve({ status: 'unavailable', reason: UNAVAILABLE_REASON });
    try {
      const probeKey = `${this.stateKey}.probe`;
      this.storage.setItem(probeKey, '1');
      this.storage.removeItem(probeKey);
      return Promise.resolve({ status: 'available' });
    } catch (error) {
      return Promise.resolve({ status: 'unavailable', reason: errorReason(error) });
    }
  }

  /** @returns {Promise<import('./IDesignerStore.js').DesignerStoreLoadResult>} */
  load() {
    return this.readKey(this.stateKey);
  }

  /** @returns {Promise<import('./IDesignerStore.js').DesignerStoreLoadResult>} */
  loadBaseline() {
    return this.readKey(this.baselineKey);
  }

  readKey(key) {
    if (!this.storage) {
      return Promise.resolve({ status: 'unavailable', payload: null, reason: UNAVAILABLE_REASON });
    }
    let raw;
    try {
      raw = this.storage.getItem(key);
    } catch (error) {
      return Promise.resolve({ status: 'unavailable', payload: null, reason: errorReason(error) });
    }
    if (raw === null || raw === undefined) {
      return Promise.resolve({ status: 'empty', payload: null });
    }
    try {
      return Promise.resolve({ status: 'ok', payload: JSON.parse(raw) });
    } catch (error) {
      return Promise.resolve({
        status: 'lost',
        payload: null,
        reason: `Stored payload under "${key}" is not readable JSON: ${errorReason(error)}`
      });
    }
  }

  /**
   * The `setItem` runs synchronously before the resolved Promise is returned,
   * preserving the pre-extraction durability behaviour for callers that do
   * not await (the whole designer today). A throwing `setItem` propagates
   * synchronously, as it did before.
   * @param {Object} payload
   * @returns {Promise<import('./IDesignerStore.js').DesignerStoreSaveResult>}
   */
  save(payload) {
    this.storage.setItem(this.stateKey, JSON.stringify(payload));
    return Promise.resolve({ status: 'persisted' });
  }

  /** @param {Object} snapshot @returns {Promise<import('./IDesignerStore.js').DesignerStoreSaveResult>} */
  saveBaseline(snapshot) {
    this.storage.setItem(this.baselineKey, JSON.stringify(snapshot));
    return Promise.resolve({ status: 'persisted' });
  }

  /** @returns {Promise<import('./IDesignerStore.js').DesignerStoreSaveResult>} */
  clear() {
    this.storage.removeItem(this.stateKey);
    return Promise.resolve({ status: 'persisted' });
  }

  /** @returns {Promise<import('./IDesignerStore.js').DesignerStoreSaveResult>} */
  clearBaseline() {
    this.storage.removeItem(this.baselineKey);
    return Promise.resolve({ status: 'persisted' });
  }
}
