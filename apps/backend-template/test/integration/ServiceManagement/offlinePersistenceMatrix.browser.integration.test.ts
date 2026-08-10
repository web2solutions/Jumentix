/* eslint-disable @typescript-eslint/no-var-requires, no-await-in-loop */
/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test, jest/max-expects */
/*
 * JUM-486 — the offline/online persistence matrix for the designer on Cana,
 * run in a REAL browser (Playwright WebKit, the engine this repository pins)
 * against the REAL server and the REAL vendored Cana bundle. No DOM shims, no
 * store fakes (Requirement 115). Multi-tab convergence is deliberately NOT
 * here: it belongs to JUM-485's write-event suite, not to this
 * persistence-focused matrix.
 *
 * What is real in each cell, and where the one declared seam is:
 *
 *  - Persistence-works cells boot the real designer, edit through the real UI,
 *    and read WebKit's genuine IndexedDB. "Offline" is a KILLED SERVER (the
 *    network genuinely unreachable, the shell served by the real service
 *    worker) — never Playwright's setOffline, which breaks WebKit navigations
 *    and would test the emulator rather than the designer (JUM-489's lesson).
 *    The server restarts on the SAME port so the origin — and with it the
 *    IndexedDB database — survives the offline period.
 *  - Environment cells (private/blocked storage, missing IndexedDB) override
 *    exactly one ambient browser capability through an init script
 *    (`indexedDB.open` failing, `indexedDB` absent). Everything downstream —
 *    the real engine, the real adapter, the real boot, the real status
 *    region — is genuine.
 *  - The worker-crash, quota-pressure and quota-rejected-write cells use the
 *    ONE declared seam: a Playwright route serves a wrapper around the
 *    vendored bundle that re-exports the real module unchanged and only makes
 *    `transaction()` and `storageState()` on the returned client scriptable
 *    via `window.__canaTestFaults` (scripted storage state merges over the
 *    real observation). The failures it raises carry the real
 *    `canaError: true` data contract (the taxonomy is data, see
 *    packages/cana/src/contracts.ts), and the assertions run the REAL
 *    `CanaDesignerStore` module (imported from the server's own
 *    static root) against WebKit's genuine IndexedDB.
 *  - The eviction cell is entirely genuine: the database is really deleted
 *    between sessions while Cana's localStorage tombstone survives — the
 *    exact signal JUM-560's eviction detection is built on. The distinguishing
 *    assertion (evicted is never presented as a first run) is proven against a
 *    genuinely fresh context in the same test.
 *
 * Pins (from the issue's acceptance criteria):
 *  - No test asserts a fallback path; none exists (decision 2026-07-29).
 *  - Eviction is distinguished from first run, proven by test.
 *  - An unknown save outcome is never reported as success.
 *  - Unusable-storage environments produce their declared state before the
 *    user invests work.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { webkit } from 'playwright-webkit';
import type { Browser, BrowserContext, Page } from 'playwright-webkit';
import {
  createTempConfigDir,
  cleanupTempConfigDir,
  envFileContent,
  startServer,
  staticRoot,
  stopServer,
  waitForServer
} from './serverHarness';
import type { StartedServer } from './serverHarness';

const repoRoot = path.resolve(__dirname, '../../../../..');
const serviceWorker = require(path.join(staticRoot, 'sw.js'));

const SHELL_CACHE_NAME = serviceWorker.SHELL_CACHE_NAME as string;
const VENDORED_BUNDLE_PATH = path.join(staticRoot, 'vendor', 'cana', 'index.js');

// Requirement 126 Contract 2 pinned keys.
const STATE_KEY = 'service-management.v1';
const MARKER_KEY = 'service-management.v1.cana-migration';
const TOMBSTONE_KEY = 'cana.existed.v1:service-management';
const SHELL_CACHE_PREFIX = serviceWorker.SHELL_CACHE_PREFIX as string;

const LEGACY_PAYLOAD = {
  domains: [
    {
      id: 'domain-1',
      name: 'MigratedDomain',
      color: '#93c5fd',
      entities: [
        {
          id: 'entity-1',
          name: 'MigratedEntity',
          meta: { aggregateRoot: true, invariants: [], contracts: [] },
          fields: [
            {
              name: 'id', type: 'uuid', required: true, pk: true, fk: false, unique: true, nullable: false
            }
          ]
        }
      ]
    }
  ],
  relationships: [],
  selectedDomainId: 'domain-1',
  selectedEntityId: null,
  selectedRelationshipId: null,
  idCounter: 2,
  activeTab: 'domain-designer',
  interfaces: [],
  serviceConfiguration: { serviceKind: 'rest-api' },
  runtimeEnvironment: { environment: 'dev', fileName: '.env.dev', values: {} },
  deployments: [],
  view: { zoom: 1 }
};

/*
 * The fault-seam wrapper served in place of the vendored bundle for the crash
 * and quota-write cells. It re-exports the REAL module and wraps only the
 * returned client's `transaction` behind `window.__canaTestFaults`, so the
 * engine, schema, tombstones and durability probes below stay genuine. Local
 * exports shadow the star re-export per the module spec, so the designer and
 * the in-page assertions both receive the wrapped factory.
 */
const FAULT_SEAM_WRAPPER_SOURCE = `
import { createCanaDatabaseClient as realCreateCanaDatabaseClient } from './index.fault-seam-original.js';
export * from './index.fault-seam-original.js';

export function createCanaDatabaseClient(options) {
  const database = realCreateCanaDatabaseClient(options);
  const real = database.cana;
  const faulted = {
    name: real.name,
    version: real.version,
    open: (...args) => real.open(...args),
    close: (...args) => real.close(...args),
    table: (...args) => real.table(...args),
    // Scripted storage state merges over the real observation: the quota cell
    // pins nearQuota deterministically instead of depending on the host's
    // StorageManager semantics (which differ across WebKit builds), while the
    // eviction flag and everything else stays genuine.
    storageState: async (...args) => {
      const realState = await real.storageState(...args);
      const faults = window.__canaTestFaults || {};
      return faults.storageState ? { ...realState, ...faults.storageState } : realState;
    },
    subscribe: (...args) => real.subscribe(...args),
    resolveWrite: (...args) => real.resolveWrite(...args),
    durabilityAssessment: (...args) => real.durabilityAssessment(...args),
    exportAll: (...args) => real.exportAll(...args),
    transaction: async (mode, stores, body) => {
      const faults = window.__canaTestFaults || {};
      if (faults.writeError !== undefined) throw faults.writeError;
      if (faults.transactionOutcome === 'unknown') {
        // A write dispatched into a worker that died before confirming: the
        // outcome is indeterminate, and the handles client.resolveWrite()
        // would need are carried exactly as the real engine carries them.
        return {
          outcome: 'unknown',
          result: undefined,
          events: [],
          correlationId: 'cana-crash-sim:1',
          attemptedAt: Date.now()
        };
      }
      return real.transaction(mode, stores, body);
    }
  };
  return { ...database, cana: faulted };
}
`;

/**
 * The offline/recovery cells need the server back on the SAME port after the
 * kill, because IndexedDB (and localStorage, and the service worker
 * registration) are per-origin. That pin is the harness's `pinnedPort` mode:
 * no retry to a different port — a busy pinned port fails fast with a clear
 * error (JUM-628), since moving the origin would silently void the cell.
 */
function startPinnedServer(configDir: string, port: number): Promise<StartedServer> {
  return startServer(configDir, {}, { pinnedPort: port });
}

/** A browser context whose vendored Cana bundle carries the fault seam. */
async function newFaultSeamContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext();
  const vendoredBundle = fs.readFileSync(VENDORED_BUNDLE_PATH, 'utf8');
  await context.route('**/vendor/cana/index.fault-seam-original.js', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: vendoredBundle
  }));
  await context.route('**/vendor/cana/index.js', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: FAULT_SEAM_WRAPPER_SOURCE
  }));
  return context;
}

/** Read the verbatim `service-management.v1` record out of the REAL IndexedDB. */
function readCanaStateRecord() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('service-management');
    request.onsuccess = () => {
      const db = request.result;
      try {
        const tx = db.transaction('designerDocuments', 'readonly');
        const getRequest = tx.objectStore('designerDocuments').get('service-management.v1');
        getRequest.onsuccess = () => resolve(getRequest.result ?? null);
        getRequest.onerror = () => reject(getRequest.error);
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

type StoreResultRead = { status: string; payload?: unknown; reason?: string };

type CrashClassification = {
  committed: StoreResultRead;
  committedLoad: StoreResultRead;
  quotaRejected: StoreResultRead;
  quotaLoad: StoreResultRead;
  unknownOutcome: StoreResultRead;
  unknownLoad: StoreResultRead;
};

async function canaStateRecord(page: Page): Promise<string | null> {
  return page.evaluate(readCanaStateRecord) as Promise<string | null>;
}

/** Boot settled AND the first-run save durable in the real IndexedDB. */
async function waitForHealthyBoot(page: Page) {
  await page.waitForSelector('#tab-domain-designer-btn', { timeout: 15000 });
  await page.waitForFunction(
    () => new Promise((resolve) => {
      const request = indexedDB.open('service-management');
      request.onsuccess = () => {
        try {
          const tx = request.result.transaction('designerDocuments', 'readonly');
          const getRequest = tx.objectStore('designerDocuments').get('service-management.v1');
          getRequest.onsuccess = () => resolve(typeof getRequest.result === 'string');
          getRequest.onerror = () => resolve(false);
        } catch (_) {
          resolve(false);
        }
      };
      request.onerror = () => resolve(false);
    }),
    undefined,
    { polling: 250, timeout: 15000 }
  );
}

/** Add a domain through the real UI and wait until the write is durable. */
async function addDomainThroughUi(page: Page, name: string) {
  await page.fill('#domain-name-input', name);
  await page.click('#add-domain-btn');
  await page.waitForFunction(
    (domainName) => new Promise((resolve) => {
      const request = indexedDB.open('service-management');
      request.onsuccess = () => {
        try {
          const tx = request.result.transaction('designerDocuments', 'readonly');
          const getRequest = tx.objectStore('designerDocuments').get('service-management.v1');
          getRequest.onsuccess = () => resolve(
            typeof getRequest.result === 'string' && getRequest.result.includes(`"name":"${domainName}"`)
          );
          getRequest.onerror = () => resolve(false);
        } catch (_) {
          resolve(false);
        }
      };
      request.onerror = () => resolve(false);
    }),
    name,
    { polling: 250, timeout: 15000 }
  );
}

async function waitForDomainRendered(page: Page, name: string) {
  await page.waitForFunction(
    (domainName) => (document.getElementById('domain-list')?.textContent || '').includes(domainName),
    name,
    { polling: 250, timeout: 15000 }
  );
}

/**
 * The JUM-548 first-run surface: an empty model renders the Domain Designer's
 * guided empty state. The recovery/environment cells assert the designer
 * stays EXPLORABLE (never a blank screen) — since JUM-548 the proof of that
 * is the guided empty state, not a pre-populated template (the seed is now
 * intentionally empty; the sample model is an explicit one-action load).
 */
async function waitForGuidedEmptyState(page: Page, timeoutMs = 15000) {
  await page.waitForFunction(
    () => {
      const emptyState = document.getElementById('domain-designer-empty-state');
      return Boolean(emptyState && !emptyState.hidden);
    },
    undefined,
    { polling: 250, timeout: timeoutMs }
  );
}

async function waitForStatusRegion(page: Page, fragment: string, timeoutMs = 15000) {
  await page.waitForFunction(
    (text) => (document.getElementById('status-region')?.textContent || '').includes(text),
    fragment,
    { polling: 250, timeout: timeoutMs }
  );
}

/*
 * The status region holds ONE message at a time, and declared states compete
 * for it: JUM-485's sync engine announces its own start failure and its
 * save-outcome reconciliation after the boot's storage-environment message.
 * A poll can miss a transient message entirely, so the environment cells
 * record every mutation instead and assert against the record — what matters
 * is that the declared state WAS announced at startup, before the user
 * invested work.
 */
async function addStatusRegionRecorder(context: BrowserContext) {
  await context.addInitScript(() => {
    (window as unknown as { __statusRegionLog: string[] }).__statusRegionLog = [];
    const appendStatus = (region: HTMLElement) => {
      const log = (window as unknown as { __statusRegionLog: string[] }).__statusRegionLog;
      const text = region.textContent || '';
      if (text && log[log.length - 1] !== text) log.push(text);
    };
    const install = () => {
      const region = document.getElementById('status-region');
      if (!region) {
        window.setTimeout(install, 25);
        return;
      }
      appendStatus(region);
      new MutationObserver(() => {
        appendStatus(region);
      }).observe(region, { childList: true, characterData: true, subtree: true });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', install);
    } else {
      install();
    }
  });
}

async function waitForStatusLogged(page: Page, fragment: string, timeoutMs = 15000) {
  await page.waitForFunction(
    (text) => {
      const log = (window as unknown as { __statusRegionLog?: string[] }).__statusRegionLog || [];
      const regionText = document.getElementById('status-region')?.textContent || '';
      return regionText.includes(text) || log.some((message) => message.includes(text));
    },
    fragment,
    { polling: 100, timeout: timeoutMs }
  );
}

function statusRegionLog(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __statusRegionLog?: string[] }).__statusRegionLog || []
  );
}

function domainListText(page: Page): Promise<string> {
  return page.$eval('#domain-list', (el) => el.textContent || '');
}

function statusRegionText(page: Page): Promise<string> {
  return page.$eval('#status-region', (el) => el.textContent || '');
}

/** Console/page errors, collected per test the same way the sibling suites do. */
function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  return errors;
}

describe('serviceManagement offline/online persistence matrix on Cana (JUM-486)', () => {
  let tempDir: string;
  let server: StartedServer | undefined;
  let browser: Browser | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    // Regenerate the vendored Cana bundle so no cell boots against a stale or
    // absent artifact (same discipline as the sibling browser suites).
    execFileSync('bun', ['ci-cd/sync-service-management-cana-bundle.js'], {
      cwd: repoRoot,
      stdio: 'inherit'
    });
    tempDir = createTempConfigDir({ '.env.dev': envFileContent('express') });
    server = await startServer(tempDir);
    await waitForServer(server.port);
    baseUrl = `http://127.0.0.1:${String(server.port)}/`;
    browser = await webkit.launch({ headless: true });
  }, 120000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    stopServer(server);
    cleanupTempConfigDir(tempDir);
  });

  it('offline edits persist against Cana and survive reload; coming back online loses nothing', async () => {
    expect.hasAssertions();
    // Own server on a pinned port: the origin must survive the offline period.
    const offlineTempDir = createTempConfigDir({ '.env.dev': envFileContent('express') });
    const port = 4400 + Math.floor(Math.random() * 400);
    let offlineServer: StartedServer | undefined = await startPinnedServer(offlineTempDir, port);
    await waitForServer(port);
    const offlineUrl = `http://127.0.0.1:${String(port)}/`;
    const context = await browser!.newContext();
    const page = await context.newPage();
    const pageErrors = collectPageErrors(page);
    const downloads: string[] = [];
    page.on('download', (download) => downloads.push(download.suggestedFilename()));
    try {
      // Clean online boot: first-run save durable, shell precached.
      await page.goto(offlineUrl, { waitUntil: 'load' });
      await waitForHealthyBoot(page);
      await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
      await page.waitForFunction(
        (cacheName) => window.caches.keys().then((keys) => keys.includes(cacheName)),
        SHELL_CACHE_NAME
      );

      // Online edit, durable in the real IndexedDB.
      await addDomainThroughUi(page, 'OnlineDomain');

      // Offline for real: the server process dies (never setOffline).
      stopServer(offlineServer);
      offlineServer = undefined;

      // Edits continue against Cana with the network genuinely unreachable.
      await addDomainThroughUi(page, 'OfflineDomain');

      // Reload offline: the shell comes from the service worker cache, the
      // state from the genuine IndexedDB.
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('#tab-domain-designer-btn', { timeout: 15000 });
      await waitForDomainRendered(page, 'OfflineDomain');
      const offlineList = await domainListText(page);
      expect(offlineList).toContain('OnlineDomain');
      expect(offlineList).toContain('OfflineDomain');
      const offlineRecord = await canaStateRecord(page);
      expect(offlineRecord).toContain('"name":"OnlineDomain"');
      expect(offlineRecord).toContain('"name":"OfflineDomain"');

      // Back online after the offline period, same origin: nothing lost, no
      // duplicate, no migration re-run (there was never a legacy payload, so
      // no backup may ever have downloaded).
      offlineServer = await startPinnedServer(offlineTempDir, port);
      await waitForServer(port);
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('#tab-domain-designer-btn', { timeout: 15000 });
      await waitForDomainRendered(page, 'OfflineDomain');
      const recoveredRecord = JSON.parse((await canaStateRecord(page)) as string) as {
        domains: Array<{ name: string }>;
      };
      const names = recoveredRecord.domains.map((domain) => domain.name);
      expect(names.filter((name) => name === 'OnlineDomain')).toHaveLength(1);
      expect(names.filter((name) => name === 'OfflineDomain')).toHaveLength(1);
      expect(downloads).toHaveLength(0);
      const marker = await page.evaluate(
        (markerKey) => window.localStorage.getItem(markerKey),
        MARKER_KEY
      );
      expect(marker).toBeNull();
      // The only tolerable console noise is the network layer reporting the
      // intentionally dead server (SW-forwarded API fetches failing while
      // offline). Anything else — a boot exception, a shell-cache miss —
      // fails the cell.
      expect(pageErrors.filter(
        (message) => !/FetchEvent\.respondWith|Fetch API cannot load/.test(message)
      )).toStrictEqual([]);
    } finally {
      stopServer(offlineServer);
      cleanupTempConfigDir(offlineTempDir);
      await context.close();
    }
  }, 120000);

  it('a verified migration survives an offline period without re-running (idempotence)', async () => {
    expect.hasAssertions();
    const offlineTempDir = createTempConfigDir({ '.env.dev': envFileContent('express') });
    const port = 4900 + Math.floor(Math.random() * 400);
    let offlineServer: StartedServer | undefined = await startPinnedServer(offlineTempDir, port);
    await waitForServer(port);
    const offlineUrl = `http://127.0.0.1:${String(port)}/`;
    const context = await browser!.newContext();
    await context.addInitScript(
      (data: Record<string, unknown>) => {
        window.localStorage.setItem(data.stateKey as string, JSON.stringify(data.state));
      },
      { stateKey: STATE_KEY, state: LEGACY_PAYLOAD }
    );
    const page = await context.newPage();
    const pageErrors = collectPageErrors(page);
    const downloads: string[] = [];
    page.on('download', (download) => downloads.push(download.suggestedFilename()));
    try {
      // Online boot with a legacy payload: the one-way migration runs once.
      await page.goto(offlineUrl, { waitUntil: 'load' });
      await page.waitForFunction(
        (markerKey) => window.localStorage.getItem(markerKey) !== null,
        MARKER_KEY,
        { timeout: 15000 }
      );
      await waitForHealthyBoot(page);
      expect(downloads).toHaveLength(1);
      expect(downloads[0]).toMatch(/^service-management-v1-backup-.*\.json$/);
      await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
      await page.waitForFunction(
        (cacheName) => window.caches.keys().then((keys) => keys.includes(cacheName)),
        SHELL_CACHE_NAME
      );

      // Offline: kill the server, reload from the shell cache. The verified
      // marker short-circuits re-entry — no second migration, no second backup.
      stopServer(offlineServer);
      offlineServer = undefined;
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('#tab-domain-designer-btn', { timeout: 15000 });
      await waitForDomainRendered(page, 'MigratedDomain');
      await page.waitForTimeout(1500);
      expect(downloads).toHaveLength(1);

      // Offline edits against the migrated store stay durable.
      await addDomainThroughUi(page, 'OfflineRecoveryDomain');

      // Back online, same origin: the migrated model AND the offline edits
      // are present, and the migration still has not re-run.
      offlineServer = await startPinnedServer(offlineTempDir, port);
      await waitForServer(port);
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('#tab-domain-designer-btn', { timeout: 15000 });
      await waitForDomainRendered(page, 'OfflineRecoveryDomain');
      const recoveredList = await domainListText(page);
      expect(recoveredList).toContain('MigratedDomain');
      expect(recoveredList).toContain('OfflineRecoveryDomain');
      const marker = JSON.parse((await page.evaluate(
        (markerKey) => window.localStorage.getItem(markerKey),
        MARKER_KEY
      )) as string);
      expect(marker.status).toBe('verified');
      await page.waitForTimeout(1500);
      expect(downloads).toHaveLength(1);
      const record = JSON.parse((await canaStateRecord(page)) as string) as {
        domains: Array<{ name: string }>;
      };
      expect(record.domains.filter((domain) => domain.name === 'MigratedDomain')).toHaveLength(1);
      expect(record.domains.filter((domain) => domain.name === 'OfflineRecoveryDomain')).toHaveLength(1);
      // Same tolerated-noise rule as the other offline cell: only the dead
      // server's own network-layer complaints may appear.
      expect(pageErrors.filter(
        (message) => !/FetchEvent\.respondWith|Fetch API cannot load/.test(message)
      )).toStrictEqual([]);
    } finally {
      stopServer(offlineServer);
      cleanupTempConfigDir(offlineTempDir);
      await context.close();
    }
  }, 120000);

  it('worker crash mid-save: committed / rolled back / unknown are classified, and unknown is never reported as saved', async () => {
    expect.hasAssertions();
    const context = await newFaultSeamContext(browser!);
    const page = await context.newPage();
    const pageErrors = collectPageErrors(page);
    try {
      await page.goto(baseUrl, { waitUntil: 'load' });
      await waitForHealthyBoot(page);

      // The REAL CanaDesignerStore module (served by the real server) driven
      // against WebKit's genuine IndexedDB through the fault-seam engine.
      // String-evaluated on purpose: the repo compiles tests to commonjs,
      // which would rewrite a dynamic import inside a function body.
      const classification = (await page.evaluate(`(async () => {
        const { CanaDesignerStore } = await import('/src/store/CanaDesignerStore.js');
        const canaModule = await import('/vendor/cana/index.js');
        const makeStore = (name) => new CanaDesignerStore({
          client: canaModule.createCanaDatabaseClient({
            name,
            schema: { version: 1, stores: [{ name: 'designerDocuments' }] }
          }).cana
        });
        const payload = { domains: [{ id: 'domain-1', name: 'CrashMatrixDomain' }] };

        // Committed: the control outcome — durable and reported as such.
        const committedStore = makeStore('service-management-matrix-committed');
        const committed = await committedStore.save(payload);
        const committedLoad = await committedStore.load();

        // Rolled back: a quota-rejected write DID NOT happen; the port has no
        // deterministic-failure save state, so it reports unknown with a
        // distinguishable quota reason — never persisted.
        const quotaStore = makeStore('service-management-matrix-quota');
        window.__canaTestFaults = {
          writeError: {
            canaError: true,
            code: 'QuotaExceeded',
            message: 'Simulated quota exhaustion mid-session.',
            retryable: false
          }
        };
        const quotaRejected = await quotaStore.save(payload);
        window.__canaTestFaults = undefined;
        const quotaLoad = await quotaStore.load();

        // Unknown: the worker died mid-save; the outcome is indeterminate and
        // must surface as unknown, carrying the reconciliation handles.
        const crashStore = makeStore('service-management-matrix-crash');
        window.__canaTestFaults = { transactionOutcome: 'unknown' };
        const unknownOutcome = await crashStore.save(payload);
        window.__canaTestFaults = undefined;
        const unknownLoad = await crashStore.load();

        return { committed, committedLoad, quotaRejected, quotaLoad, unknownOutcome, unknownLoad };
      })()`)) as CrashClassification;

      expect(classification.committed.status).toBe('persisted');
      expect(classification.committedLoad.status).toBe('ok');

      expect(classification.quotaRejected.status).toBe('unknown');
      expect(classification.quotaRejected.status).not.toBe('persisted');
      expect(classification.quotaRejected.reason).toContain('quota:');
      // Rolled back means the record is genuinely absent afterwards.
      expect(classification.quotaLoad.status).toBe('empty');

      expect(classification.unknownOutcome.status).toBe('unknown');
      expect(classification.unknownOutcome.status).not.toBe('persisted');
      expect(classification.unknownOutcome.reason).toContain('unknown-outcome:');
      // The correlationId/attemptedAt handles resolveWrite() reconciles with.
      expect(classification.unknownOutcome.reason).toContain('cana-crash-sim:1');
      // The torn write is not there — and was never claimed durable.
      expect(classification.unknownLoad.status).toBe('empty');

      expect(pageErrors).toStrictEqual([]);
    } finally {
      await context.close();
    }
  }, 60000);

  it('private/blocked storage declares a non-persisting session at startup, before any doomed edit', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    // One ambient capability overridden: IndexedDB open requests fail, as they
    // do when the browser blocks storage (private/incognito). Everything below
    // — engine, adapter, boot, status region — is genuine.
    await context.addInitScript(() => {
      const blockedOpen = () => {
        const request: Record<string, unknown> = {
          error: new DOMException(
            'Storage access is blocked in this browsing context (simulated private mode).',
            'UnknownError'
          ),
          result: undefined,
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          onblocked: null
        };
        setTimeout(() => {
          if (typeof request.onerror === 'function') {
            (request.onerror as (event: Event) => void)(new Event('error'));
          }
        }, 0);
        return request;
      };
      Object.defineProperty(window.indexedDB, 'open', {
        configurable: true,
        value: blockedOpen
      });
    });
    await addStatusRegionRecorder(context);
    const page = await context.newPage();
    const pageErrors = collectPageErrors(page);
    try {
      await page.goto(baseUrl, { waitUntil: 'load' });
      await page.waitForSelector('#tab-domain-designer-btn', { timeout: 15000 });

      // The declared state arrives at startup, BEFORE the user invests work —
      // and the designer is still explorable (no blank screen): since
      // JUM-548 the in-memory proof is the guided first-run empty state.
      // Asserted against the mutation record: JUM-485's sync engine later
      // claims the single region with its own start failure, which must not
      // erase the fact that the declaration was made first. The generous
      // timeout is the same boot-latency headroom the quota cells document
      // (below): the declaration itself is deterministic — the blocked shim
      // fails by construction — but the whole boot (module graph, worker
      // start, probe round-trip) shares the runner with the crash cell's
      // teardown, and 15s of wall clock proved not to be a correctness
      // bound (JUM-628's recurring flake was this wait, not the designer).
      await waitForStatusLogged(page, 'Persistent storage is unavailable in this browsing context', 45000);
      await waitForGuidedEmptyState(page, 45000);
      const logBeforeEdit = await statusRegionLog(page);
      expect(logBeforeEdit.some(
        (message) => message.includes('Persistent storage is unavailable in this browsing context')
      )).toBe(true);

      // An edit in this session is doomed: there is nothing behind the store
      // to write to. The startup declaration above is the user-facing warning
      // for this environment; persistence is proven by the reload below.
      await page.fill('#domain-name-input', 'DoomedDomain');
      await page.click('#add-domain-btn');

      // Proof the edit was never silently persisted: a fresh page on the same
      // origin loses it and the declared state recurs instead of a phantom
      // restore. The service worker is reset first (unregister + drop the shell
      // caches). A WebKit reload controlled by an active SW can stall the
      // module graph fetch, so this cell intentionally boots a new page in the
      // same blocked-storage context after the reset.
      await page.evaluate(async (cachePrefix) => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.unregister();
        const cacheKeys = await window.caches.keys();
        await Promise.all(
          cacheKeys.filter((key) => key.startsWith(cachePrefix))
            .map((key) => window.caches.delete(key))
        );
      }, SHELL_CACHE_PREFIX);
      await page.close();
      const freshPage = await context.newPage();
      const freshErrors = collectPageErrors(freshPage);
      await freshPage.goto(baseUrl, { waitUntil: 'load' });
      await freshPage.waitForSelector('#tab-domain-designer-btn', { timeout: 15000 });
      await waitForStatusLogged(freshPage, 'Persistent storage is unavailable in this browsing context', 45000);
      await waitForGuidedEmptyState(freshPage, 45000);
      await expect(domainListText(freshPage)).resolves.not.toContain('DoomedDomain');

      expect([...pageErrors, ...freshErrors]).toStrictEqual([]);
    } finally {
      await context.close();
    }
  }, 90000);

  it('a browser without usable IndexedDB declares an unsupported environment, not a blank screen', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    await context.addInitScript(() => {
      try {
        Object.defineProperty(window, 'indexedDB', {
          configurable: true,
          get: () => undefined
        });
      } catch (_) {
        (window as unknown as { indexedDB: unknown }).indexedDB = undefined;
      }
    });
    await addStatusRegionRecorder(context);
    const page = await context.newPage();
    const pageErrors = collectPageErrors(page);
    try {
      await page.goto(baseUrl, { waitUntil: 'load' });
      await page.waitForSelector('#tab-domain-designer-btn', { timeout: 15000 });

      // The unsupported-environment state is explicit, and it is NOT the
      // private-mode state — the two are distinct declared environments.
      // Asserted against the mutation record (see the private-mode cell).
      await waitForStatusLogged(page, 'no usable IndexedDB storage', 45000);
      const declared = (await statusRegionLog(page)).find(
        (message) => message.includes('no usable IndexedDB storage')
      ) || '';
      expect(declared).toContain('unsupported');
      expect(declared).toContain('nothing you build here can be saved');

      // Explorable, not blank: the designer renders its guided first-run
      // empty state in memory (JUM-548 — the seed is intentionally empty).
      await waitForGuidedEmptyState(page, 45000);
      expect(pageErrors).toStrictEqual([]);
    } finally {
      await context.close();
    }
  }, 60000);

  it('eviction between sessions declares data loss explicitly — never presented as a first run', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    let page = await context.newPage();
    const pageErrors = collectPageErrors(page);
    try {
      // Session 1: real data, really durable — and a reload so Cana's
      // tombstone has recorded that this database held data (sticky hadData).
      await page.goto(baseUrl, { waitUntil: 'load' });
      await waitForHealthyBoot(page);
      await addDomainThroughUi(page, 'EvictionVictim');
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('#tab-domain-designer-btn', { timeout: 15000 });
      await waitForDomainRendered(page, 'EvictionVictim');
      const tombstone = JSON.parse((await page.evaluate(
        (key) => window.localStorage.getItem(key),
        TOMBSTONE_KEY
      )) as string);
      expect(tombstone.hadData).toBe(true);

      // The eviction, for real: the page (and its IndexedDB connection)
      // closes, and the database is deleted from a bare same-origin document.
      // The localStorage tombstone survives — exactly the signal JUM-560's
      // eviction detection is built on.
      await page.close();
      page = await context.newPage();
      collectPageErrors(page);
      await page.goto(`${baseUrl}manifest.webmanifest`, { waitUntil: 'load' });
      const databasesAfterDelete = await page.evaluate(`(async () => {
        await new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase('service-management');
          request.onsuccess = () => resolve(undefined);
          request.onerror = () => reject(request.error);
          request.onblocked = () => reject(new Error('delete blocked'));
        });
        return (await indexedDB.databases()).map((entry) => entry.name);
      })()`);
      expect(databasesAfterDelete).not.toContain('service-management');
      await expect(page.evaluate(
        (key) => window.localStorage.getItem(key) !== null,
        TOMBSTONE_KEY
      )).resolves.toBe(true);

      // Session 2: the designer opens, finds the database gone, and declares
      // the loss. It must NOT present this as a first run. (45s: boot-latency
      // headroom, same rationale as the environment cells above.)
      await page.goto(baseUrl, { waitUntil: 'load' });
      await page.waitForSelector('#tab-domain-designer-btn', { timeout: 15000 });
      await waitForStatusRegion(page, 'Previously saved designer data is no longer readable', 45000);
      await waitForGuidedEmptyState(page, 45000);
      const evictedList = await domainListText(page);
      expect(evictedList).not.toContain('EvictionVictim');
      expect(pageErrors).toStrictEqual([]);
    } finally {
      await context.close();
    }

    // The distinguishing assertion: a genuinely fresh origin (no tombstone,
    // no database) is a first run and must NOT be reported as data loss.
    const freshContext = await browser!.newContext();
    const freshPage = await freshContext.newPage();
    const freshErrors = collectPageErrors(freshPage);
    try {
      await freshPage.goto(baseUrl, { waitUntil: 'load' });
      await waitForHealthyBoot(freshPage);
      await expect(statusRegionText(freshPage)).resolves.not.toContain('no longer readable');
      expect(freshErrors).toStrictEqual([]);
    } finally {
      await freshContext.close();
    }
  }, 120000);

  it('a corrupted record reports lost — not empty — through the real port, and the designer recovers and ANNOUNCES the loss (JUM-626)', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    const pageErrors = collectPageErrors(page);
    try {
      await page.goto(baseUrl, { waitUntil: 'load' });
      await waitForHealthyBoot(page);
      await addDomainThroughUi(page, 'CorruptionVictim');

      // Corrupt the record in the genuine object store (an unreadable payload,
      // not a missing one — eviction is the other cell).
      await page.evaluate(`(async () => {
        await new Promise((resolve, reject) => {
          const request = indexedDB.open('service-management');
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('designerDocuments', 'readwrite');
            const putRequest = tx.objectStore('designerDocuments')
              .put('{corrupted-json', 'service-management.v1');
            putRequest.onsuccess = () => resolve(undefined);
            putRequest.onerror = () => reject(putRequest.error);
          };
          request.onerror = () => reject(request.error);
        });
      })()`);

      // The REAL port, in the real browser, against the real database: a
      // stored payload that no longer parses is 'lost', NEVER 'empty'.
      const verdict = (await page.evaluate(`(async () => {
        const { CanaDesignerStore } = await import('/src/store/CanaDesignerStore.js');
        const canaModule = await import('/vendor/cana/index.js');
        const store = new CanaDesignerStore({
          client: canaModule.createCanaDatabaseClient({
            name: 'service-management',
            schema: { version: 1, stores: [{ name: 'designerDocuments' }] }
          }).cana
        });
        return store.load();
      })()`)) as StoreResultRead;
      expect(verdict.status).toBe('lost');
      expect(verdict.status).not.toBe('empty');
      expect(verdict.payload).toBeNull();
      expect(verdict.reason).toContain('not readable JSON');

      // The designer recovers rather than crashing: the reload boots the
      // (intentionally empty, JUM-548) first-run state — the guided empty
      // state renders — and the recovered save makes the record readable again.
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('#tab-domain-designer-btn', { timeout: 15000 });
      // JUM-626: the recovery is ANNOUNCED, never silent — the same data-lost
      // declared state as probe-time eviction, naming the loss and the
      // export/import recourse. Severity error persists in the region (only
      // info toasts auto-hide), so the live region still carries it here.
      // (45s: boot-latency headroom, same rationale as the environment cells.)
      await waitForStatusRegion(page, 'Your previously saved design could not be loaded', 45000);
      await expect(statusRegionText(page)).resolves.toContain('Import JSON');
      await waitForGuidedEmptyState(page, 45000);
      await expect(domainListText(page)).resolves.not.toContain('CorruptionVictim');
      const healed = JSON.parse((await canaStateRecord(page)) as string) as {
        domains: Array<{ name: string }>;
      };
      expect(Array.isArray(healed.domains)).toBe(true);
      expect(pageErrors).toStrictEqual([]);
    } finally {
      await context.close();
    }
  }, 90000);

  it('quota pressure warns before the hard failure with a reachable export path; a quota-failed write is never persisted', async () => {
    expect.hasAssertions();
    const context = await newFaultSeamContext(browser!);
    // Deterministic quota pressure through the fault seam (set before the
    // first probe, so the very first boot sees it): scripting the client's
    // storageState removes the dependence on the host WebKit's StorageManager
    // property semantics — the CI failure mode, where shadowing
    // `navigator.storage.estimate` produced no near-quota probe at all. The
    // nearQuota → degraded-durability mapping below (real adapter, real boot,
    // real status region) is exactly what this cell asserts; the estimate →
    // nearQuota computation is unit-covered in packages/cana and
    // canaDesignerStore.test.ts with the same scripted-state contract.
    await context.addInitScript(() => {
      (window as unknown as { __canaTestFaults: unknown }).__canaTestFaults = {
        storageState: { nearQuota: true, usageBytes: 950, quotaBytes: 1000 }
      };
    });
    await addStatusRegionRecorder(context);
    const page = await context.newPage();
    const pageErrors = collectPageErrors(page);
    const downloads: string[] = [];
    page.on('download', (download) => downloads.push(download.suggestedFilename()));
    try {
      await page.goto(baseUrl, { waitUntil: 'load' });
      await page.waitForSelector('#tab-domain-designer-btn', { timeout: 15000 });

      // The warning arrives BEFORE the hard failure: reads still work, so the
      // state stays available, but the degraded-durability surface names the
      // quota pressure. The generous timeout is CI boot-latency headroom, not
      // a weaker assertion: the trigger above is deterministic.
      await waitForStatusLogged(page, 'quota: storage usage is near the origin quota', 45000);
      await waitForHealthyBoot(page);

      // The backup/export path is reachable from the warned session.
      const exportDownload = page.waitForEvent('download', { timeout: 15000 });
      await page.click('#export-json-btn');
      await exportDownload;
      expect(downloads).toContain('domain-designer.json');

      // The hard failure: a write rejected with QuotaExceeded did NOT happen.
      // The storageState scripting stays in place beside the write error.
      await page.evaluate('window.__canaTestFaults = {'
        + ' storageState: { nearQuota: true, usageBytes: 950, quotaBytes: 1000 },'
        + ' writeError: {'
        + '   canaError: true,'
        + '   code: "QuotaExceeded",'
        + '   message: "Simulated quota exhaustion mid-session.",'
        + '   retryable: false'
        + ' }'
        + '}');
      await page.fill('#domain-name-input', 'QuotaDoomedDomain');
      await page.click('#add-domain-btn');
      // No silent acceptance: JUM-485's save-outcome hook surfaces the
      // unconfirmed save and reconciles by read-back.
      await waitForStatusLogged(page, 'could not be confirmed', 45000);
      await page.waitForTimeout(1500);
      // The durable record does not carry the doomed write.
      await expect(canaStateRecord(page)).resolves.not.toContain('QuotaDoomedDomain');

      // Reload tells the truth: the quota-doomed edit is gone, and the
      // pressure warning is still the state of the environment. The service
      // worker is reset first (unregister + drop the shell caches, the same
      // reset pwaShell implements): an active SW serves the precached REAL
      // bundle from its cache — WebKit SW fetches do not pass through route
      // interception — which would silently drop the fault seam on reload.
      await page.evaluate(async (cachePrefix) => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.unregister();
        const cacheKeys = await window.caches.keys();
        await Promise.all(
          cacheKeys.filter((key) => key.startsWith(cachePrefix))
            .map((key) => window.caches.delete(key))
        );
      }, SHELL_CACHE_PREFIX);
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('#tab-domain-designer-btn', { timeout: 15000 });
      await waitForStatusLogged(page, 'quota: storage usage is near the origin quota', 45000);
      await waitForGuidedEmptyState(page, 45000);
      await expect(domainListText(page)).resolves.not.toContain('QuotaDoomedDomain');
      expect(pageErrors).toStrictEqual([]);
    } finally {
      await context.close();
    }
  }, 90000);
});
