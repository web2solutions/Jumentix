/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/*
 * JUM-730 — the global status region reports the outcome of the action that
 * just ran, in a REAL browser against the REAL server (Requirement 115), on
 * the same harness as the other browser suites.
 *
 * The defect this pins: `#status-region` is `role="status" aria-live="polite"`,
 * and only the refusal paths wrote to it. A successful action wrote nothing, so
 * a previous failure stayed on screen and stayed announced. Measured before the
 * fix: add `Zed` (succeeds, silent) → add `Zed` again (`Domain "Zed" already
 * exists.`) → add `Yankee` (succeeds) left the failure text standing.
 *
 * The assertions read the rendered text a user and a screen reader would get,
 * never a spy on a function.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
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

const repoRoot = path.resolve(__dirname, '../../../../..');

describe('serviceManagement status region reports outcomes (JUM-730)', () => {
  let tempDir: string;
  let server: StartedServer | undefined;
  let browser: Browser | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    execFileSync('bun', ['ci-cd/sync-service-management-cana-bundle.js'], {
      cwd: repoRoot,
      stdio: 'inherit'
    });
    execFileSync('bun', ['ci-cd/sync-service-management-designer-core.js'], {
      cwd: repoRoot,
      stdio: 'inherit'
    });
    tempDir = createTempConfigDir({ '.env.dev': envFileContent('express') });
    server = await startServer(tempDir);
    await waitForServer(server.port);
    baseUrl = `http://127.0.0.1:${String(server.port)}/`;
    browser = await webkit.launch({ headless: true });
  }, 90000);

  afterAll(async () => {
    if (browser) await browser.close();
    stopServer(server);
    cleanupTempConfigDir(tempDir);
  });

  async function statusText(page: import('playwright-webkit').Page): Promise<string> {
    return page.$eval('#status-region', (el) => (el.textContent || '').trim());
  }

  const addDomain = async (page: import('playwright-webkit').Page, name: string): Promise<void> => {
    await page.fill('#domain-name-input', name);
    await page.click('#add-domain-btn');
    await page.waitForTimeout(150);
  };

  it('replaces a failure with the outcome of the next successful action', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'load' });

    await addDomain(page, 'Zed');
    await expect(statusText(page)).resolves.toBe('Domain "Zed" added.');

    await addDomain(page, 'Zed');
    await expect(statusText(page)).resolves.toBe('Domain "Zed" already exists.');

    // The defect: this success used to leave the failure above on screen.
    await addDomain(page, 'Yankee');
    await expect(statusText(page)).resolves.toBe('Domain "Yankee" added.');

    await context.close();
  }, 60000);

  it('explains an ignored empty name instead of leaving the previous message standing', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'load' });

    await addDomain(page, 'Alpha');
    await addDomain(page, 'Alpha');
    await expect(statusText(page)).resolves.toBe('Domain "Alpha" already exists.');

    await page.fill('#domain-name-input', '   ');
    await page.click('#add-domain-btn');
    await page.waitForTimeout(150);

    await expect(statusText(page)).resolves.toBe('Type a domain name before adding.');

    await context.close();
  }, 60000);

  it('reports entity and field additions, which were silent before', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'load' });

    await addDomain(page, 'Billing');
    await page.click('#domain-list li');
    await page.waitForTimeout(150);

    await page.fill('#entity-name-input', 'Invoice');
    await page.click('#add-entity-btn');
    await page.waitForTimeout(200);
    await expect(statusText(page)).resolves.toBe('Entity "Invoice" added to Billing.');

    await page.fill('#entity-search-input', 'Invoice');
    await page.click('#entity-search-btn');
    await page.waitForTimeout(200);

    await page.fill('#field-name-input', 'total');
    await page.click('#add-field-btn');
    await page.waitForTimeout(200);
    await expect(statusText(page)).resolves.toBe('Field "total" added to Invoice.');

    await context.close();
  }, 60000);

  it('reports a deletion, so the model change is announced', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.goto(baseUrl, { waitUntil: 'load' });

    await addDomain(page, 'Scratch');
    await page.click('#domain-list li');
    await page.waitForTimeout(150);

    await page.click('#delete-domain-btn');
    await page.waitForTimeout(300);

    await expect(statusText(page)).resolves.toBe('Domain "Scratch" deleted.');

    await context.close();
  }, 60000);
});
