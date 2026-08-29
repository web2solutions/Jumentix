/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/*
 * JUM-732 — every control a user can reach computes an accessible name, in a
 * REAL browser against the REAL server (Requirement 115).
 *
 * The defect this pins: the generated field rows created a text input and a
 * type select with no accessible name at all, and three buttons that read
 * "meta", "save" and "x" once per field — a name with no referent. Measured
 * before the fix on the loaded sample: 21 controls with no computed name, 18 of
 * them in those rows. (The other three are the `hidden` file inputs, which are
 * not in the accessibility tree; the first count included them by mistake and
 * this suite does not.)
 *
 * The assertion walks the rendered DOM rather than a fixed list, so a control
 * added later without a name fails here.
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
} from './serverHarness';
import type { StartedServer } from './serverHarness';

const repoRoot = path.resolve(__dirname, '../../../../..');

type UnnamedControl = { tag: string; id: string; type: string };

async function unnamedControls(page: Page): Promise<UnnamedControl[]> {
  return page.$$eval('input, select, textarea, button', (elements) => {
    const isReachable = (element: Element): boolean => {
      const node = element as HTMLElement;
      if (node.hidden) return false;
      if (node.closest('[hidden]')) return false;
      const style = window.getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden';
    };

    const accessibleName = (element: Element): string => {
      const node = element as HTMLInputElement;
      const aria = node.getAttribute('aria-label');
      if (aria && aria.trim()) return aria.trim();
      const labelledBy = node.getAttribute('aria-labelledby');
      if (labelledBy) {
        const referenced = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || '')
          .join(' ')
          .trim();
        if (referenced) return referenced;
      }
      const { labels } = node as unknown as { labels?: NodeListOf<HTMLLabelElement> };
      const firstLabel = labels ? labels[0] : undefined;
      const labelText = firstLabel ? (firstLabel.textContent || '').trim() : '';
      if (labelText) return labelText;
      const title = node.getAttribute('title');
      if (title && title.trim()) return title.trim();
      if (node.tagName === 'BUTTON' && (node.textContent || '').trim()) {
        return (node.textContent || '').trim();
      }
      return '';
    };

    return elements
      .filter(isReachable)
      .filter((element) => !accessibleName(element))
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        id: element.id || '(generated)',
        type: (element as HTMLInputElement).type || ''
      }));
  });
}

async function fieldRowAriaLabels(page: Page): Promise<string[][]> {
  return page.$$eval('#entity-field-list .field-row', (rows) => rows.map((row) => {
    const controls = Array.from(row.querySelectorAll('input, select, button'));
    return controls.map((control) => {
      const label = control.getAttribute('aria-label');
      return label === null ? '' : label;
    });
  }));
}

describe('serviceManagement accessible names (JUM-732)', () => {
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

  it('names every reachable control on a first-run page', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'load' });

    // Wait for the app to finish its boot render rather than sampling an
    // arbitrary instant: the runtime-env fields are generated late, and a CI
    // run read them before they were named while a local run read them after.
    await page.waitForSelector('[id^=runtime-env-field-]', { state: 'attached' });

    await expect(unnamedControls(page)).resolves.toStrictEqual([]);

    await context.close();
  }, 60000);

  it('names every control in the generated field rows', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'load' });

    await page.click('#domain-designer-empty-load-sample-btn');
    await page.waitForTimeout(500);
    await openDesignerPanels(page, '#entity-search-input');
    await page.fill('#entity-search-input', 'User');
    await clickInPanels(page, '#entity-search-btn');
    await page.waitForTimeout(400);

    // The rows are actually there, so an empty result is coverage, not a vacuum.
    const rows = await page.$$('#entity-field-list .field-row');
    expect(rows.length).toBeGreaterThan(0);

    await expect(unnamedControls(page)).resolves.toStrictEqual([]);

    await context.close();
  }, 60000);

  it('names the row controls after the field they belong to', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'load' });

    await page.click('#domain-designer-empty-load-sample-btn');
    await page.waitForTimeout(500);
    await openDesignerPanels(page, '#entity-search-input');
    await page.fill('#entity-search-input', 'User');
    await clickInPanels(page, '#entity-search-btn');
    await page.waitForTimeout(400);

    const names = await fieldRowAriaLabels(page);

    expect(names.length).toBeGreaterThan(0);

    const [firstRow] = names;
    const prefixes = firstRow.map((name) => name.replace(/".*$/, '').trim());

    expect(prefixes).toContain('Name of field');
    expect(prefixes).toContain('Type of field');
    expect(prefixes).toContain('Save field');
    expect(prefixes).toContain('Delete field');

    await context.close();
  }, 60000);
});
