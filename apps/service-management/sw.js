/*
 * sw.js — the app-shell service worker of the Service Management designer
 * (JUM-489). Classic script, not a module: `navigator.serviceWorker.register`
 * cannot load `type: "module"` workers on the whole supported browser matrix,
 * and the zero-build SPA has no bundler to flatten imports anyway.
 *
 * ## What this worker caches — and what it must never cache
 *
 * It caches the SHELL ONLY: HTML, CSS, the JS module graph, the web app
 * manifest and icons. Application data is NEVER cached here. Persistence is
 * Cana's domain (JUM-483/484, no fallback to anything); a convenience copy in
 * the Cache API would reintroduce a fallback by the back door with weaker
 * guarantees than the store it shadows. `/api/` responses pass straight to the
 * network, untouched.
 *
 * ## The update strategy is the substance, not an afterthought
 *
 * A cache-first service worker is a cache with no expiry that the user cannot
 * see. Without an update path, the first version a user loads would pin them
 * forever — every reload would be served from that cache and fixed bugs would
 * keep being reported. The strategy here:
 *
 * 1. VERSIONED CACHE NAME. `SHELL_VERSION` is bumped on every shell change,
 *    producing a new cache name, so a shipped update never mutates the cache
 *    the running version serves from.
 * 2. DEFINED ACTIVATION + CLEANUP. `activate` deletes every other cache with
 *    the shell prefix (stale versions) and claims clients.
 * 3. NO SILENT SWAP. This worker NEVER calls `skipWaiting()` on its own. The
 *    designer holds unsaved editor state; swapping code under an active edit
 *    session is worse than asking. The new worker waits until the page-side
 *    flow (src/pwa/pwaShell.js) shows the user-visible "new version available"
 *    prompt and the user accepts — only then does the page post
 *    `{type: 'SKIP_WAITING'}`, the worker activates, and the page reloads on
 *    `controllerchange`.
 * 4. RECOVERY. The page-side module also exposes a reset action (unregister +
 *    delete shell caches + reload) so a broken shell can be recovered without
 *    the user knowing what a service worker is.
 *
 * ## Serving requirements
 *
 * Served by `apps/service-management/server.js` as
 * `application/javascript; charset=utf-8` from the static root, so the worker
 * scope is the app root. JUM-463 alignment: every entry of `SHELL_ASSETS`
 * must be a file the server's static manifest serves — the integration smoke
 * (`pwaShell.browser.integration.test.ts`) requests each entry against the
 * real server and fails when the two disagree about what the shell is.
 *
 * `module.exports` exists for Node-side unit tests only; the worker global
 * branch is what runs in the browser. Keep both paths in sync.
 */

/* eslint-env serviceworker, node */

const SHELL_VERSION = '0.4.0';

// Prefix shared with src/pwa/pwaShell.js (the page-side reset deletes by
// prefix). The two copies cannot import each other — a classic worker has no
// module graph — so the unit suite pins them equal.
const SHELL_CACHE_PREFIX = 'service-management-shell@';
const SHELL_CACHE_NAME = `${SHELL_CACHE_PREFIX}${SHELL_VERSION}`;

// The complete shell: what the designer needs to boot with the network
// disabled. Relative to the worker scope (the app root).
const SHELL_ASSETS = [
  './',
  './index.html',
  // Design-system token layer (JUM-488): styles.css is token-driven, so the
  // offline shell is incomplete without the vendored --jtx-* properties.
  './tokens.css',
  './styles.css',
  './script.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './src/codegen/hexagonalCodegen.js',
  './src/exporters/asyncApiExporters.js',
  './src/exporters/designerExporters.js',
  './src/importers/designerImporters.js',
  './src/model/deployCapabilityMatrix.js',
  './src/model/modelQueries.js',
  './src/model/rbacContract.js',
  // Eagerly imported by the importer/exporter chain (JUM-492); without it
  // the offline shell could not resolve the module graph.
  './src/packages/packageVersioning.js',
  // Eagerly imported by script.js (JUM-548 first-run sample loader); without
  // it the offline shell could not resolve the module graph.
  './src/model/sampleModel.js',
  './src/pwa/pwaShell.js',
  './src/state/designerState.js',
  // Eagerly imported by script.js (JUM-485); without it the offline shell
  // could not resolve the module graph (pre-existing precache gap).
  './src/state/designerSync.js',
  './src/store/CanaDesignerStore.js',
  './src/store/canaMigration.js',
  './src/store/designerStoreFactory.js',
  './src/store/IDesignerStore.js',
  './src/ui/canvas.js',
  './src/ui/inspectors.js',
  './src/ui/tabs.js',
  './src/validation/asyncApi30Validation.js',
  './src/validation/deployTargetLifecycleValidation.js',
  './src/validation/deployTargetValidation.js',
  './src/validation/modelValidation.js',
  './src/validation/serviceConfigurationValidation.js',
  // The vendored Cana browser bundle (JUM-484) — the designer's sole store
  // crosses the import map to this module at boot, so the offline shell is
  // incomplete without it. GENERATED (gitignored): produced by
  // ci-cd/sync-service-management-cana-bundle.js, which the browser smoke
  // runs before booting the server; the smoke also requests every precached
  // entry against the real server, generated ones included.
  './vendor/cana/index.js'
];

const SKIP_WAITING_MESSAGE_TYPE = 'SKIP_WAITING';

/**
 * True when a request URL belongs to the shell this worker serves. Everything
 * under `/api/` is runtime data (runtime env, PM2 ecosystem) — network only,
 * never cached, never answered offline; cross-origin is not ours to answer.
 */
function isShellUrl(url, scopeOrigin) {
  if (url.origin !== scopeOrigin) return false;
  return !url.pathname.startsWith('/api/');
}

/**
 * Precaches the whole shell. A single missing asset rejects the install — a
 * precache list that disagrees with the server must fail loudly at install
 * time, not silently degrade the offline shell.
 */
function handleInstall({ cacheStorage }) {
  return cacheStorage
    .open(SHELL_CACHE_NAME)
    .then((cache) => cache.addAll(SHELL_ASSETS));
}

/**
 * Deletes every stale shell cache (any version other than the current one),
 * then claims clients so the freshly activated worker serves existing pages —
 * which is what lets the page-side flow reload straight onto the new shell
 * after the user accepts an update.
 */
function handleActivate({ cacheStorage, workerClients }) {
  return cacheStorage
    .keys()
    .then((names) => Promise.all(
      names
        .filter((name) => name.startsWith(SHELL_CACHE_PREFIX) && name !== SHELL_CACHE_NAME)
        .map((name) => cacheStorage.delete(name))
    ))
    .then(() => workerClients.claim());
}

/**
 * Cache-first for the precached shell: a cache hit never touches the network.
 * The versioned cache name makes this safe — the running shell is internally
 * consistent, and a shipped update arrives through the prompt flow, never by
 * silently mixing versions. Misses and non-shell requests go to the network
 * unchanged (offline, they fail naturally — the shell owns no data to serve).
 */
function handleFetchRequest({ request, cacheStorage, fetchImpl, scopeOrigin }) {
  if (request.method !== 'GET' || !isShellUrl(new URL(request.url), scopeOrigin)) {
    return fetchImpl(request);
  }
  return cacheStorage
    .match(request, { ignoreSearch: true })
    .then((cached) => cached || fetchImpl(request));
}

/** The ONLY path to activation on demand: an explicit page-side message. */
function handleMessage({ data, skipWaiting }) {
  if (data && data.type === SKIP_WAITING_MESSAGE_TYPE) {
    return skipWaiting();
  }
  return undefined;
}

function registerWithWorkerGlobal(workerGlobal) {
  workerGlobal.addEventListener('install', (event) => {
    event.waitUntil(handleInstall({ cacheStorage: workerGlobal.caches }));
  });
  workerGlobal.addEventListener('activate', (event) => {
    event.waitUntil(handleActivate({
      cacheStorage: workerGlobal.caches,
      workerClients: workerGlobal.clients
    }));
  });
  workerGlobal.addEventListener('fetch', (event) => {
    event.respondWith(handleFetchRequest({
      request: event.request,
      cacheStorage: workerGlobal.caches,
      fetchImpl: (request) => workerGlobal.fetch(request),
      scopeOrigin: new URL(workerGlobal.registration.scope).origin
    }));
  });
  workerGlobal.addEventListener('message', (event) => {
    handleMessage({ data: event.data, skipWaiting: () => workerGlobal.skipWaiting() });
  });
}

const pwaShellServiceWorker = {
  SHELL_VERSION,
  SHELL_CACHE_PREFIX,
  SHELL_CACHE_NAME,
  SHELL_ASSETS,
  SKIP_WAITING_MESSAGE_TYPE,
  isShellUrl,
  handleInstall,
  handleActivate,
  handleFetchRequest,
  handleMessage,
  registerWithWorkerGlobal
};

if (typeof module !== 'undefined' && module.exports) {
  // Node/Bun unit-test path: export the logic, register no listeners.
  module.exports = pwaShellServiceWorker;
} else {
  registerWithWorkerGlobal(self);
}
