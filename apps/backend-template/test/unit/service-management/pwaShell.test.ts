/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Unit suite for the PWA shell (JUM-489): the app-shell service worker
 * (`apps/service-management/sw.js`) and the page-side registration/update
 * flow (`apps/service-management/src/pwa/pwaShell.js`).
 *
 * Both modules are browser-targeted plain JavaScript; they are loaded here
 * with injectable fakes — no DOM shims, no jsdom — the same way the designer
 * store suites load theirs. The service worker is a CLASSIC script (no
 * module graph), so it exposes its logic through the `module.exports` guard
 * it documents; the page-side module is an ES module with every global
 * injected. Spies are hand-rolled so the suite runs identically under Jest
 * and under `bun test`.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const appRoot = path.join(repoRoot, 'apps', 'service-management');

const sw = require(path.join(appRoot, 'sw.js'));
const {
  PWA_SHELL_CACHE_PREFIX,
  SERVICE_WORKER_URL,
  SKIP_WAITING_MESSAGE_TYPE,
  UPDATE_BANNER_ID,
  clearShellCaches,
  promptForUpdate,
  registerPwaShell,
  resetPwaShell
} = require(path.join(appRoot, 'src', 'pwa', 'pwaShell.js'));

type Spy = {
  (...args: unknown[]): unknown;
  calls: unknown[][];
};

const restoreGlobalProperty = (name: string, previous: PropertyDescriptor | undefined): void => {
  if (previous) {
    Object.defineProperty(globalThis, name, previous);
    return;
  }

  delete (globalThis as Record<string, unknown>)[name];
};

function createSpy(impl?: (...args: unknown[]) => unknown): Spy {
  const spy = ((...args: unknown[]) => {
    spy.calls.push(args);
    return impl ? impl(...args) : undefined;
  }) as Spy;
  spy.calls = [];
  return spy;
}

type FakeElement = {
  id: string;
  className: string;
  textContent: string;
  type: string;
  dataset: Record<string, string>;
  children: FakeElement[];
  parentNode: FakeElement | null;
  listeners: Record<string, Array<() => void>>;
  setAttribute: (name: string, value: string) => void;
  addEventListener: (type: string, handler: () => void) => void;
  appendChild: (child: FakeElement) => void;
  removeChild: (child: FakeElement) => void;
  click: () => void;
};

function createFakeElement(): FakeElement {
  const element: FakeElement = {
    id: '',
    className: '',
    textContent: '',
    type: '',
    dataset: {},
    children: [],
    parentNode: null,
    listeners: {},
    setAttribute: () => undefined,
    addEventListener: (type: string, handler: () => void) => {
      const list = element.listeners[type] || [];
      list.push(handler);
      element.listeners[type] = list;
    },
    appendChild: (child: FakeElement) => {
      Object.assign(child, { parentNode: element });
      element.children.push(child);
    },
    removeChild: (child: FakeElement) => {
      const index = element.children.indexOf(child);
      if (index >= 0) element.children.splice(index, 1);
      Object.assign(child, { parentNode: null });
    },
    click: () => {
      (element.listeners.click || []).forEach((handler) => handler());
    }
  };
  return element;
}

function textOf(element: FakeElement | null): string {
  if (!element) return '';
  return [element.textContent, ...element.children.map((child) => textOf(child))].join(' ');
}

function createFakeDocument() {
  const body = createFakeElement();
  const findById = (element: FakeElement, id: string): FakeElement | null => {
    if (element.id === id) return element;
    return element.children.reduce<FakeElement | null>(
      (found, child) => found || findById(child, id),
      null
    );
  };
  return {
    body,
    createElement: () => createFakeElement(),
    getElementById: (id: string) => findById(body, id)
  };
}

function bannerActions(banner: FakeElement): Map<string, FakeElement> {
  const row = banner.children.find((child) => child.className === 'pwa-update-banner-actions');
  const actions = row ? row.children : [];
  return new Map(actions.map((action) => [action.dataset.pwaAction, action]));
}

function createFakeContainer(overrides: Record<string, unknown> = {}) {
  const listeners = new Map<string, Array<() => void>>();
  return {
    controller: null as object | null,
    register: createSpy(),
    getRegistrations: createSpy(async () => []),
    addEventListener: (type: string, handler: () => void) => {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    fire: (type: string) => {
      (listeners.get(type) || []).forEach((handler) => handler());
    },
    ...overrides
  };
}

function createFakeInstallingWorker() {
  const listeners = new Map<string, Array<() => void>>();
  const worker = {
    state: 'installing',
    addEventListener: (type: string, handler: () => void) => {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    setState: (state: string) => {
      worker.state = state;
      (listeners.get('statechange') || []).forEach((handler) => handler());
    }
  };
  return worker;
}

function createFakeRegistration(overrides: Record<string, unknown> = {}) {
  const listeners = new Map<string, Array<() => void>>();
  return {
    waiting: null as null | { postMessage: Spy },
    installing: null as null | ReturnType<typeof createFakeInstallingWorker>,
    unregister: createSpy(async () => true),
    addEventListener: (type: string, handler: () => void) => {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    fire: (type: string) => {
      (listeners.get(type) || []).forEach((handler) => handler());
    },
    ...overrides
  };
}

function createFakeCacheStorage(initial: Record<string, string[]> = {}) {
  const stores = new Map<string, Map<string, unknown>>();
  Object.entries(initial).forEach(([name, urls]) => {
    stores.set(name, new Map(urls.map((url) => [url, `cached:${url}`])));
  });
  return {
    open: createSpy(async (name: unknown) => {
      const key = String(name);
      if (!stores.has(key)) stores.set(key, new Map());
      const store = stores.get(key) as Map<string, unknown>;
      return {
        addAll: createSpy(async (urls: unknown) => {
          (urls as string[]).forEach((url) => store.set(url, `cached:${url}`));
        })
      };
    }),
    keys: createSpy(async () => [...stores.keys()]),
    delete: createSpy(async (name: unknown) => stores.delete(String(name))),
    match: createSpy(async (request: unknown) => {
      const { url } = (request as { url: string });
      let hit: unknown;
      stores.forEach((store) => {
        const found = store.get(url);
        if (found !== undefined && hit === undefined) hit = found;
      });
      return hit;
    }),
    _stores: stores
  };
}

// Generated (gitignored) shell assets: they exist only after the vendor syncs
// run (ci-cd/sync-service-management-cana-bundle.js, JUM-484;
// ci-cd/sync-service-management-designer-core.js, JUM-493), so the on-disk
// check below covers the committed files and the browser smoke covers these
// dynamically against the real server. Everything under ./vendor/ is
// generated by definition.
const isGeneratedShellAsset = (asset: string): boolean => asset.startsWith('./vendor/');

function committedShellAssets(assets: string[]): string[] {
  return assets.filter((asset) => asset !== './' && !isGeneratedShellAsset(asset));
}

/**
 * Every module reachable from `entry`, as paths relative to the static root.
 *
 * Follows relative imports and the import map's `@jumentix/designer-core/`
 * prefix, resolved the way the browser resolves it: into the vendored copy the
 * shell actually serves. Lives outside the suite because the walk is loops and
 * branches, which the test lint rules keep out of a test body — and because
 * what the test asserts is the result, not the traversal.
 */
const DESIGNER_CORE_PREFIX = '@jumentix/designer-core/';

function resolveSpecifier(specifier: string, fromFile: string, root: string): string | null {
  if (specifier.startsWith(DESIGNER_CORE_PREFIX)) {
    return `vendor/designer-core/${specifier.slice(DESIGNER_CORE_PREFIX.length)}`;
  }
  if (!specifier.startsWith('.')) return null;
  const absolute = path.resolve(path.dirname(path.resolve(root, fromFile)), specifier);
  return path.relative(root, absolute);
}

function modulesReachableFrom(entry: string): string[] {
  const staticRoot = path.resolve(repoRoot, 'apps/service-management');
  const importPattern = /from '([^']+)'/g;
  const seen = new Set<string>();
  const queue = [entry];
  const reachable: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const absolute = path.resolve(staticRoot, current);
    const unvisited = !seen.has(current) && fs.existsSync(absolute);
    seen.add(current);

    if (unvisited) {
      reachable.push(current);
      const source = fs.readFileSync(absolute, 'utf8');
      Array.from(source.matchAll(importPattern))
        .map((match) => resolveSpecifier(match[1], current, staticRoot))
        .filter((target): target is string => target !== null)
        .forEach((target) => queue.push(target));
    }
  }

  return reachable;
}

describe('pwa shell service worker (JUM-489)', () => {
  it('derives the cache name from a versioned prefix shared with the page side', () => {
    expect.hasAssertions();
    expect(sw.SHELL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(sw.SHELL_CACHE_NAME).toBe(`${sw.SHELL_CACHE_PREFIX}${sw.SHELL_VERSION}`);
    expect(sw.SHELL_CACHE_PREFIX).toBe(PWA_SHELL_CACHE_PREFIX);
  });

  /*
   * Every module the shell can reach must be precached (JUM-747).
   *
   * The list in `sw.js` is hand-maintained, and the check below spot-checks a
   * couple of entries. That is not the same requirement: what breaks offline
   * is any module in the graph that is missing, and the symptom is not a
   * missing file — it is an app that loads, paints its header and wires
   * nothing, because one failed import takes the whole module graph with it.
   *
   * It has happened twice: `src/state/designerSync.js` (recorded in `sw.js` as
   * a pre-existing gap) and `model/propertyKeys.js`, whose absence left the
   * offline shell with dead tabs and no error anyone would connect to it. So
   * the graph is walked rather than listed.
   */
  it('precaches every module reachable from the entry point', () => {
    expect.hasAssertions();

    const reachable = modulesReachableFrom('script.js');

    // The walk found the graph, not just the entry point.
    expect(reachable.length).toBeGreaterThan(10);
    expect(reachable.filter((file) => !sw.SHELL_ASSETS.includes(`./${file}`))).toStrictEqual([]);
  });

  it('precaches a shell that exists on disk and includes every boot-critical asset', () => {
    expect.hasAssertions();
    expect(sw.SHELL_ASSETS.length).toBeGreaterThan(10);
    sw.SHELL_ASSETS.forEach((asset: string) => {
      expect(asset.startsWith('./')).toBe(true);
    });
    [
      './index.html',
      './styles.css',
      './script.js',
      './manifest.webmanifest',
      './src/pwa/pwaShell.js',
      './icons/icon.svg',
      './icons/icon-192.png',
      './icons/icon-512.png',
      './icons/icon-maskable-512.png',
      './icons/apple-touch-icon.png'
    ].forEach((required) => {
      expect(sw.SHELL_ASSETS).toContain(required);
    });
    // The static half of the JUM-463 agreement: every committed precached
    // entry must be a real file under the static root. Generated assets (the
    // vendored Cana bundle, JUM-484; the vendored designer-core tree,
    // JUM-493) are pinned dynamically by the browser smoke, which requests
    // EVERY entry against the real server.
    expect(sw.SHELL_ASSETS).toContain('./vendor/cana/index.js');
    // The whole designer core crosses the import map at boot: the precache
    // must carry the vendored tree, or the offline shell cannot resolve the
    // module graph.
    expect(sw.SHELL_ASSETS).toContain('./vendor/designer-core/state/designerState.js');
    expect(sw.SHELL_ASSETS).toContain('./vendor/designer-core/model/modelQueries.js');
    expect(sw.SHELL_ASSETS).toContain('./vendor/designer-core/store/IDesignerStore.js');
    committedShellAssets(sw.SHELL_ASSETS as string[]).forEach((asset: string) => {
      const filePath = path.join(appRoot, asset.replace('./', ''));
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  it('treats only same-origin non-API URLs as shell', () => {
    expect.hasAssertions();
    expect(sw.isShellUrl(new URL('http://127.0.0.1:3200/script.js'), 'http://127.0.0.1:3200')).toBe(true);
    expect(sw.isShellUrl(new URL('http://127.0.0.1:3200/'), 'http://127.0.0.1:3200')).toBe(true);
    expect(sw.isShellUrl(new URL('http://127.0.0.1:3200/api/runtime/env'), 'http://127.0.0.1:3200')).toBe(false);
    expect(sw.isShellUrl(new URL('https://fonts.example.com/x.woff2'), 'http://127.0.0.1:3200')).toBe(false);
  });

  it('installs by precaching every shell asset into the versioned cache', async () => {
    expect.hasAssertions();
    const cacheStorage = createFakeCacheStorage();
    await sw.handleInstall({ cacheStorage });
    expect(cacheStorage.open.calls).toStrictEqual([[sw.SHELL_CACHE_NAME]]);
    const store = cacheStorage._stores.get(sw.SHELL_CACHE_NAME);
    expect(store).toBeDefined();
    const populated = store as Map<string, unknown>;
    sw.SHELL_ASSETS.forEach((asset: string) => {
      expect(populated.has(asset)).toBe(true);
    });
  });

  it('cleans stale shell caches on activation and claims clients', async () => {
    expect.hasAssertions();
    const cacheStorage = createFakeCacheStorage({
      'service-management-shell@0.0.1': ['./'],
      [sw.SHELL_CACHE_NAME]: ['./'],
      'unrelated-cache': ['./']
    });
    const claim = createSpy(async () => undefined);
    await sw.handleActivate({ cacheStorage, workerClients: { claim } });
    const remaining = await cacheStorage.keys();
    expect(remaining).not.toContain('service-management-shell@0.0.1');
    expect(remaining).toContain(sw.SHELL_CACHE_NAME);
    expect(remaining).toContain('unrelated-cache');
    expect(claim.calls).toHaveLength(1);
  });

  it('serves static precached shell requests from the cache without touching the network', async () => {
    expect.hasAssertions();
    const cacheStorage = createFakeCacheStorage({
      [sw.SHELL_CACHE_NAME]: ['http://127.0.0.1:3200/icons/icon.svg']
    });
    const fetchImpl = createSpy();
    const response = await sw.handleFetchRequest({
      request: { method: 'GET', url: 'http://127.0.0.1:3200/icons/icon.svg' },
      cacheStorage,
      fetchImpl,
      scopeOrigin: 'http://127.0.0.1:3200'
    });
    expect(response).toBe('cached:http://127.0.0.1:3200/icons/icon.svg');
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('falls back to the network on a cache miss', async () => {
    expect.hasAssertions();
    const cacheStorage = createFakeCacheStorage({ [sw.SHELL_CACHE_NAME]: [] });
    const fetchImpl = createSpy(async () => 'network-response');
    const response = await sw.handleFetchRequest({
      request: { method: 'GET', url: 'http://127.0.0.1:3200/script.js' },
      cacheStorage,
      fetchImpl,
      scopeOrigin: 'http://127.0.0.1:3200'
    });
    expect(response).toBe('network-response');
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it('fetches versioned shell assets from the network first for dev hot reload', async () => {
    expect.hasAssertions();
    const cacheStorage = createFakeCacheStorage({
      [sw.SHELL_CACHE_NAME]: ['http://127.0.0.1:3200/styles.css']
    });
    const fetchImpl = createSpy(async () => 'network-versioned-css');
    const response = await sw.handleFetchRequest({
      request: { method: 'GET', url: 'http://127.0.0.1:3200/styles.css?v=0.9.11' },
      cacheStorage,
      fetchImpl,
      scopeOrigin: 'http://127.0.0.1:3200'
    });
    expect(response).toBe('network-versioned-css');
    expect(fetchImpl.calls).toHaveLength(1);
    expect(cacheStorage.match.calls).toHaveLength(0);
  });

  it('fetches unversioned JS module graph assets from the network first for dev hot reload', async () => {
    expect.hasAssertions();
    const cacheStorage = createFakeCacheStorage({
      [sw.SHELL_CACHE_NAME]: ['http://127.0.0.1:3200/src/ui/canvas.js']
    });
    const fetchImpl = createSpy(async () => 'network-canvas-module');
    const response = await sw.handleFetchRequest({
      request: { method: 'GET', url: 'http://127.0.0.1:3200/src/ui/canvas.js' },
      cacheStorage,
      fetchImpl,
      scopeOrigin: 'http://127.0.0.1:3200'
    });
    expect(response).toBe('network-canvas-module');
    expect(fetchImpl.calls).toHaveLength(1);
    expect(cacheStorage.match.calls).toHaveLength(0);
  });

  it('answers shell fetch failures without leaking uncaught promise errors', async () => {
    expect.hasAssertions();
    const cacheStorage = createFakeCacheStorage({ [sw.SHELL_CACHE_NAME]: [] });
    const fetchImpl = createSpy(async () => {
      throw new TypeError('Failed to fetch');
    });
    const response = await sw.handleFetchRequest({
      request: { method: 'GET', url: 'http://127.0.0.1:3200/styles.css?v=0.9.11' },
      cacheStorage,
      fetchImpl,
      scopeOrigin: 'http://127.0.0.1:3200'
    });
    expect(response.status).toBe(503);
    expect(response.statusText).toBe('Service Unavailable');
    expect(fetchImpl.calls).toHaveLength(1);
    expect(cacheStorage.match.calls).toHaveLength(1);
  });

  it('never serves API, non-GET or cross-origin requests from the cache', async () => {
    expect.hasAssertions();
    const cacheStorage = createFakeCacheStorage({
      [sw.SHELL_CACHE_NAME]: ['http://127.0.0.1:3200/api/runtime/env']
    });
    const fetchImpl = createSpy(async () => 'network-response');

    const api = await sw.handleFetchRequest({
      request: { method: 'GET', url: 'http://127.0.0.1:3200/api/runtime/env' },
      cacheStorage,
      fetchImpl,
      scopeOrigin: 'http://127.0.0.1:3200'
    });
    expect(api).toBe('network-response');
    expect(cacheStorage.match.calls).toHaveLength(0);

    await sw.handleFetchRequest({
      request: { method: 'POST', url: 'http://127.0.0.1:3200/api/runtime/env' },
      cacheStorage,
      fetchImpl,
      scopeOrigin: 'http://127.0.0.1:3200'
    });
    await sw.handleFetchRequest({
      request: { method: 'GET', url: 'https://other.example/script.js' },
      cacheStorage,
      fetchImpl,
      scopeOrigin: 'http://127.0.0.1:3200'
    });
    expect(fetchImpl.calls).toHaveLength(3);
  });

  it('answers non-shell fetch failures without rejecting respondWith', async () => {
    expect.hasAssertions();
    const cacheStorage = createFakeCacheStorage({});
    const fetchImpl = createSpy(async () => {
      throw new TypeError('Failed to fetch');
    });

    const response = await sw.handleFetchRequest({
      request: { method: 'GET', url: 'http://127.0.0.1:3200/api/runtime/env' },
      cacheStorage,
      fetchImpl,
      scopeOrigin: 'http://127.0.0.1:3200'
    });

    expect(response.status).toBe(503);
    expect(fetchImpl.calls).toHaveLength(1);
    expect(cacheStorage.match.calls).toHaveLength(0);
  });

  it('activates on demand only through an explicit SKIP_WAITING message', () => {
    expect.hasAssertions();
    const skipWaiting = createSpy(async () => undefined);
    sw.handleMessage({ data: { type: SKIP_WAITING_MESSAGE_TYPE }, skipWaiting });
    expect(skipWaiting.calls).toHaveLength(1);

    const otherSkipWaiting = createSpy();
    sw.handleMessage({ data: { type: 'SOMETHING_ELSE' }, skipWaiting: otherSkipWaiting });
    sw.handleMessage({ data: undefined, skipWaiting: otherSkipWaiting });
    expect(otherSkipWaiting.calls).toHaveLength(0);
  });

  it('wires install, activate, fetch and message listeners onto the worker global', async () => {
    expect.hasAssertions();
    type WorkerEventHandler = (event: never) => void;
    const handlers = new Map<string, WorkerEventHandler>();
    const waitUntil = createSpy();
    const respondWith = createSpy();
    const cacheStorage = createFakeCacheStorage();
    const workerGlobal = {
      caches: cacheStorage,
      clients: { claim: createSpy(async () => undefined) },
      registration: { scope: 'http://127.0.0.1:3200/' },
      fetch: createSpy(async () => 'network-response'),
      skipWaiting: createSpy(async () => undefined),
      addEventListener: (type: string, handler: (event: never) => void) => {
        handlers.set(type, handler);
      }
    };
    sw.registerWithWorkerGlobal(workerGlobal);
    expect([...handlers.keys()].sort()).toStrictEqual(['activate', 'fetch', 'install', 'message']);

    const install = handlers.get('install') as (event: { waitUntil: Spy }) => void;
    install({ waitUntil });
    expect(waitUntil.calls).toHaveLength(1);
    await waitUntil.calls[0][0];

    const activate = handlers.get('activate') as (event: { waitUntil: Spy }) => void;
    activate({ waitUntil });
    expect(waitUntil.calls).toHaveLength(2);
    await waitUntil.calls[1][0];

    const fetchHandler = handlers.get('fetch') as (event: {
      request: { method: string; url: string };
      respondWith: Spy;
    }) => void;
    fetchHandler({
      request: { method: 'GET', url: 'http://127.0.0.1:3200/script.js' },
      respondWith
    });
    expect(respondWith.calls).toHaveLength(1);
    await respondWith.calls[0][0];
    expect(workerGlobal.fetch.calls).toHaveLength(1);

    const message = handlers.get('message') as (event: { data: unknown }) => void;
    message({ data: { type: SKIP_WAITING_MESSAGE_TYPE } });
    expect(workerGlobal.skipWaiting.calls).toHaveLength(1);
  });
});

describe('pwa shell registration and update flow (JUM-489)', () => {
  it('reports unsupported when no service worker container exists', async () => {
    expect.hasAssertions();
    const result = await registerPwaShell({
      serviceWorkerContainer: undefined,
      cacheStorage: undefined,
      documentRef: undefined,
      locationRef: undefined
    });
    expect(result).toStrictEqual({ status: 'unsupported' });
  });

  it('resolves default deps from the (absent) globals when called bare', async () => {
    expect.hasAssertions();
    // Under Node/Bun there is no navigator.serviceWorker: the bare call takes
    // every guarded-default branch and lands on the unsupported outcome.
    const result = await registerPwaShell();
    expect(result).toStrictEqual({ status: 'unsupported' });
  });

  it('resolves browser globals when no explicit deps are injected', async () => {
    expect.hasAssertions();
    const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const documentRef = createFakeDocument();
    const registration = createFakeRegistration();
    const container = createFakeContainer();
    container.register = createSpy(async () => registration);
    const cacheStorage = createFakeCacheStorage();
    const locationRef = { reload: createSpy() };
    try {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { serviceWorker: container }
      });
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { caches: cacheStorage, location: locationRef }
      });
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: documentRef
      });

      const result = await registerPwaShell();

      expect(result.status).toBe('registered');
      expect(container.register.calls).toStrictEqual([[SERVICE_WORKER_URL]]);
    } finally {
      restoreGlobalProperty('navigator', previousNavigator);
      restoreGlobalProperty('window', previousWindow);
      restoreGlobalProperty('document', previousDocument);
    }
  });

  it('honours a custom worker URL and ignores updatefound without an installing worker', async () => {
    expect.hasAssertions();
    const documentRef = createFakeDocument();
    const registration = createFakeRegistration();
    const container = createFakeContainer({ controller: {} });
    container.register = createSpy(async () => registration);

    await registerPwaShell({
      serviceWorkerContainer: container,
      cacheStorage: createFakeCacheStorage(),
      documentRef,
      locationRef: { reload: createSpy() },
      serviceWorkerUrl: './custom-sw.js'
    });
    expect(container.register.calls).toStrictEqual([['./custom-sw.js']]);

    registration.fire('updatefound');
    expect(documentRef.getElementById(UPDATE_BANNER_ID)).toBeNull();
  });

  it('clearShellCaches with no cache storage is a no-op', async () => {
    expect.hasAssertions();
    const removed = await clearShellCaches(undefined);
    expect(removed).toStrictEqual([]);
  });

  it('reports a non-Error registration failure with its string form', async () => {
    expect.hasAssertions();
    const documentRef = createFakeDocument();
    const container = createFakeContainer();
    container.register = createSpy(async () => {
      // eslint-disable-next-line no-throw-literal
      throw 'plain string failure';
    });

    const result = await registerPwaShell({
      serviceWorkerContainer: container,
      cacheStorage: createFakeCacheStorage(),
      documentRef,
      locationRef: { reload: createSpy() }
    });
    expect(result.status).toBe('failed');
    expect(textOf(documentRef.getElementById(UPDATE_BANNER_ID))).toContain('plain string failure');
  });

  it('registers the classic worker script relative to the app root', async () => {
    expect.hasAssertions();
    const documentRef = createFakeDocument();
    const registration = createFakeRegistration();
    const container = createFakeContainer();
    container.register = createSpy(async () => registration);

    const result = await registerPwaShell({
      serviceWorkerContainer: container,
      cacheStorage: createFakeCacheStorage(),
      documentRef,
      locationRef: { reload: createSpy() }
    });

    expect(container.register.calls).toStrictEqual([['./sw.js']]);
    expect(result.status).toBe('registered');
    // First install: no controller yet, so no update prompt.
    expect(documentRef.getElementById(UPDATE_BANNER_ID)).toBeNull();
  });

  it('prompts when an update is already waiting on a controlled page', async () => {
    expect.hasAssertions();
    const documentRef = createFakeDocument();
    const waiting = { postMessage: createSpy() };
    const registration = createFakeRegistration({ waiting });
    const container = createFakeContainer({ controller: {} });
    container.register = createSpy(async () => registration);

    await registerPwaShell({
      serviceWorkerContainer: container,
      cacheStorage: createFakeCacheStorage(),
      documentRef,
      locationRef: { reload: createSpy() }
    });

    const banner = documentRef.getElementById(UPDATE_BANNER_ID);
    expect(banner).not.toBeNull();
    expect(textOf(banner)).toContain('new version');
    // No silent swap: nothing was posted to the waiting worker.
    expect(waiting.postMessage.calls).toHaveLength(0);
  });

  it('prompts when an update installs while the page is controlled, but not on first install', async () => {
    expect.hasAssertions();
    const documentRef = createFakeDocument();
    const installing = createFakeInstallingWorker();
    const registration = createFakeRegistration();
    const container = createFakeContainer({ controller: {} });
    container.register = createSpy(async () => registration);

    await registerPwaShell({
      serviceWorkerContainer: container,
      cacheStorage: createFakeCacheStorage(),
      documentRef,
      locationRef: { reload: createSpy() }
    });
    expect(documentRef.getElementById(UPDATE_BANNER_ID)).toBeNull();

    registration.installing = installing;
    registration.fire('updatefound');
    installing.setState('installed');
    expect(documentRef.getElementById(UPDATE_BANNER_ID)).not.toBeNull();

    // Same sequence with no controller (first install): no prompt.
    const firstRunDocument = createFakeDocument();
    const firstRunInstalling = createFakeInstallingWorker();
    const firstRunRegistration = createFakeRegistration();
    const firstRunContainer = createFakeContainer();
    firstRunContainer.register = createSpy(async () => firstRunRegistration);
    await registerPwaShell({
      serviceWorkerContainer: firstRunContainer,
      cacheStorage: createFakeCacheStorage(),
      documentRef: firstRunDocument,
      locationRef: { reload: createSpy() }
    });
    firstRunRegistration.installing = firstRunInstalling;
    firstRunRegistration.fire('updatefound');
    firstRunInstalling.setState('installed');
    expect(firstRunDocument.getElementById(UPDATE_BANNER_ID)).toBeNull();
  });

  it('sends SKIP_WAITING and reloads on controllerchange only after the user accepts', () => {
    expect.hasAssertions();
    const documentRef = createFakeDocument();
    const locationRef = { reload: createSpy() };
    const waiting = { postMessage: createSpy() };
    const registration = createFakeRegistration({ waiting });
    const container = createFakeContainer({ controller: {} });
    const deps = {
      serviceWorkerContainer: container,
      cacheStorage: createFakeCacheStorage(),
      documentRef,
      locationRef
    };

    const banner = promptForUpdate(deps, registration) as unknown as FakeElement;

    // A controllerchange before acceptance must not reload.
    container.fire('controllerchange');
    expect(locationRef.reload.calls).toHaveLength(0);

    (bannerActions(banner).get('reload') as FakeElement).click();
    expect(waiting.postMessage.calls).toStrictEqual([[{ type: SKIP_WAITING_MESSAGE_TYPE }]]);

    container.fire('controllerchange');
    expect(locationRef.reload.calls).toHaveLength(1);
  });

  it('does nothing when reload is clicked but no worker is waiting', () => {
    expect.hasAssertions();
    const documentRef = createFakeDocument();
    const locationRef = { reload: createSpy() };
    const registration = createFakeRegistration({ waiting: null });
    const container = createFakeContainer({ controller: {} });
    const banner = promptForUpdate(
      {
        serviceWorkerContainer: container,
        cacheStorage: createFakeCacheStorage(),
        documentRef,
        locationRef
      },
      registration
    ) as unknown as FakeElement;
    (bannerActions(banner).get('reload') as FakeElement).click();
    container.fire('controllerchange');
    expect(locationRef.reload.calls).toHaveLength(0);
  });

  it('dismisses the banner on Later without touching the waiting worker', () => {
    expect.hasAssertions();
    const documentRef = createFakeDocument();
    const waiting = { postMessage: createSpy() };
    const registration = createFakeRegistration({ waiting });
    const container = createFakeContainer({ controller: {} });
    const banner = promptForUpdate(
      {
        serviceWorkerContainer: container,
        cacheStorage: createFakeCacheStorage(),
        documentRef,
        locationRef: { reload: createSpy() }
      },
      registration
    ) as unknown as FakeElement;
    (bannerActions(banner).get('later') as FakeElement).click();
    expect(documentRef.getElementById(UPDATE_BANNER_ID)).toBeNull();
    expect(waiting.postMessage.calls).toHaveLength(0);
  });

  it('resets the shell: unregister, delete shell caches only, reload', async () => {
    expect.hasAssertions();
    const unregister = createSpy(async () => true);
    const container = createFakeContainer();
    container.getRegistrations = createSpy(async () => [{ unregister }]);
    const cacheStorage = createFakeCacheStorage({
      [`${PWA_SHELL_CACHE_PREFIX}0.1.0`]: ['./'],
      'cana-database': ['designer-state']
    });
    const locationRef = { reload: createSpy() };

    const removed = await clearShellCaches(cacheStorage);
    expect(removed).toStrictEqual([`${PWA_SHELL_CACHE_PREFIX}0.1.0`]);
    await expect(cacheStorage.keys()).resolves.toStrictEqual(['cana-database']);

    await resetPwaShell({
      serviceWorkerContainer: container,
      cacheStorage,
      locationRef
    });
    expect(unregister.calls).toHaveLength(1);
    expect(locationRef.reload.calls).toHaveLength(1);
  });

  it('reset tolerates a missing container and a missing location', async () => {
    expect.hasAssertions();
    const cacheStorage = createFakeCacheStorage({
      [`${PWA_SHELL_CACHE_PREFIX}0.1.0`]: ['./']
    });
    await resetPwaShell({
      serviceWorkerContainer: undefined,
      cacheStorage,
      locationRef: undefined
    });
    await expect(cacheStorage.keys()).resolves.toStrictEqual([]);
  });

  it('reset action on the update banner unregisters, clears shell caches and reloads', async () => {
    expect.hasAssertions();
    const documentRef = createFakeDocument();
    const unregister = createSpy(async () => true);
    const container = createFakeContainer({ controller: {} });
    container.getRegistrations = createSpy(async () => [{ unregister }]);
    const cacheStorage = createFakeCacheStorage({
      [`${PWA_SHELL_CACHE_PREFIX}0.1.0`]: ['./'],
      'cana-database': ['designer-state']
    });
    const locationRef = { reload: createSpy() };
    const registration = createFakeRegistration({ waiting: { postMessage: createSpy() } });

    const banner = promptForUpdate(
      {
        serviceWorkerContainer: container,
        cacheStorage,
        documentRef,
        locationRef
      },
      registration
    ) as unknown as FakeElement;
    (bannerActions(banner).get('reset') as FakeElement).click();
    // The reset runs async; let it settle before asserting.
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    expect(unregister.calls).toHaveLength(1);
    await expect(cacheStorage.keys()).resolves.toStrictEqual(['cana-database']);
    expect(locationRef.reload.calls).toHaveLength(1);
  });

  it('a failed reset on the update banner ends on the error banner, never silently', async () => {
    expect.hasAssertions();
    const documentRef = createFakeDocument();
    const container = createFakeContainer({ controller: {} });
    container.getRegistrations = createSpy(async () => {
      throw new Error('unregister blew up');
    });
    const registration = createFakeRegistration({ waiting: { postMessage: createSpy() } });

    const banner = promptForUpdate(
      {
        serviceWorkerContainer: container,
        cacheStorage: createFakeCacheStorage(),
        documentRef,
        locationRef: { reload: createSpy() }
      },
      registration
    ) as unknown as FakeElement;
    (bannerActions(banner).get('reset') as FakeElement).click();
    await new Promise((resolve) => { setTimeout(resolve, 0); });

    const errorBanner = documentRef.getElementById(UPDATE_BANNER_ID);
    expect(errorBanner).not.toBeNull();
    expect(textOf(errorBanner)).toContain('Could not reset the app shell');
  });

  it('reset action on the error banner retries the reset, and re-reports a failure', async () => {
    expect.hasAssertions();
    const documentRef = createFakeDocument();
    const container = createFakeContainer();
    container.register = createSpy(async () => {
      throw new Error('script load failed');
    });
    container.getRegistrations = createSpy(async () => [
      { unregister: createSpy(async () => true) }
    ]);
    const cacheStorage = createFakeCacheStorage({ [`${PWA_SHELL_CACHE_PREFIX}0.1.0`]: ['./'] });
    const locationRef = { reload: createSpy() };

    await registerPwaShell({
      serviceWorkerContainer: container,
      cacheStorage,
      documentRef,
      locationRef
    });
    const errorBanner = documentRef.getElementById(UPDATE_BANNER_ID) as FakeElement;
    (bannerActions(errorBanner).get('reset') as FakeElement).click();
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    expect(locationRef.reload.calls).toHaveLength(1);
    await expect(cacheStorage.keys()).resolves.toStrictEqual([]);

    // Second failure: the error banner reappears with the failure message.
    locationRef.reload.calls = [];
    container.register = createSpy(async () => {
      throw new Error('script load failed again');
    });
    container.getRegistrations = createSpy(async () => {
      throw new Error('still broken');
    });
    await registerPwaShell({
      serviceWorkerContainer: container,
      cacheStorage,
      documentRef,
      locationRef
    });
    const retryBanner = documentRef.getElementById(UPDATE_BANNER_ID) as FakeElement;
    (bannerActions(retryBanner).get('reset') as FakeElement).click();
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    expect(textOf(documentRef.getElementById(UPDATE_BANNER_ID))).toContain('Could not reset');
    expect(locationRef.reload.calls).toHaveLength(0);
  });

  it('dismisses the error banner without resetting', async () => {
    expect.hasAssertions();
    const documentRef = createFakeDocument();
    const container = createFakeContainer();
    container.register = createSpy(async () => {
      throw new Error('script load failed');
    });

    await registerPwaShell({
      serviceWorkerContainer: container,
      cacheStorage: createFakeCacheStorage(),
      documentRef,
      locationRef: { reload: createSpy() }
    });
    const banner = documentRef.getElementById(UPDATE_BANNER_ID) as FakeElement;
    (bannerActions(banner).get('later') as FakeElement).click();
    expect(documentRef.getElementById(UPDATE_BANNER_ID)).toBeNull();
  });

  it('surfaces a registration failure on the recovery banner instead of vanishing', async () => {
    expect.hasAssertions();
    const documentRef = createFakeDocument();
    const container = createFakeContainer();
    container.register = createSpy(async () => {
      throw new Error('script load failed');
    });

    const result = await registerPwaShell({
      serviceWorkerContainer: container,
      cacheStorage: createFakeCacheStorage(),
      documentRef,
      locationRef: { reload: createSpy() }
    });

    expect(result.status).toBe('failed');
    const banner = documentRef.getElementById(UPDATE_BANNER_ID);
    expect(banner).not.toBeNull();
    expect(textOf(banner)).toContain('offline shell failed to install');
    expect(textOf(banner)).toContain('Reset app shell');
  });
});

describe('pwa shell ambient dependencies (JUM-681)', () => {
  it('resolves its dependencies from the ambient globals when given none', async () => {
    expect.hasAssertions();

    // The banner's "Reset app shell" action calls this with what it has; the
    // page calls it with nothing. Under a runtime with no service worker, no
    // caches and no location — which is every non-browser host, including the
    // build — every dependency resolves to `undefined` and the reset has to be
    // a no-op rather than a crash on `undefined.getRegistrations()`.
    await expect(resetPwaShell(undefined as never)).resolves.toBeUndefined();
  });
});
