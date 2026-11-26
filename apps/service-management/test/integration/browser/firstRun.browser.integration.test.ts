/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test */
/* eslint-disable no-await-in-loop, jest/max-expects */
/*
 * First-run experience: a fresh browser profile seeds the backend-template
 * model from live OpenAPI contracts (spec/1.0.0.yml). Empty-state CTAs reload
 * that same seed after the user clears the canvas.
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
  clickInPanels,
  openDesignerPanels,
  stopServer,
  waitForServer
} from '../../helpers/serverHarness';
import type { StartedServer } from '../../helpers/serverHarness';

const repoRoot = path.resolve(__dirname, '../../../../..');

async function isVisible(element: import('playwright-webkit').ElementHandle | null): Promise<boolean> {
  if (!element) return false;
  return element.isVisible();
}

describe('serviceManagement first-run experience (backend-template seed)', () => {
  let tempDir: string;
  let server: StartedServer | undefined;
  let browser: Browser | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    execFileSync('bun', ['apps/service-management/scripts/sync-service-management-cana-bundle.js'], {
      cwd: repoRoot,
      stdio: 'inherit'
    });
    execFileSync('bun', ['apps/service-management/scripts/generate-backend-template-seed.js'], {
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
    if (browser) {
      await browser.close();
    }
    stopServer(server);
    cleanupTempConfigDir(tempDir);
  });

  it('boots a fresh profile with the backend-template Users domain', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(String(error)));

    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.waitForSelector('body[data-designer-ready="true"]');
    await openDesignerPanels(page, '#domain-list');
    await page.waitForSelector('#domain-list li', { state: 'attached' });

    const domainEmpty = await page.$('#domain-designer-empty-state');
    await expect(isVisible(domainEmpty)).resolves.toBe(false);

    const domainListText = await page.$eval('#domain-list', (el) => el.textContent || '');
    expect(domainListText).toContain('Users');
    expect(domainListText).not.toContain('Tasks');

    const entityCards = await page.$$('.canvas .entity');
    expect(entityCards.length).toBeGreaterThanOrEqual(6);

    expect(consoleErrors).toStrictEqual([]);
    await context.close();
  }, 60000);

  it('reloads the backend model via Import → Backend and exports through the quality gate', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.waitForSelector('body[data-designer-ready="true"]');
    await openDesignerPanels(page, '#domain-list');
    await page.waitForSelector('#domain-list li', { state: 'attached' });

    // Seed already populated the store — confirm replace, then assert status + export gate.
    page.once('dialog', (dialog) => {
      dialog.accept().catch(() => {});
    });
    await clickInPanels(page, '#load-sample-btn');
    await page.waitForTimeout(300);

    await expect(isVisible(await page.$('#domain-designer-empty-state'))).resolves.toBe(false);
    const domainListText = await page.$eval('#domain-list', (el) => el.textContent || '');
    expect(domainListText).toContain('Users');
    const statusText = await page.$eval('#status-region', (el) => el.textContent || '');
    expect(statusText).toContain('Backend-template model loaded');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      clickInPanels(page, '#export-json-btn')
    ]);
    expect(download.suggestedFilename()).toBe('domain-designer.json');
    await context.close();
  }, 60000);

  it('requires explicit confirmation before replacing existing work with the backend model', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.waitForSelector('body[data-designer-ready="true"]');
    await openDesignerPanels(page, '#domain-list');
    await page.waitForSelector('#domain-list li', { state: 'attached' });

    await openDesignerPanels(page, '#domain-name-input');
    await page.fill('#domain-name-input', 'Mine');
    await clickInPanels(page, '#add-domain-btn');
    let domainListText = await page.$eval('#domain-list', (el) => el.textContent || '');
    expect(domainListText).toContain('Mine');

    page.once('dialog', (dialog) => {
      dialog.dismiss().catch(() => {});
    });
    await clickInPanels(page, '#load-sample-btn');
    await page.waitForTimeout(300);
    domainListText = await page.$eval('#domain-list', (el) => el.textContent || '');
    expect(domainListText).toContain('Mine');
    expect(domainListText).toContain('Users');

    page.once('dialog', (dialog) => {
      dialog.accept().catch(() => {});
    });
    await clickInPanels(page, '#load-sample-btn');
    await page.waitForTimeout(300);
    domainListText = await page.$eval('#domain-list', (el) => el.textContent || '');
    expect(domainListText).not.toContain('Mine');
    expect(domainListText).toContain('Users');
    await context.close();
  }, 60000);
});
