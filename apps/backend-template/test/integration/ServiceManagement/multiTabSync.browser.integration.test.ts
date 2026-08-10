/* eslint-disable jest/prefer-expect-assertions, jest/no-conditional-in-test, jest/max-expects */
/*
 * JUM-485 — multi-tab write-event sync, run in a REAL browser (Playwright
 * WebKit, the engine this repository already pins) against the REAL server
 * serving the REAL vendored Cana bundle. No DOM shims, no fakes
 * (Requirement 115): two pages share ONE browsing context, which is the
 * two-tab topology the feature exists for — same origin, same real IndexedDB
 * (the real Cana store), same real BroadcastChannel.
 *
 * Pins:
 *  - A write in page A converges page B on the same model through the real
 *    Cana client's ordered write events bridged over the real channel — and
 *    the converse direction converges too.
 *  - The receiving tab announces the remote change through the status region
 *    (the JUM-543 surface), never alert().
 *  - A pending local edit (an unsaved, focused form input) survives the
 *    remote re-render with its value, caret surface and focus intact —
 *    question 2 of the issue, proven against the real DOM.
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

/** Wait until the page's domain list renders the given domain name. */
async function waitForDomain(page: Page, name: string) {
  await page.waitForFunction(
    (expected) => {
      const list = document.getElementById('domain-list');
      return Boolean(list && list.textContent && list.textContent.includes(String(expected)));
    },
    name,
    { timeout: 20000 }
  );
}

/** Wait until the status region announces a remote change. */
async function waitForRemoteChangeStatus(page: Page) {
  await page.waitForFunction(
    () => {
      const region = document.getElementById('status-region');
      return Boolean(region && !region.hidden && region.textContent
        && region.textContent.includes('change from another tab'));
    },
    undefined,
    { timeout: 20000 }
  );
}

/**
 * Boot a page and wait until the designer has finished its first render AND
 * its first-run save is durable in the real IndexedDB. Since JUM-548 the
 * first run boots to an intentionally EMPTY model (guided empty states
 * instead of a pre-populated template), so the settle marker is the guided
 * empty state, not a seeded domain list. The durability wait is what makes
 * the suite's later writes safe to order: page B's boot save has committed
 * before page A's sample load is dispatched, so last-writer-wins can never
 * resurrect B's empty boot document over A's sample.
 */
async function bootPage(context: Awaited<ReturnType<Browser['newContext']>>, baseUrl: string) {
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.waitForSelector('#domain-designer-empty-state:not([hidden])', { timeout: 20000 });
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
    { polling: 250, timeout: 20000 }
  );
  return page;
}

/**
 * Establish a shared model through the sync engine itself: page A loads the
 * JUM-548 sample (the one-action loader) and page B converges on it over the
 * real channel — the sample load doubles as the suite's first sync proof.
 */
async function loadSampleAndConverge(pageA: Page, pageB: Page) {
  await pageA.click('#load-sample-btn');
  await waitForDomain(pageA, 'Users');
  await waitForDomain(pageB, 'Users');
  await waitForRemoteChangeStatus(pageB);
}

/** Add a domain through the real UI (the same gesture a user makes). */
async function addDomain(page: Page, name: string) {
  await page.fill('#domain-name-input', name);
  await page.click('#add-domain-btn');
}

describe('serviceManagement multi-tab write-event sync (JUM-485)', () => {
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

  it('converges two tabs on the same state after concurrent edits, announced via the status region', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const pageA = await bootPage(context, baseUrl);
    const pageB = await bootPage(context, baseUrl);
    await loadSampleAndConverge(pageA, pageB);

    // A writes; B converges and is told through the status region.
    await addDomain(pageA, 'Alpha Remote');
    await waitForDomain(pageA, 'Alpha Remote');
    await waitForDomain(pageB, 'Alpha Remote');
    await waitForRemoteChangeStatus(pageB);

    // B writes; A converges — the channel works in both directions.
    await addDomain(pageB, 'Beta Remote');
    await waitForDomain(pageA, 'Beta Remote');
    await waitForRemoteChangeStatus(pageA);

    // Both tabs render the SAME domain set: convergence, not divergence.
    const domainsA = await pageA.$eval('#domain-list', (el) => el.textContent || '');
    const domainsB = await pageB.$eval('#domain-list', (el) => el.textContent || '');
    expect(domainsA).toBe(domainsB);
    expect(domainsA).toContain('Alpha Remote');
    expect(domainsA).toContain('Beta Remote');
    await context.close();
  }, 120000);

  it('a pending local edit survives a remote apply with its value and focus intact (question 2)', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const pageA = await bootPage(context, baseUrl);
    const pageB = await bootPage(context, baseUrl);
    await loadSampleAndConverge(pageA, pageB);

    // Remote applies never import the selection (JUM-485 question 3), so B
    // selects the sample domain through the real UI — the same gesture a
    // human makes — before its context form enables.
    await pageB.click('#domain-list li button');

    // B is mid-form: an unsaved value sits, focused, in the owner-team input.
    await pageB.click('#domain-owner-team-input');
    await pageB.fill('#domain-owner-team-input', 'team-z-unsaved');

    // A remote change touches the same model B is editing.
    await addDomain(pageA, 'Gamma Remote');
    await waitForDomain(pageB, 'Gamma Remote');
    await waitForRemoteChangeStatus(pageB);

    // The unsaved input value and the focus survived the remote re-render.
    const preserved = await pageB.$eval('#domain-owner-team-input', (el) => ({
      value: (el as HTMLInputElement).value,
      focused: document.activeElement === el
    }));
    expect(preserved.value).toBe('team-z-unsaved');
    expect(preserved.focused).toBe(true);
    await context.close();
  }, 120000);
});
