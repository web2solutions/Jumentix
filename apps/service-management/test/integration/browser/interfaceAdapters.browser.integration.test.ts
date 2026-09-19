/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test */
/* eslint-disable jest/max-expects */
/*
 * JUM-545 — Communication Interface Designer adapter lifecycle, run in a
 * REAL browser (Playwright WebKit, the engine this repository already pins
 * for browser runs) against the REAL server. No DOM shims, no fakes
 * (Requirement 115).
 *
 * Pins:
 *  - The framework select is scoped per interface type from the canonical
 *    runtime matrix (11 HTTP frameworks for http-rest, socket-io only for
 *    WebSocket) — the free-text field is gone.
 *  - Duplicates (same type + entrypoint / same controller mapping) are
 *    rejected with the reason on the JUM-543 status surface, and the
 *    registered list is left untouched.
 *  - A registered adapter edits in place: the save goes through the same
 *    validation gate, an invalid save is refused and announced, a valid save
 *    replaces the entry without delete-and-re-add.
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
} from '../../helpers/serverHarness';
import type { StartedServer } from '../../helpers/serverHarness';

const HTTP_FRAMEWORKS = [
  'express', 'fastify', 'restify', 'cloudflare-workers', 'vercel-functions',
  'loopback', 'sails-js', 'feathers', 'derby-js', 'adonis-js', 'total-js'
];

describe('serviceManagement interface adapter lifecycle (JUM-545)', () => {
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

  it('scopes framework options per interface type from the canonical matrix', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(String(error)));

    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.click('#tab-interface-designer-btn');

    const httpOptions = await page.$$eval(
      '#interface-framework-select option',
      (options) => options.map((option) => (option as HTMLOptionElement).value)
    );
    expect(httpOptions).toStrictEqual(HTTP_FRAMEWORKS);
    expect(httpOptions).not.toContain('derby');
    expect(httpOptions).not.toContain('sails');

    await page.selectOption('#interface-type-select', 'websocket');
    const websocketOptions = await page.$$eval(
      '#interface-framework-select option',
      (options) => options.map((option) => (option as HTMLOptionElement).value)
    );
    expect(websocketOptions).toStrictEqual(['socket-io']);

    await page.selectOption('#interface-type-select', 'grpc');
    const grpcOptions = await page.$$eval(
      '#interface-framework-select option',
      (options) => options.map((option) => (option as HTMLOptionElement).value)
    );
    expect(grpcOptions).toStrictEqual(['grpc']);

    expect(consoleErrors).toStrictEqual([]);
    await context.close();
  }, 60000);

  it('adds, rejects duplicates with the reason, and edits adapters in place', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(String(error)));

    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.click('#tab-interface-designer-btn');

    // Add a valid adapter.
    await page.selectOption('#interface-framework-select', 'fastify');
    await page.fill('#interface-entrypoint-input', 'src/interface/HTTP/server.ts');
    await page.fill('#interface-controller-input', 'UsersController.create');
    await page.click('#add-interface-adapter-btn');
    const listSummary = () => page.$eval('#interface-adapter-list', (el) => el.textContent || '');
    await expect(listSummary()).resolves.toContain(
      'http-rest | fastify | src/interface/HTTP/server.ts -> UsersController.create'
    );

    // Duplicate type + entrypoint: refused, reason on the status surface.
    await page.fill('#interface-entrypoint-input', 'src/interface/HTTP/server.ts');
    await page.fill('#interface-controller-input', 'UsersController.list');
    await page.click('#add-interface-adapter-btn');
    const status = () => page.$eval('#status-region', (el) => ({
      hidden: (el as HTMLElement).hidden,
      text: el.textContent || ''
    }));
    let currentStatus = await status();
    expect(currentStatus.hidden).toBe(false);
    expect(currentStatus.text).toContain(
      'Duplicate adapter: interface type "http-rest" is already registered at entrypoint "src/interface/HTTP/server.ts".'
    );
    await expect(page.$$eval('#interface-adapter-list li', (items) => items.length)).resolves.toBe(1);

    // Duplicate controller mapping: refused too, with its own reason.
    await page.fill('#interface-entrypoint-input', 'src/interface/HTTP/other-server.ts');
    await page.fill('#interface-controller-input', 'UsersController.create');
    await page.click('#add-interface-adapter-btn');
    currentStatus = await status();
    expect(currentStatus.text).toContain(
      'Duplicate controller mapping "UsersController.create" — another adapter already maps it.'
    );
    await expect(page.$$eval('#interface-adapter-list li', (items) => items.length)).resolves.toBe(1);

    // Off-shape controller mapping on the add gate: refused with the shape.
    await page.fill('#interface-entrypoint-input', 'src/interface/HTTP/other-server.ts');
    await page.fill('#interface-controller-input', 'userscontroller');
    await page.click('#add-interface-adapter-btn');
    currentStatus = await status();
    expect(currentStatus.text).toContain(
      'Controller mapping "userscontroller" must have the shape XController.action (e.g. UsersController.create).'
    );
    await expect(page.$$eval('#interface-adapter-list li', (items) => items.length)).resolves.toBe(1);

    // Edit in place: an invalid save is refused and the entry is untouched.
    await page.locator('#interface-adapter-list li button', { hasText: 'Edit' }).click();
    await expect(page.$('.interface-adapter-editor')).resolves.not.toBeNull();
    await page.fill('.interface-adapter-editor input[aria-label="Edit controller mapping"]', 'broken-mapping');
    await page.locator('.interface-adapter-editor button', { hasText: 'Save' }).click();
    currentStatus = await status();
    expect(currentStatus.text).toContain('must have the shape XController.action');
    await expect(listSummary()).resolves.toContain(
      'http-rest | fastify | src/interface/HTTP/server.ts -> UsersController.create'
    );

    // ...a valid save replaces the entry — no delete-and-re-add.
    await page.fill(
      '.interface-adapter-editor input[aria-label="Edit entrypoint"]',
      'src/interface/HTTP/rest-server.ts'
    );
    await page.fill(
      '.interface-adapter-editor input[aria-label="Edit controller mapping"]',
      'UsersController.list'
    );
    await page.locator('.interface-adapter-editor button', { hasText: 'Save' }).click();
    await expect(page.$$eval('#interface-adapter-list li', (items) => items.length)).resolves.toBe(1);
    await expect(listSummary()).resolves.toContain(
      'http-rest | fastify | src/interface/HTTP/rest-server.ts -> UsersController.list'
    );
    await expect(page.$('.interface-adapter-editor')).resolves.toBeNull();

    expect(consoleErrors).toStrictEqual([]);
    await context.close();
  }, 90000);
});
