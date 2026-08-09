/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test */
/* eslint-disable no-await-in-loop, jest/max-expects */
/*
 * JUM-548 — first-run experience assertions, run in a REAL browser
 * (Playwright WebKit, the engine this repository already pins for browser
 * runs) against the REAL server. No DOM shims, no fakes (Requirement 115).
 * Same harness and boot path as spaBoot.browser.integration.test.ts.
 *
 * Pins, each on a fresh profile (a fresh Playwright context = a first run):
 *  - The designer boots to an EMPTY model and every tab shows its guided
 *    empty state, each naming the tab's first action.
 *  - The sample loads in one action from the Domain Designer's empty state:
 *    the empty state hides, the domain list shows the Users domain with its
 *    "sample" badge, and the loaded sample passes the export quality gate
 *    (the JSON export fires with the gate at its default blocking setting).
 *  - Loading the sample over existing work is non-destructive by contract:
 *    it asks for explicit confirmation — dismissing keeps the user's model,
 *    accepting replaces it (with Undo as the in-session recourse).
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

const OTHER_TABS = [
  { key: 'interface-designer', emptyState: '#interface-designer-empty-state' },
  { key: 'service-config', emptyState: '#service-config-empty-state' },
  { key: 'deploy-management', emptyState: '#deploy-management-empty-state' }
];

async function isVisible(element: import('playwright-webkit').ElementHandle | null): Promise<boolean> {
  if (!element) return false;
  return element.isVisible();
}

describe('serviceManagement first-run experience (JUM-548)', () => {
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

  it('boots a fresh profile to an empty model with a guided empty state per tab', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(String(error)));

    await page.goto(baseUrl, { waitUntil: 'load' });

    // The Domain Designer's empty state names the one action that starts the flow.
    const domainEmpty = await page.$('#domain-designer-empty-state');
    await expect(isVisible(domainEmpty)).resolves.toBe(true);
    await expect(page.$('#domain-designer-empty-load-sample-btn')).resolves.not.toBeNull();
    const domainGuidance = await domainEmpty!.textContent();
    expect(domainGuidance).toContain('First action');

    // No domains on a fresh profile — the seed no longer pre-populates.
    const domainItems = await page.$$('#domain-list li');
    expect(domainItems).toHaveLength(0);

    // Every other tab shows its own guided empty state, each naming a first action.
    for (const tab of OTHER_TABS) {
      await page.click(`#tab-${tab.key}-btn`);
      const emptyState = await page.$(tab.emptyState);
      await expect(isVisible(emptyState)).resolves.toBe(true);
      await expect(emptyState!.textContent()).resolves.toContain('First action');
    }

    expect(consoleErrors).toStrictEqual([]);
    await context.close();
  }, 60000);

  it('loads the sample in one action, marks it, and exports through the quality gate', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'load' });

    await page.click('#domain-designer-empty-load-sample-btn');

    // The empty state gives way to the sample model...
    await expect(isVisible(await page.$('#domain-designer-empty-state'))).resolves.toBe(false);
    const domainListText = await page.$eval('#domain-list', (el) => el.textContent || '');
    expect(domainListText).toContain('Users');
    // ...which is marked as sample in the domain list...
    const badges = await page.$$('#domain-list .sample-badge');
    expect(badges).toHaveLength(1);
    await expect(badges[0].textContent()).resolves.toBe('sample');
    // ...announced through the non-blocking status surface (JUM-543), never an alert.
    const statusText = await page.$eval('#status-region', (el) => el.textContent || '');
    expect(statusText).toContain('Sample model loaded');
    // ...and the canvas renders the sample's entities.
    const entityCards = await page.$$('.canvas .entity');
    expect(entityCards.length).toBeGreaterThan(0);

    // The sample passes the export quality gate at its default blocking
    // setting — the export fires, proving collectModelIssues reports no
    // error-severity issue on it.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#export-json-btn')
    ]);
    expect(download.suggestedFilename()).toBe('domain-designer.json');
    await context.close();
  }, 60000);

  it('requires explicit confirmation before replacing existing work with the sample', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'load' });

    // Existing work: the sample plus the user's own domain.
    await page.click('#domain-designer-empty-load-sample-btn');
    await page.fill('#domain-name-input', 'Mine');
    await page.click('#add-domain-btn');
    let domainListText = await page.$eval('#domain-list', (el) => el.textContent || '');
    expect(domainListText).toContain('Mine');

    // Dismissing the confirmation keeps the user's model untouched.
    page.once('dialog', (dialog) => {
      dialog.dismiss().catch(() => {});
    });
    await page.click('#load-sample-btn');
    await page.waitForTimeout(300);
    domainListText = await page.$eval('#domain-list', (el) => el.textContent || '');
    expect(domainListText).toContain('Mine');
    expect(domainListText).toContain('Users');

    // Accepting replaces the model with the sample — the user's domain is
    // gone (recoverable through in-session Undo, as the dialog announces).
    page.once('dialog', (dialog) => {
      dialog.accept().catch(() => {});
    });
    await page.click('#load-sample-btn');
    await page.waitForTimeout(300);
    domainListText = await page.$eval('#domain-list', (el) => el.textContent || '');
    expect(domainListText).not.toContain('Mine');
    expect(domainListText).toContain('Users');
    await context.close();
  }, 60000);
});
