/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test */
/* eslint-disable no-await-in-loop, jest/max-expects */
/*
 * JUM-466 — SPA boot and export-gate assertions, run in a REAL browser
 * (Playwright WebKit, the engine this repository already pins for browser
 * runs) against the REAL server. No DOM shims, no fakes (Requirement 115).
 *
 * Pins:
 *  - The SPA boots and each of the four tabs renders without console errors.
 *  - The export quality gate (Requirement 126 §5): with
 *    `view.exportBlockCritical` true (the default), an export is refused while
 *    model validation reports any error-severity issue; lifting the gate on
 *    the same model releases the export — proving the gate, not a broken
 *    exporter, did the blocking.
 */
import { webkit } from 'playwright-webkit';
import type { Browser } from 'playwright-webkit';
import {
  createTempConfigDir,
  cleanupTempConfigDir,
  envFileContent,
  startServer,
  stopServer,
  waitForServer
} from './serverHarness';
import type { StartedServer } from './serverHarness';

const TABS = [
  'domain-designer',
  'interface-designer',
  'service-config',
  'deploy-management'
];

// Requirement 126 §4: the whole suite state lives under this single key.
const STORAGE_KEY = 'service-management.v1';

// A model with one error-severity issue: an entity without a primary key.
const BROKEN_SNAPSHOT = {
  domains: [
    {
      id: 'domain-1',
      name: 'Broken',
      color: '#93c5fd',
      entities: [
        {
          id: 'entity-1',
          name: 'NoPk',
          meta: { aggregateRoot: true, invariants: [], contracts: [] },
          fields: [
            {
              name: 'title',
              type: 'string',
              required: false,
              pk: false,
              fk: false,
              unique: false,
              nullable: true
            }
          ]
        }
      ]
    }
  ],
  relationships: [],
  view: { exportBlockCritical: true }
};

describe('serviceManagement SPA boot and export gate (JUM-466)', () => {
  let tempDir: string;
  let server: StartedServer | undefined;
  let browser: Browser | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    tempDir = createTempConfigDir({ '.env.dev': envFileContent('express') });
    server = await startServer(tempDir);
    await waitForServer(server.port);
    baseUrl = `http://127.0.0.1:${String(server.port)}/`;
    browser = await webkit.launch({ headless: true });
  }, 90000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    stopServer(server);
    cleanupTempConfigDir(tempDir);
  });

  it('boots the SPA and renders all four tabs without console errors', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(String(error)));

    await page.goto(baseUrl, { waitUntil: 'load' });
    for (const tab of TABS) {
      await page.click(`#tab-${tab}-btn`);
      const isActive = await page.$eval(`#tab-${tab}`, (el) => el.classList.contains('active'));
      expect(isActive).toBe(true);
    }
    expect(consoleErrors).toStrictEqual([]);
    await context.close();
  }, 60000);

  it('blocks export while error-severity issues exist and exports once the gate lifts', async () => {
    expect.hasAssertions();

    // Clean seeded model: the gate passes and the export must fire.
    const cleanContext = await browser!.newContext();
    const cleanPage = await cleanContext.newPage();
    await cleanPage.goto(baseUrl, { waitUntil: 'load' });
    const [download] = await Promise.all([
      cleanPage.waitForEvent('download'),
      cleanPage.click('#export-json-btn')
    ]);
    expect(download.suggestedFilename()).toBe('domain-designer.json');
    await cleanContext.close();

    // Broken model: the gate refuses the export and surfaces the issues.
    const brokenContext = await browser!.newContext();
    await brokenContext.addInitScript(
      (data: { key: string; snapshot: unknown }) => {
        window.localStorage.setItem(data.key, JSON.stringify(data.snapshot));
      },
      { key: STORAGE_KEY, snapshot: BROKEN_SNAPSHOT }
    );
    const page = await brokenContext.newPage();

    // JUM-484: booting with a legacy localStorage payload triggers the
    // one-way migration to Cana, whose pre-migration backup download fires
    // BEFORE anything is written to the new store. It is expected here —
    // and must be the ONLY download until the export gate lifts.
    const backupDownloadPromise = page.waitForEvent('download');
    await page.goto(baseUrl, { waitUntil: 'load' });
    const backupDownload = await backupDownloadPromise;
    expect(backupDownload.suggestedFilename()).toMatch(/^service-management-v1-backup-.*\.json$/);

    let downloadFired = false;
    page.on('download', () => {
      downloadFired = true;
    });
    await page.click('#export-json-btn');
    await page.waitForTimeout(1500);
    expect(downloadFired).toBe(false);

    const findings = await page.$eval('#model-check-list', (el) => el.textContent || '');
    expect(findings).toContain('[ERROR]');
    expect(findings).toContain('no primary key');

    // Lifting the gate on the SAME broken model releases the export.
    await page.click('#export-block-critical-check');
    const [relaxedDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#export-json-btn')
    ]);
    expect(relaxedDownload.suggestedFilename()).toBe('domain-designer.json');
    await brokenContext.close();
  }, 90000);
});
