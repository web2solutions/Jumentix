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
  clickInPanels,
  openDesignerPanels,
  stopServer,
  waitForServer
} from '../../helpers/serverHarness';
import type { StartedServer } from '../../helpers/serverHarness';

const repoRoot = path.resolve(__dirname, '../../../../..');

/** Wait until the page's domain list renders the given domain name. */
async function waitForDomain(page: Page, name: string) {
  // Parallel browser suites can freeze a background WebKit page so it misses
  // BroadcastChannel traffic; bring it forward and nudge visibility so
  // designerSync.resume() can catch up via Cana read-back.
  const deadline = Date.now() + 45000;
  /* eslint-disable no-await-in-loop -- poll observes resume side effects */
  while (Date.now() < deadline) {
    await page.bringToFront().catch(() => undefined);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible'
      });
      document.dispatchEvent(new Event('visibilitychange'));
    }).catch(() => undefined);
    const found = await page.evaluate((expected) => {
      const list = document.getElementById('domain-list');
      return Boolean(list && list.textContent && list.textContent.includes(String(expected)));
    }, name);
    if (found) return;
    await page.waitForTimeout(400);
  }
  /* eslint-enable no-await-in-loop */
  throw new Error(`waitForDomain timed out for ${name}`);
}

/**
 * Clear the status region before the action whose remote announcement is
 * awaited, so the wait below cannot match an earlier announcement.
 */
async function armRemoteChangeStatus(page: Page) {
  await page.evaluate(() => {
    const region = document.getElementById('status-region');
    if (region) region.textContent = '';
  });
}

/**
 * Wait until the status region announces a remote change.
 *
 * Reads the text, not visibility, and accepts the coalesced plural: the app
 * hides info toasts after 3.2 s on the designer tab and says "N changes from
 * another tab were applied." when writes coalesce — neither is fixed by
 * timing, so requiring a visible singular toast failed under CI load
 * (CircleCI job 7263, JUM-943). On timeout the actual text is reported.
 */
async function waitForRemoteChangeStatus(page: Page) {
  try {
    await page.waitForFunction(
      () => /\bchanges? from another tab\b/.test(document.getElementById('status-region')?.textContent || ''),
      undefined,
      { timeout: 20000 }
    );
  } catch (error) {
    const text = await page.evaluate(() => document.getElementById('status-region')?.textContent || '');
    throw new Error(
      `no remote-change announcement; status region says: ${JSON.stringify(text)} (${String(error)})`
    );
  }
}

/**
 * Boot a page and wait until the designer has finished its first render AND
 * its first-run save is durable in the real IndexedDB. Fresh profiles now seed
 * the backend-template Users domain, so settle on designer-ready plus either
 * the empty CTA or a populated domain list. The durability wait is what makes
 * the suite's later writes safe to order: page B's boot save has committed
 * before page A's sample load is dispatched, so last-writer-wins can never
 * resurrect B's empty boot document over A's sample.
 */
async function bootPage(context: Awaited<ReturnType<Browser['newContext']>>, baseUrl: string) {
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.waitForSelector('body[data-designer-ready="true"]', { timeout: 20000 });
  await page.waitForFunction(
    () => {
      const empty = document.getElementById('domain-designer-empty-state');
      const emptyVisible = Boolean(empty && !empty.hidden);
      const hasDomains = Boolean(document.querySelector('#domain-list li'));
      return emptyVisible || hasDomains;
    },
    undefined,
    { timeout: 20000 }
  );
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
  await armRemoteChangeStatus(pageB);
  // Fresh profiles already seed Users; confirm reload so both tabs converge
  // on an explicit Backend-model write.
  pageA.once('dialog', (dialog) => {
    dialog.accept().catch(() => {});
  });
  await clickInPanels(pageA, '#load-sample-btn');
  await waitForDomain(pageA, 'Users');
  await waitForDomain(pageB, 'Users');
  await waitForRemoteChangeStatus(pageB);
  // Camera/view persist from the sample load must settle before either tab
  // writes again, or last-writer-wins can drop a peer's domain under load.
  await pageA.waitForTimeout(750);
  await pageB.waitForTimeout(750);
}

/** Add a domain through the real UI (the same gesture a user makes). */
async function addDomain(page: Page, name: string) {
  // Exclusive Structure create: Domain toolbar only when selection is none.
  // Do clear + fill + submit in one page turn so a peer sync cannot re-select
  // a domain between fillInPanels and clickInPanels (that hid the create strip
  // and left both tabs without the new name). Peer context autosaves can still
  // re-render mid-gesture under suite load — retry the atomic create.
  /* eslint-disable no-await-in-loop -- retries must observe prior attempts */
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await openDesignerPanels(page, '#domain-name-input');
    const created = await page.evaluate((nextName) => {
      const canvas = document.getElementById('canvas') as HTMLElement | null;
      canvas?.click();
      const toolbar = document.getElementById('domain-create-toolbar') as HTMLElement | null;
      if (toolbar) {
        toolbar.hidden = false;
        toolbar.style.display = '';
        toolbar.classList.remove('is-create-inactive');
        toolbar.setAttribute('aria-hidden', 'false');
      }
      const input = document.getElementById('domain-name-input') as HTMLInputElement | null;
      const btn = document.getElementById('add-domain-btn') as HTMLButtonElement | null;
      if (!input || !btn) return false;
      input.focus();
      input.value = nextName;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      btn.click();
      return true;
    }, name);
    if (!created) throw new Error(`addDomain could not drive create UI for ${name}`);
    const appeared = await page.waitForFunction(
      (expected) => {
        const list = document.getElementById('domain-list');
        return Boolean(list && list.textContent && list.textContent.includes(String(expected)));
      },
      name,
      { timeout: 8000 }
    ).then(() => true).catch(() => false);
    if (appeared) return;
    await page.waitForTimeout(200);
  }
  /* eslint-enable no-await-in-loop */
  await waitForDomain(page, name);
}

describe('serviceManagement multi-tab write-event sync (JUM-485)', () => {
  let tempDir: string;
  let server: StartedServer | undefined;
  let browser: Browser | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    // The SPA resolves `@jumentix/cana` to the vendored bundle; regenerate it
    // so the suite never boots against a stale or absent artifact.
    execFileSync('bun', ['apps/service-management/scripts/sync-service-management-cana-bundle.js'], {
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
    await armRemoteChangeStatus(pageB);
    await addDomain(pageA, 'Alpha Remote');
    await waitForDomain(pageA, 'Alpha Remote');
    await waitForDomain(pageB, 'Alpha Remote');
    await waitForRemoteChangeStatus(pageB);

    // B writes; A converges — the channel works in both directions.
    await armRemoteChangeStatus(pageA);
    await addDomain(pageB, 'Beta Remote');
    await waitForDomain(pageA, 'Beta Remote');
    await waitForRemoteChangeStatus(pageA);

    // Both tabs render the SAME domain set: convergence, not divergence.
    // Compare domain names only — tree expand/collapse differs per tab and
    // must not fail the sync contract. Poll until equal so a late BroadcastChannel
    // apply is not missed between waitForDomain and the one-shot read.
    const domainNames = async (page: Page) => page.$$eval(
      '#domain-list button.domain-tree-domain .domain-tree-name',
      (nodes) => nodes.map((node) => (node.textContent || '').trim()).sort()
    );
    let domainsA = await domainNames(pageA);
    let domainsB = await domainNames(pageB);
    /* eslint-disable no-await-in-loop -- convergence poll observes both tabs */
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const same = JSON.stringify(domainsA) === JSON.stringify(domainsB);
      const hasBoth = domainsA.includes('Alpha Remote') && domainsA.includes('Beta Remote');
      if (same && hasBoth) break;
      await pageA.waitForTimeout(250);
      domainsA = await domainNames(pageA);
      domainsB = await domainNames(pageB);
    }
    /* eslint-enable no-await-in-loop */
    expect(domainsA).toStrictEqual(domainsB);
    expect(domainsA).toStrictEqual(expect.arrayContaining(['Alpha Remote', 'Beta Remote']));
    await context.close();
  }, 120000);

  it('a pending local edit survives a remote apply with its value and focus intact (question 2)', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const pageA = await bootPage(context, baseUrl);
    const pageB = await bootPage(context, baseUrl);
    await loadSampleAndConverge(pageA, pageB);

    // Remote applies never import the selection (JUM-485 question 3). Open the
    // domain rename field (identity pane) without re-clicking an already-focused
    // domain — that reverse-navs to overview and drops the inspector.
    await openDesignerPanels(pageB, '#domain-rename-input');

    // B is mid-form: an unsaved value sits, focused, in the rename input.
    // Skip change/blur — rename/context autosave would write before the remote
    // apply this case is meant to survive.
    const pending = await pageB.evaluate(() => {
      const input = document.getElementById('domain-rename-input') as HTMLInputElement | null;
      if (!input) return false;
      input.focus();
      input.value = 'Users-unsaved';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return document.activeElement === input;
    });
    expect(pending).toBe(true);

    // A remote change touches the same model B is editing.
    // Domain selection persists camera/view through saveState(); wait for that
    // write to settle so it cannot last-writer-wins over A's upcoming Gamma add.
    await pageB.waitForTimeout(750);
    await armRemoteChangeStatus(pageB);
    await addDomain(pageA, 'Gamma Remote');
    await waitForDomain(pageB, 'Gamma Remote');
    await waitForRemoteChangeStatus(pageB);

    // The unsaved input value and the focus survived the remote re-render.
    const preserved = await pageB.$eval('#domain-rename-input', (el) => ({
      value: (el as HTMLInputElement).value,
      focused: document.activeElement === el
    }));
    expect(preserved.value).toBe('Users-unsaved');
    expect(preserved.focused).toBe(true);
    await context.close();
  }, 120000);
});
