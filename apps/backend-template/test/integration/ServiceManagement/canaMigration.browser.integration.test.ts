/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test, jest/max-expects */
/*
 * JUM-484 — the ONE-WAY migration of `service-management.v1` from
 * localStorage to Cana, run in a REAL browser (Playwright WebKit, the engine
 * this repository already pins) against the REAL server serving the REAL
 * vendored Cana bundle. No DOM shims, no fakes (Requirement 115): the
 * migration writes into WebKit's genuine IndexedDB through the genuine
 * Cana client.
 *
 * Pins:
 *  - Booting with a legacy localStorage payload produces the pre-migration
 *    backup download BEFORE cutover, migrates the payload AND the
 *    schema-baseline into Cana (verified by reading the real object store),
 *    records the verified marker, and RETAINS the source payload, unused.
 *  - The designer renders the migrated model on the very first boot.
 *  - A reload does not re-migrate (idempotent): no second backup, no rewrite.
 *  - A boot with no legacy payload migrates nothing and downloads nothing.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { webkit } from 'playwright-webkit';
import type { Browser, Page } from 'playwright-webkit';
import {
  createTempConfigDir,
  cleanupTempConfigDir,
  envFileContent,
  startServer,
  stopServer,
  waitForServer
} from './serverHarness';
import type { StartedServer } from './serverHarness';

const repoRoot = path.resolve(__dirname, '../../../../..');

// Requirement 126 Contract 2 + JUM-484 pinned keys.
const STATE_KEY = 'service-management.v1';
const BASELINE_KEY = 'service-management.schema-baseline.v1';
const MARKER_KEY = 'service-management.v1.cana-migration';
const MIGRATION_RECORD_KEY = 'service-management.migration.v1';

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

const LEGACY_BASELINE = {
  domains: [{
    id: 'domain-1', name: 'MigratedDomain', color: '#93c5fd', context: {}, entities: []
  }],
  relationships: []
};

/** Read every record key (and optionally a payload) out of the REAL IndexedDB. */
function readCanaRecords() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('service-management');
    request.onsuccess = () => {
      const db = request.result;
      try {
        const tx = db.transaction('designerDocuments', 'readonly');
        const store = tx.objectStore('designerDocuments');
        const keysRequest = store.getAllKeys();
        keysRequest.onsuccess = () => {
          const keys = keysRequest.result.map(String);
          const stateRequest = store.get('service-management.v1');
          stateRequest.onsuccess = () => {
            resolve({ keys, state: stateRequest.result ? JSON.parse(stateRequest.result) : null });
          };
        };
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

type CanaRecordsRead = {
  keys: string[];
  state: { domains?: Array<{ name: string }> } | null;
};

async function canaRecords(page: Page): Promise<CanaRecordsRead> {
  return page.evaluate(readCanaRecords) as Promise<CanaRecordsRead>;
}

describe('serviceManagement one-way migration localStorage → Cana (JUM-484)', () => {
  let tempDir: string;
  let server: StartedServer | undefined;
  let browser: Browser | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    // The SPA resolves `@jumentix/cana` to the vendored bundle; regenerate it
    // so the suite never boots against a stale or absent artifact.
    execFileSync('bun', ['ci-cd/sync-service-management-cana-bundle.js'], {
      cwd: repoRoot,
      stdio: 'inherit'
    });
    tempDir = createTempConfigDir({ '.env.dev': envFileContent('express') });
    server = startServer(tempDir);
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

  it('migrates a legacy payload into real IndexedDB with backup, verification, marker and retention', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    await context.addInitScript(
      (data: Record<string, unknown>) => {
        window.localStorage.setItem(data.stateKey as string, JSON.stringify(data.state));
        window.localStorage.setItem(data.baselineKey as string, JSON.stringify(data.baseline));
      },
      {
        stateKey: STATE_KEY,
        baselineKey: BASELINE_KEY,
        state: LEGACY_PAYLOAD,
        baseline: LEGACY_BASELINE
      }
    );
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    const downloads: string[] = [];
    page.on('download', (download) => downloads.push(download.suggestedFilename()));

    await page.goto(baseUrl, { waitUntil: 'load' });

    // Export before migrate: exactly one download, the pre-migration backup.
    await page.waitForFunction(
      (markerKey) => window.localStorage.getItem(markerKey) !== null,
      MARKER_KEY,
      { timeout: 15000 }
    );
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/^service-management-v1-backup-.*\.json$/);

    // Verify before cutover: the state AND the baseline live in the real
    // object store, beside the schema-versioned migration record.
    const records = await canaRecords(page);
    expect(records.keys).toContain(STATE_KEY);
    expect(records.keys).toContain(BASELINE_KEY);
    expect(records.keys).toContain(MIGRATION_RECORD_KEY);
    expect(records.state?.domains?.[0]?.name).toBe('MigratedDomain');

    // One-way and terminal: the marker is verified and the source payload is
    // RETAINED in localStorage, unused, as the manual recovery path.
    const marker = JSON.parse((await page.evaluate(
      (markerKey) => window.localStorage.getItem(markerKey),
      MARKER_KEY
    )) as string);
    expect(marker.status).toBe('verified');
    expect(Date.parse(marker.sourceRetainedUntil)).toBeGreaterThan(Date.parse(marker.migratedAt));
    const retained = await page.evaluate(
      (stateKey) => window.localStorage.getItem(stateKey),
      STATE_KEY
    );
    expect(retained).toBe(JSON.stringify(LEGACY_PAYLOAD));

    // The designer renders the migrated model on this very first boot.
    const domainList = await page.$eval('#domain-list', (el) => el.textContent || '');
    expect(domainList).toContain('MigratedDomain');

    // The migration is announced through the non-blocking status surface.
    const announcement = await page.$eval('#status-region', (el) => el.textContent || '');
    expect(announcement).toContain('moved to the new persistent store');

    expect(consoleErrors).toStrictEqual([]);

    // Idempotent: a reload migrates nothing again — no second backup, no
    // rewrite, same model rendered (now read from Cana itself).
    downloads.length = 0;
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(
      (markerKey) => window.localStorage.getItem(markerKey) !== null,
      MARKER_KEY,
      { timeout: 15000 }
    );
    await page.waitForTimeout(1500);
    expect(downloads).toHaveLength(0);
    const reloadedDomains = await page.$eval('#domain-list', (el) => el.textContent || '');
    expect(reloadedDomains).toContain('MigratedDomain');
    expect(consoleErrors).toStrictEqual([]);

    await context.close();
  }, 90000);

  it('boots clean without a legacy payload: nothing migrates, nothing downloads', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    const downloads: string[] = [];
    page.on('download', (download) => downloads.push(download.suggestedFilename()));

    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.waitForSelector('#tab-domain-designer-btn', { timeout: 15000 });
    await page.waitForTimeout(1500);

    expect(downloads).toHaveLength(0);
    const marker = await page.evaluate(
      (markerKey) => window.localStorage.getItem(markerKey),
      MARKER_KEY
    );
    expect(marker).toBeNull();
    expect(consoleErrors).toStrictEqual([]);
    await context.close();
  }, 60000);
});
