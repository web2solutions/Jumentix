import { LocalStorageDesignerStore } from './LocalStorageDesignerStore.js';
import {
  CANA_DESIGNER_CLIENT_OPTIONS,
  CanaDesignerStore
} from './CanaDesignerStore.js';

/**
 * designerStoreFactory — the store selection seam (JUM-483).
 *
 * One place decides which `IDesignerStore` adapter the designer boots with,
 * following the same conventions as `buildDatabaseClientCompilers`
 * (`@jumentix/database-client-factory`) for every other Jumentix database
 * driver:
 *
 * - **Selection by name.** `'cana'` (aliases `'indexeddb'`, `'indexed-db'`,
 *   like the factory's driver normaliser) selects the Cana adapter;
 *   `'localstorage'` selects the transitional one.
 * - **The Cana client is injected, not imported.** `indexedDbClient` is a
 *   factory, exactly like the factory's option of the same name, so this
 *   module — loaded by the zero-build SPA and by server-side tests alike —
 *   never statically imports the browser-only package. When no factory is
 *   supplied, a default provider lazily `import()`s `@jumentix/cana` and
 *   builds the client through `createCanaDatabaseClient`, the same client
 *   contract the other drivers are registered through. A host that cannot
 *   resolve that import (the static-file SPA until JUM-484 wires a bundle)
 *   gets a store whose operations report `'unavailable'` — selected-but-not-
 *   wired is an explicit terminal state, never a silent fallback.
 * - **The DEFAULT stays `localstorage`.** Cana becomes the sole store only at
 *   JUM-484's migration. Until then, selecting Cana is an explicit act:
 *   the `driver` argument, the ambient `JUMENTIX_DESIGNER_STORE_DRIVER`
 *   global, or a `?designer-store=cana` URL parameter.
 *
 * This module is DOM-free and import-safe in any runtime: the ambient reads
 * are guarded, and the dynamic import executes only when the Cana driver was
 * actually selected and no client was injected.
 */

/** The driver the designer boots with until JUM-484's migration. */
export const DEFAULT_DESIGNER_STORE_DRIVER = 'localstorage';

/** Default module specifier the lazy Cana provider imports. */
export const CANA_MODULE_SPECIFIER = '@jumentix/cana';

/**
 * Normalise a driver name to `'localstorage'` | `'cana'`, or `undefined`
 * when the value names no known driver — callers decide the default.
 */
export function normalizeDesignerStoreDriver(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['cana', 'indexeddb', 'indexed-db'].includes(normalized)) return 'cana';
  if (['localstorage', 'local-storage', 'local_storage'].includes(normalized)) {
    return 'localstorage';
  }
  return undefined;
}

/**
 * Resolve the selected driver. Pure: every input is injected so the
 * precedence is testable without touching globals.
 *
 * Precedence: explicit `driver` → ambient global → URL parameter → default.
 * An unknown value at one level falls through to the next rather than being
 * honoured as a typo that silently lands on the default.
 *
 * @param {Object} [options]
 * @param {string} [options.driver] - explicit selection (wins over everything).
 * @param {string} [options.globalDriver] - ambient `JUMENTIX_DESIGNER_STORE_DRIVER`.
 * @param {string} [options.searchParam] - `designer-store` URL parameter value.
 */
export function resolveDesignerStoreDriver({ driver, globalDriver, searchParam } = {}) {
  return normalizeDesignerStoreDriver(driver)
    || normalizeDesignerStoreDriver(globalDriver)
    || normalizeDesignerStoreDriver(searchParam)
    || DEFAULT_DESIGNER_STORE_DRIVER;
}

/** Read the ambient selection inputs (browser globals), defensively. */
function ambientSelection(driver) {
  let globalDriver;
  let searchParam;
  try {
    globalDriver = typeof globalThis !== 'undefined'
      ? globalThis.JUMENTIX_DESIGNER_STORE_DRIVER
      : undefined;
  } catch (_) {
    globalDriver = undefined;
  }
  try {
    if (typeof location !== 'undefined' && typeof location.search === 'string') {
      searchParam = new URLSearchParams(location.search).get('designer-store') || undefined;
    }
  } catch (_) {
    searchParam = undefined;
  }
  return resolveDesignerStoreDriver({ driver, globalDriver, searchParam });
}

/**
 * Build the designer store for the selected driver.
 *
 * @param {Object} [options]
 * @param {string} [options.driver] - explicit driver selection.
 * @param {Object} [options.canaClient] - a ready Cana client (tests, hosts
 *   that already hold one).
 * @param {Function} [options.indexedDbClient] - factory returning a Cana
 *   client (or a `CanaDatabaseClient` — its `.cana` is used), mirroring the
 *   `indexedDbClient` injection of `buildDatabaseClientCompilers`.
 * @param {string} [options.canaModuleSpecifier] - module the default provider
 *   imports when neither client nor factory is supplied (tests).
 * @param {Storage} [options.storage] - backend override for the transitional
 *   adapter (tests).
 * @returns {import('./IDesignerStore.js').IDesignerStore}
 */
export function createDesignerStore({
  driver,
  canaClient,
  indexedDbClient,
  canaModuleSpecifier,
  storage
} = {}) {
  if (ambientSelection(driver) !== 'cana') {
    return new LocalStorageDesignerStore({ storage });
  }

  let client = canaClient;
  let clientProvider;
  if (!client && typeof indexedDbClient === 'function') {
    clientProvider = async () => {
      const built = await indexedDbClient();
      // A CanaDatabaseClient carries the real client on `.cana`; a bare Cana
      // client is used as-is. Both honour the same injected-factory contract.
      return built && built.cana ? built.cana : built;
    };
  }
  if (!client && !clientProvider) {
    const specifier = canaModuleSpecifier || CANA_MODULE_SPECIFIER;
    clientProvider = async () => {
      const cana = await import(specifier);
      return cana.createCanaDatabaseClient(CANA_DESIGNER_CLIENT_OPTIONS).cana;
    };
  }
  return new CanaDesignerStore({ client, clientProvider });
}
