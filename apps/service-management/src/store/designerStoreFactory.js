import {
  CANA_DESIGNER_CLIENT_OPTIONS,
  CanaDesignerStore
} from './CanaDesignerStore.js';

/**
 * designerStoreFactory — the store construction seam (JUM-483), now the
 * single-store factory (JUM-484).
 *
 * Cana is the SOLE designer store. JUM-484's one-way migration of
 * `service-management.v1` retired the transitional `LocalStorageDesignerStore`
 * and removed every runtime path to localStorage — there is no driver
 * selection left: no `driver` argument, no `JUMENTIX_DESIGNER_STORE_DRIVER`
 * global, no `?designer-store=` URL parameter can route the designer away
 * from Cana (decision 2026-07-29: no fallback, no fallback at all). The seam
 * that remains is CLIENT INJECTION, exactly like
 * `buildDatabaseClientCompilers` (`@jumentix/database-client-factory`):
 *
 * - **The Cana client is injected, not imported.** `indexedDbClient` is a
 *   factory, exactly like the factory's option of the same name, so this
 *   module — loaded by the zero-build SPA and by server-side tests alike —
 *   never statically imports the browser-only package. When no factory is
 *   supplied, a default provider lazily `import()`s `@jumentix/cana` and
 *   builds the client through `createCanaDatabaseClient`, the same client
 *   contract the other drivers are registered through. In the browser that
 *   specifier resolves through the import map in `index.html` to the
 *   vendored bundle (`vendor/cana/index.js`, synced from `packages/cana`'s
 *   ESM dist by `ci-cd/sync-service-management-cana-bundle.js`). A host that
 *   cannot resolve the import gets a store whose operations report
 *   `'unavailable'` — wired-but-unresolvable is an explicit terminal state
 *   the boot surfaces, never a silent fallback.
 *
 * This module is DOM-free and import-safe in any runtime: the dynamic import
 * executes only when no client was injected and an operation actually needs
 * one.
 */

/** Default module specifier the lazy Cana provider imports. */
export const CANA_MODULE_SPECIFIER = '@jumentix/cana';

/**
 * Build the designer store — always the Cana adapter; the Cana client is the
 * only variable.
 *
 * @param {Object} [options]
 * @param {Object} [options.canaClient] - a ready Cana client (tests, hosts
 *   that already hold one).
 * @param {Function} [options.indexedDbClient] - factory returning a Cana
 *   client (or a `CanaDatabaseClient` — its `.cana` is used), mirroring the
 *   `indexedDbClient` injection of `buildDatabaseClientCompilers`.
 * @param {string} [options.canaModuleSpecifier] - module the default provider
 *   imports when neither client nor factory is supplied (tests).
 * @returns {import('@jumentix/designer-core/store/IDesignerStore.js').IDesignerStore}
 */
export function createDesignerStore({
  canaClient,
  indexedDbClient,
  canaModuleSpecifier
} = {}) {
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
