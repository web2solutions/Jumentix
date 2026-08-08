/**
 * IDesignerStore — the storage port of the Service Management designer (JUM-468).
 *
 * This module is the contract, not an implementation. It is DOM-free and
 * dependency-free so the designer core, every store adapter and every test can
 * import it under any JavaScript runtime (browser, Bun, Node) without a DOM.
 *
 * ## Why the port is shaped around Cana, not localStorage
 *
 * `LocalStorageDesignerStore` is TRANSITIONAL: it carries the designer only
 * until JUM-484's one-way migration of `service-management.v1` retires it.
 * Cana has NO fallback to localStorage — no fallback at all (decision
 * 2026-07-29). The port is therefore shaped around the semantics Cana (an
 * offline database behind a postmaster/worker boundary) produces, and the
 * localStorage adapter stretches to fit. H3 (JUM-483) implements
 * `CanaDesignerStore` against this exact contract without touching designer
 * logic.
 *
 * ## Contract
 *
 * 1. **Every operation is async.** Cana routes through a postmaster and
 *    workers; every operation crosses a boundary. All methods return Promises.
 *    Adapters over synchronous backends (localStorage) perform their work
 *    synchronously and return already-resolved Promises — callers MUST NOT
 *    rely on that and MUST treat every result as asynchronous.
 *
 * 2. **`load()` distinguishes four outcomes** (see `@typedef LoadResult`):
 *    - `'ok'` — a stored document was found and decoded.
 *    - `'empty'` — nothing is stored. This is the first-run state, NOT an
 *      error, and NOT data loss.
 *    - `'unavailable'` — the storage backend itself cannot be used (private
 *      mode, missing IndexedDB). Under the no-fallback rule this is a
 *      terminal state the designer must surface, not silently route around.
 *    - `'lost'` — storage was available and held data that is no longer
 *      readable (eviction, corruption). Eviction has no localStorage
 *      analogue; with nothing behind Cana this is data loss and MUST be
 *      distinguishable from `'empty'`.
 *
 * 3. **`save()` guarantees durability or says it cannot** (see
 *    `@typedef SaveResult`):
 *    - `'persisted'` — the write is durable: any subsequent `load()` against
 *      the same backend returns this payload (until the next `save()`).
 *    - `'unknown'` — the outcome is indeterminate (e.g. a worker crashed
 *      after the write was dispatched). An unknown outcome MUST NOT be
 *      reported to the user as success.
 *    Adapters MAY throw synchronously for programmer errors (unserializable
 *    payload); backend failures are reported through the result, never as
 *    `'persisted'`.
 *
 * 4. **`probe()` lets the designer ask about storage health at startup**
 *    before any state exists (see `@typedef StoreStatus`). It answers
 *    `'available'`, `'unavailable'` or `'lost'` without requiring a prior
 *    `load()` — private mode and browsers without usable IndexedDB become
 *    detectable terminal states under the no-fallback rule.
 *
 * 5. **The schema-diff baseline is part of the same backend.** The baseline
 *    document (`service-management.schema-baseline.v1` under the transitional
 *    adapter) crosses the same storage boundary, so the port carries it:
 *    `loadBaseline()`, `saveBaseline()`, `clearBaseline()` follow the same
 *    result semantics as their state counterparts.
 *
 * 6. **`clear()`/`clearBaseline()`** resolve `'persisted'` when the document
 *    is gone for good — a subsequent `load()` reports `'empty'`.
 *
 * The payload shape crossing `save()`/`load()` is the `service-management.v1`
 * document pinned by Requirement 126 Contract 2 (twelve top-level sections:
 * `domains`, `relationships`, `selectedDomainId`, `selectedEntityId`,
 * `selectedRelationshipId`, `idCounter`, `activeTab`, `interfaces`,
 * `serviceConfiguration`, `runtimeEnvironment`, `deployments`, `view`). The
 * port itself is schema-agnostic; the pinned wire format belongs to the
 * transitional adapter and to JUM-484's migration.
 *
 * This contract is documented externally by JUM-473.
 */

/**
 * @typedef {Object} DesignerStoreLoadResult
 * @property {'ok'|'empty'|'unavailable'|'lost'} status
 * @property {?Object} payload - decoded document when status is `'ok'`, otherwise null.
 * @property {string} [reason] - human-readable diagnostic for `'unavailable'`/`'lost'`.
 */

/**
 * @typedef {Object} DesignerStoreSaveResult
 * @property {'persisted'|'unknown'} status
 * @property {string} [reason] - human-readable diagnostic for `'unknown'`.
 */

/**
 * @typedef {Object} DesignerStoreStatus
 * @property {'available'|'unavailable'|'lost'} status
 * @property {string} [reason] - human-readable diagnostic for non-available states.
 */

/**
 * Storage port interface. Adapters MUST subclass and override every method;
 * the base implementations throw so a partial adapter fails loudly instead of
 * silently dropping designer state.
 */
export class IDesignerStore {
  /**
   * Ask about storage health at startup, before any state exists.
   * @returns {Promise<DesignerStoreStatus>}
   */
  async probe() {
    throw new Error('IDesignerStore.probe() must be implemented by the adapter.');
  }

  /**
   * Read the persisted designer state document.
   * @returns {Promise<DesignerStoreLoadResult>} `'ok'` with payload, `'empty'`
   * when nothing is stored, `'unavailable'` when the backend cannot be used,
   * `'lost'` when stored data is gone or unreadable.
   */
  async load() {
    throw new Error('IDesignerStore.load() must be implemented by the adapter.');
  }

  /**
   * Persist the full designer state document.
   * @param {Object} payload - serializable `service-management.v1` document.
   * @returns {Promise<DesignerStoreSaveResult>} `'persisted'` only when the
   * write is durable; `'unknown'` when the outcome is indeterminate.
   */
  async save(payload) {
    throw new Error('IDesignerStore.save() must be implemented by the adapter.');
  }

  /**
   * Remove the persisted designer state document.
   * @returns {Promise<DesignerStoreSaveResult>} `'persisted'` when a
   * subsequent `load()` is guaranteed to report `'empty'`.
   */
  async clear() {
    throw new Error('IDesignerStore.clear() must be implemented by the adapter.');
  }

  /**
   * Read the schema-diff baseline document.
   * @returns {Promise<DesignerStoreLoadResult>} same semantics as `load()`.
   */
  async loadBaseline() {
    throw new Error('IDesignerStore.loadBaseline() must be implemented by the adapter.');
  }

  /**
   * Persist the schema-diff baseline document.
   * @param {Object} snapshot - `{ domains, relationships }` baseline shape
   * pinned by Requirement 126 Contract 2.
   * @returns {Promise<DesignerStoreSaveResult>} same semantics as `save()`.
   */
  async saveBaseline(snapshot) {
    throw new Error('IDesignerStore.saveBaseline() must be implemented by the adapter.');
  }

  /**
   * Remove the schema-diff baseline document.
   * @returns {Promise<DesignerStoreSaveResult>} same semantics as `clear()`.
   */
  async clearBaseline() {
    throw new Error('IDesignerStore.clearBaseline() must be implemented by the adapter.');
  }
}
