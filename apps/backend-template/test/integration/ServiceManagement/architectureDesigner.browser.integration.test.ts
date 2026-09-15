/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test, jest/max-expects */
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
  stopServer,
  waitForServer
} from './serverHarness';
import type { StartedServer } from './serverHarness';

const repoRoot = path.resolve(__dirname, '../../../../..');

describe('architecture designer and swagger tab (JUM-819)', () => {
  let tempDir: string;
  let server: StartedServer | undefined;
  let browser: Browser | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    execFileSync('bun', ['ci-cd/sync-service-management-cana-bundle.js'], { cwd: repoRoot, stdio: 'inherit' });
    execFileSync('bun', ['ci-cd/sync-service-management-designer-core.js'], { cwd: repoRoot, stdio: 'inherit' });
    tempDir = createTempConfigDir({ '.env.dev': envFileContent('express') });
    server = await startServer(tempDir);
    await waitForServer(server.port);
    baseUrl = `http://127.0.0.1:${String(server.port)}/`;
    browser = await webkit.launch({ headless: true });
  }, 120000);

  afterAll(async () => {
    if (browser) await browser.close();
    stopServer(server);
    cleanupTempConfigDir(tempDir);
  });

  it('shows the monolith Core, splits a service, moves a domain and draws a link', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.waitForSelector('body[data-designer-ready="true"]');
    await clickInPanels(page, '#load-sample-btn');
    await page.click('#tab-architecture-btn');
    await page.waitForSelector('.architecture-service-core');
    const coreText = await page.$eval('.architecture-service-core', (el) => el.textContent || '');
    expect(coreText).toContain('Core');
    await page.fill('#architecture-service-name-input', 'Billing');
    await page.click('#architecture-add-service-btn');
    await page.waitForSelector('.architecture-service-domain');
    const serviceCount = await page.$$eval('.architecture-service', (nodes) => nodes.length);
    expect(serviceCount).toBeGreaterThan(1);
    const domainId = await page.$eval('.architecture-domain-chip', (el) => (el as HTMLElement).dataset.domainId || '');
    await page.selectOption('#architecture-inspect-domain', domainId);
    await page.click('.architecture-service-domain');
    await page.click('#architecture-move-domain-btn');
    await page.selectOption('#architecture-link-protocol', 'rest');
    await page.click('#architecture-add-link-btn');
    const linkCount = await page.$eval('#architecture-link-list', (el) => el.children.length);
    expect(linkCount).toBeGreaterThan(0);
    await context.close();
  }, 90000);

  it('renders sample operations in the OpenAPI tab', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.waitForSelector('body[data-designer-ready="true"]');
    await clickInPanels(page, '#load-sample-btn');
    await page.click('#tab-openapi-btn');
    await page.waitForSelector('#openapi-service-select');
    const options = await page.$$eval('#openapi-service-select option', (nodes) => nodes.map((node) => (node as HTMLOptionElement).value));
    expect(options).toContain('merged');
    expect(options).toContain('core');
    await context.close();
  }, 90000);
});
