/* eslint-disable @typescript-eslint/no-var-requires, no-await-in-loop */
/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test, jest/max-expects */
/*
 * JUM-489 — PWA shell contract, run against the REAL server and (for the
 * behavioural half) in a REAL browser (Playwright WebKit, the engine this
 * repository already pins for browser runs). No fakes (Requirement 115).
 *
 * Pins:
 *  - The web app manifest is served as `application/manifest+json` and
 *    carries the installability fields; `sw.js` is served as JavaScript (a
 *    classic worker is rejected on any other type).
 *  - JUM-463 alignment, dynamic half: every entry of the service worker's
 *    precache list is served by the server's static manifest — the two must
 *    never disagree about what the shell is.
 *  - The page registers the worker and precaches the shell under the
 *    VERSIONED cache name.
 *  - The shell loads with the network disabled (app-shell cache only).
 *  - The update flow: a shipped update (a changed sw.js) reaches the
 *    installed client through the user-visible prompt — no silent swap — and
 *    activating it cleans the stale versioned cache.
 *
 * The update-flow test temporarily rewrites `sw.js` ON DISK (the dev server
 * re-reads file content per request, so no restart is needed) and always
 * restores the original content, the same discipline as the JUM-463
 * late-file smoke in staticServing.integration.test.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { webkit } from 'playwright-webkit';
import type { Browser } from 'playwright-webkit';
import {
  createTempConfigDir,
  cleanupTempConfigDir,
  envFileContent,
  requestRaw,
  startServer,
  staticRoot,
  stopServer,
  waitForServer
} from '../../helpers/serverHarness';
import type { StartedServer } from '../../helpers/serverHarness';

const serviceWorker = require(path.join(staticRoot, 'sw.js'));

const ORIGINAL_CACHE_NAME = serviceWorker.SHELL_CACHE_NAME as string;
const UPDATED_VERSION = '99.99.99';
const UPDATED_CACHE_NAME = `${serviceWorker.SHELL_CACHE_PREFIX as string}${UPDATED_VERSION}`;

const swFilePath = path.join(staticRoot, 'sw.js');

/** Rewrites sw.js on disk with a bumped SHELL_VERSION; returns the original. */
function bumpServiceWorkerVersionOnDisk(): string {
  const original = fs.readFileSync(swFilePath, 'utf8');
  const updated = original.replace(
    /SHELL_VERSION = '[^']+'/,
    `SHELL_VERSION = '${UPDATED_VERSION}'`
  );
  if (updated === original) {
    throw new Error('sw.js did not contain a replaceable SHELL_VERSION assignment');
  }
  fs.writeFileSync(swFilePath, updated, 'utf8');
  return original;
}

describe('serviceManagement PWA shell (JUM-489)', () => {
  let tempDir: string;
  let server: StartedServer | undefined;
  let browser: Browser | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    // The precache list includes the vendored Cana bundle (JUM-484): it is
    // gitignored and generated, so regenerate it before booting — the
    // precache-agreement test requests every entry against the real server,
    // and a missing bundle must fail the suite, not quietly 404.
    execFileSync('bun', ['apps/service-management/scripts/sync-service-management-cana-bundle.js'], {
      cwd: process.cwd(),
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

  it('serves the manifest and the classic worker with their content types', async () => {
    expect.hasAssertions();

    const manifest = await requestRaw(server!.port, 'GET', '/manifest.webmanifest');
    expect(manifest.status).toBe(200);
    expect(manifest.headers['content-type']).toContain('application/manifest+json');
    const parsed = JSON.parse(manifest.rawBody) as {
      name: string;
      short_name: string;
      start_url: string;
      display: string;
      theme_color: string;
      icons: Array<{ src: string; sizes: string; type: string }>;
    };
    expect(parsed.name).toBeTruthy();
    expect(parsed.short_name).toBeTruthy();
    expect(parsed.start_url).toBe('./');
    expect(parsed.display).toBe('standalone');
    expect(parsed.theme_color).toBeTruthy();
    expect(parsed.icons.some((icon) => icon.sizes === '192x192')).toBe(true);
    expect(parsed.icons.some((icon) => icon.sizes === '512x512')).toBe(true);

    const worker = await requestRaw(server!.port, 'GET', '/sw.js');
    expect(worker.status).toBe(200);
    expect(worker.headers['content-type']).toContain('javascript');
  });

  it('serves every precached shell asset (JUM-463 alignment, dynamic half)', async () => {
    expect.hasAssertions();
    const assets = serviceWorker.SHELL_ASSETS as string[];
    expect(assets.length).toBeGreaterThan(10);
    for (const asset of assets) {
      const urlPath = asset === './' ? '/' : `/${asset.replace('./', '')}`;
      const res = await requestRaw(server!.port, 'GET', urlPath);
      expect(`${urlPath} -> ${String(res.status)}`).toBe(`${urlPath} -> 200`);
    }
  });

  it('registers the worker and precaches the shell under the versioned cache name', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    try {
      await page.goto(baseUrl, { waitUntil: 'load' });
      await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

      const cacheNames: string[] = await page.evaluate(() => window.caches.keys());
      expect(cacheNames).toStrictEqual([ORIGINAL_CACHE_NAME]);

      const precachedCount: number = await page.evaluate(async (cacheName) => {
        const cache = await window.caches.open(cacheName);
        const requests = await cache.keys();
        return requests.length;
      }, ORIGINAL_CACHE_NAME);
      expect(precachedCount).toBe((serviceWorker.SHELL_ASSETS as string[]).length);
    } finally {
      await context.close();
    }
  }, 60000);

  it('loads the shell with the network disabled (app-shell cache only)', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    try {
      await page.goto(baseUrl, { waitUntil: 'load' });
      await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
      // Let the first load's precache settle, so the reload below can only
      // come from the shell cache.
      await page.waitForFunction(
        (cacheName) => window.caches.keys().then((keys) => keys.includes(cacheName)),
        ORIGINAL_CACHE_NAME
      );

      // Simulated offline by killing the server: the network is genuinely
      // unreachable, not emulated (Playwright WebKit's setOffline breaks
      // navigations outright, which would test the emulator, not the shell).
      stopServer(server);
      server = undefined;

      await page.reload({ waitUntil: 'load' });

      const heading = await page.$eval('.service-management-header h1', (el) => el.textContent);
      expect(heading).toContain('Service Management');

      // The shell is fully interactive offline: tab switching is pure shell JS.
      await page.click('#tab-service-config-btn');
      const configActive = await page.$eval('#tab-service-config', (el) => el.classList.contains('active'));
      expect(configActive).toBe(true);
    } finally {
      await context.close();
      // Restart for the suites that follow: the server is shared per file.
      if (!server) {
        server = await startServer(tempDir);
        await waitForServer(server.port);
        baseUrl = `http://127.0.0.1:${String(server.port)}/`;
      }
    }
  }, 60000);

  it('delivers a shipped update through the prompt — no silent swap — and cleans stale caches', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    let originalWorkerSource: string | null = null;
    try {
      await page.goto(baseUrl, { waitUntil: 'load' });
      await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
      await page.waitForFunction(
        (cacheName) => window.caches.keys().then((keys) => keys.includes(cacheName)),
        ORIGINAL_CACHE_NAME
      );
      // Reload marker: proves the page did NOT reload until the user accepted.
      await page.evaluate(() => {
        (window as unknown as { __pwaUpdateMarker: number }).__pwaUpdateMarker = 1;
      });

      // Ship an update: sw.js on disk now carries a new SHELL_VERSION.
      originalWorkerSource = bumpServiceWorkerVersionOnDisk();
      await page.evaluate(() => navigator.serviceWorker.getRegistration()
        .then((registration) => registration?.update()));

      // The update flow must surface the prompt instead of swapping silently.
      await page.waitForSelector('#pwa-update-banner', { state: 'visible', timeout: 30000 });
      const bannerText = await page.$eval('#pwa-update-banner', (el) => el.textContent || '');
      expect(bannerText).toContain('new version');

      const markerBefore = await page.evaluate(
        () => (window as unknown as { __pwaUpdateMarker?: number }).__pwaUpdateMarker
      );
      expect(markerBefore).toBe(1);
      // The waiting worker has already precached its own version (install
      // runs before the prompt), but the OLD cache is still there serving the
      // page — nothing was swapped under the edit session.
      let cacheNames: string[] = await page.evaluate(() => window.caches.keys());
      expect([...cacheNames].sort()).toStrictEqual(
        [ORIGINAL_CACHE_NAME, UPDATED_CACHE_NAME].sort()
      );

      // Accept the update: SKIP_WAITING -> activate -> claim -> reload.
      const reloaded = page.waitForEvent('load', { timeout: 30000 });
      await page.click('#pwa-update-banner .pwa-update-banner-btn-reload');
      await reloaded;

      // The new versioned cache is the ONLY shell cache: activation cleanup ran.
      cacheNames = await page.evaluate(() => window.caches.keys());
      expect(cacheNames).toStrictEqual([UPDATED_CACHE_NAME]);
      const markerAfter = await page.evaluate(
        () => (window as unknown as { __pwaUpdateMarker?: number }).__pwaUpdateMarker
      );
      expect(markerAfter).toBeUndefined();
    } finally {
      if (originalWorkerSource !== null) {
        fs.writeFileSync(swFilePath, originalWorkerSource, 'utf8');
      }
      await context.close();
    }
  }, 90000);
});
