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
} from '../../helpers/serverHarness';
import type { StartedServer } from '../../helpers/serverHarness';

const repoRoot = path.resolve(__dirname, '../../../../..');

describe('architecture designer and swagger tab (JUM-819)', () => {
  let tempDir: string;
  let server: StartedServer | undefined;
  let browser: Browser | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    execFileSync('bun', ['apps/service-management/scripts/sync-service-management-cana-bundle.js'], { cwd: repoRoot, stdio: 'inherit' });
    execFileSync('bun', ['apps/service-management/scripts/sync-service-management-designer-core.js'], { cwd: repoRoot, stdio: 'inherit' });
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

  it('shows first-run CTAs, then splits a service, moves a domain and draws a link', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    await page.goto(`${baseUrl}#architecture`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-designer-ready="true"]');
    // Fresh profiles seed the backend-template model (Users + Core). If the
    // empty CTA is still showing (no domains), load the backend seed first.
    const emptyVisible = await page.$eval(
      '#architecture-empty-state',
      (el) => !(el as HTMLElement).hidden
    ).catch(() => false);
    if (emptyVisible) {
      await page.click('#architecture-empty-load-sample-btn');
    }
    await page.waitForSelector('.architecture-service-core');
    const coreText = await page.$eval('.architecture-service-core', (el) => el.textContent || '');
    expect(coreText).toContain('Core');
    // Rail defaults contracted — open Panels before Services create controls.
    const railOpen = await page.$eval(
      '#architecture-sidebar',
      (el) => el.classList.contains('open')
    );
    if (!railOpen) {
      await page.click('#architecture-toggle-sidebar-btn');
    }
    await page.click('#architecture-tab-services-btn');
    await page.fill('#architecture-service-name-input', 'Billing');
    await page.click('#architecture-add-service-btn');
    await page.waitForSelector('.architecture-service-domain');
    const serviceCount = await page.$$eval('.architecture-service', (nodes) => nodes.length);
    expect(serviceCount).toBeGreaterThan(1);
    // Billing is selected after create — Domains palette click pulls a Core-hosted domain here.
    await page.click('#architecture-tab-domains-btn');
    await page.waitForSelector('.architecture-palette-item.is-elsewhere');
    await page.click('.architecture-palette-item.is-elsewhere');
    await page.waitForSelector('.architecture-service-domain .architecture-domain-chip');
    await page.selectOption('#architecture-link-protocol', 'rest');
    await page.click('#architecture-connect-btn');
    await page.click('.architecture-service-core');
    await page.click('.architecture-service-domain');
    await page.click('#architecture-tab-links-btn');
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
    page.once('dialog', (dialog) => {
      dialog.accept().catch(() => {});
    });
    await clickInPanels(page, '#load-sample-btn');
    await page.click('#tab-openapi-btn');
    await page.waitForSelector('#openapi-service-select');
    const options = await page.$$eval('#openapi-service-select option', (nodes) => nodes.map((node) => (node as HTMLOptionElement).value));
    expect(options).toContain('merged');
    expect(options).toContain('core');
    await context.close();
  }, 90000);
});
