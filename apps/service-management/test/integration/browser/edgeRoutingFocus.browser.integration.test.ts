/* eslint-disable jest/prefer-expect-assertions, jest/max-expects, no-await-in-loop */
/* eslint-disable jest/no-conditional-in-test, jest/no-conditional-expect */
/*
 * JUM-918 — collision-free edge corridors + soft-peer focus acceptance.
 * Real Playwright WebKit against the real service-management server.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { webkit } from 'playwright-webkit';
import type { Browser, Page } from 'playwright-webkit';
import {
  createTempConfigDir,
  cleanupTempConfigDir,
  envFileContent,
  startServer,
  stopServer,
  waitForServer,
  openDesignerPanels
} from '../../helpers/serverHarness';
import type { StartedServer } from '../../helpers/serverHarness';

const repoRoot = path.resolve(__dirname, '../../../../..');
const artifactsDir = path.resolve(
  __dirname,
  '../../artifacts/edge-ux-playwright'
);

type MidInsideReport = {
  totalHits: number;
  byRelationship: Array<{ id: string; hits: number; pathLen: number }>;
  ghostVerticalCount: number;
  stagedAwayVisible: number;
  softPeerEntityCount: number;
  usersEntityDomCount: number;
  usersLabel: string;
  fieldFocusOk: boolean;
  shellVersion: string;
  scope: string;
  focusKind: string;
};

function collectMidInsideReport(): MidInsideReport {
  const inset = 4;
  const entityBoxes = Array.from(document.querySelectorAll<HTMLElement>('.canvas .entity[data-entity-id]'))
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        id: node.dataset.entityId || '',
        left: rect.left + inset,
        top: rect.top + inset,
        right: rect.right - inset,
        bottom: rect.bottom - inset
      };
    });

  const midInsideForPath = (edgePath: SVGPathElement) => {
    const length = edgePath.getTotalLength();
    if (!(length > 0)) return 0;
    const ctm = edgePath.getScreenCTM();
    if (!ctm) return 0;
    let hits = 0;
    for (let step = 1; step <= 10; step += 1) {
      const t = 0.08 + (0.84 * step) / 11;
      const local = edgePath.getPointAtLength(length * t);
      const screenX = ctm.a * local.x + ctm.c * local.y + ctm.e;
      const screenY = ctm.b * local.x + ctm.d * local.y + ctm.f;
      const inside = entityBoxes.some((box) => (
        screenX > box.left
        && screenX < box.right
        && screenY > box.top
        && screenY < box.bottom
      ));
      hits += inside ? 1 : 0;
    }
    return hits;
  };

  const byRelationship: MidInsideReport['byRelationship'] = [];
  let totalHits = 0;
  let ghostVerticalCount = 0;
  document.querySelectorAll<SVGPathElement>('.edges .edge-line[data-relationship-id]').forEach((edgePath) => {
    const id = edgePath.dataset.relationshipId || '';
    const d = edgePath.getAttribute('d') || '';
    const pathLen = (d.match(/[MLCQ]/g) || []).length;
    const hits = midInsideForPath(edgePath);
    totalHits += hits;
    byRelationship.push({ id, hits, pathLen });
    const nums = (d.match(/-?\d+(\.\d+)?/g) || []).map(Number);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < nums.length; i += 2) xs.push(nums[i]);
    for (let i = 1; i < nums.length; i += 2) ys.push(nums[i]);
    if (xs.length >= 2 && ys.length >= 2) {
      const xSpan = Math.max(...xs) - Math.min(...xs);
      const ySpan = Math.max(...ys) - Math.min(...ys);
      if (xSpan < 28 && ySpan > 140) ghostVerticalCount += 1;
    }
  });

  const canvas = document.getElementById('canvas');
  const staged = Array.from(document.querySelectorAll<HTMLElement>('.domain.is-staged-away'));
  const stagedAwayVisible = staged.filter((node) => {
    const style = window.getComputedStyle(node);
    return style.visibility !== 'hidden' && Number.parseFloat(style.opacity || '1') > 0.05;
  }).length;

  const usersDomain = Array.from(document.querySelectorAll<HTMLElement>('.domain[data-domain-id]'))
    .find((node) => (node.querySelector('.domain-title')?.textContent || '') === 'Users');
  const usersEntityDomCount = usersDomain
    ? usersDomain.querySelectorAll('.entity[data-entity-id]').length
    : 0;
  const usersLabel = usersDomain?.querySelector('.entity-count')?.textContent || '';
  const softPeerEntityCount = document.querySelectorAll('.entity.is-soft, .entity.is-edge-endpoint').length;

  const scope = document.getElementById('canvas-scope-path')?.textContent || '';
  const fieldFocusOk = /assigneeId/i.test(scope)
    || canvas?.dataset.focusKind === 'field'
    || Boolean(document.querySelector('.entity-field-row.is-selected[data-field-name="assigneeId"]'));

  const shellScript = document.querySelector('script[src*="script.js?v="]') as HTMLScriptElement | null;
  const shellVersion = shellScript?.src.match(/v=([\d.]+)/)?.[1] || 'unknown';

  return {
    totalHits,
    byRelationship: byRelationship.sort((left, right) => right.hits - left.hits),
    ghostVerticalCount,
    stagedAwayVisible,
    softPeerEntityCount,
    usersEntityDomCount,
    usersLabel,
    fieldFocusOk,
    shellVersion,
    scope,
    focusKind: canvas?.dataset.focusKind || 'none'
  };
}

async function hardReloadShell(page: Page, baseUrl: string) {
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
    if (window.caches?.keys) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  });
  await page.reload({ waitUntil: 'load' });
}

describe('serviceManagement edge routing + focus (JUM-918)', () => {
  let tempDir: string;
  let server: StartedServer | undefined;
  let browser: Browser | undefined;
  let baseUrl: string;

  beforeAll(async () => {
    execFileSync('bun', ['apps/service-management/scripts/sync-service-management-cana-bundle.js'], {
      cwd: repoRoot,
      stdio: 'inherit'
    });
    tempDir = createTempConfigDir({ '.env.dev': envFileContent('express') });
    server = await startServer(tempDir);
    await waitForServer(server.port);
    baseUrl = `http://127.0.0.1:${String(server.port)}/`;
    browser = await webkit.launch({ headless: true });
    fs.mkdirSync(artifactsDir, { recursive: true });
  }, 90000);

  afterAll(async () => {
    if (browser) await browser.close();
    stopServer(server);
    cleanupTempConfigDir(tempDir);
  });

  it('keeps Project↔Task and cross-domain corridors midInside===0 with clean staging', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await hardReloadShell(page, baseUrl);
    await page.click('#domain-designer-empty-load-sample-btn');
    await page.waitForSelector('.canvas .entity', { timeout: 15000 });
    await page.waitForTimeout(600);

    await page.screenshot({
      path: path.join(artifactsDir, '30-test-overview-midInside.png'),
      fullPage: false
    });

    await openDesignerPanels(page, '#domain-list');
    await page
      .locator('#domain-list .domain-tree-entity')
      .filter({ hasText: 'Task' })
      .locator('button')
      .first()
      .click();
    await page.waitForTimeout(700);
    // Camera3 may leave the row off-screen; dispatch in-page (Playwright viewport click fails).
    await page.evaluate(() => {
      const row = document.querySelector('.entity-field-row[data-field-name="assigneeId"]') as HTMLElement | null;
      row?.scrollIntoView({ block: 'center', inline: 'center' });
      row?.click();
    });
    await page.waitForTimeout(900);
    await page.screenshot({
      path: path.join(artifactsDir, '32-test-field-assigneeId.png'),
      fullPage: false
    });
    const report = await page.evaluate(collectMidInsideReport);

    expect(report.shellVersion).toBe('0.9.128');
    expect(report.totalHits).toBe(0);
    expect(report.byRelationship.some((entry) => entry.pathLen >= 2)).toBe(true);
    expect(report.fieldFocusOk).toBe(true);
    expect(report.stagedAwayVisible).toBe(0);
    expect(report.usersEntityDomCount).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(
      `[JUM-918 CDP] midInside totalHits=${String(report.totalHits)} `
        + `ghostVerticals=${String(report.ghostVerticalCount)} `
        + `shell=${report.shellVersion} fieldFocusOk=${String(report.fieldFocusOk)} `
        + `usersEntityDom=${String(report.usersEntityDomCount)} `
        + `stagedAwayVisible=${String(report.stagedAwayVisible)} edges=${String(report.byRelationship.length)}`
    );
    await context.close();
  }, 90000);

  it('keeps Users soft peers mounted on Tasks domain focus (no empty-chip gutter)', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await hardReloadShell(page, baseUrl);
    await page.click('#domain-designer-empty-load-sample-btn');
    await page.waitForSelector('.canvas .entity', { timeout: 15000 });
    await page.waitForTimeout(500);

    await openDesignerPanels(page, '#domain-list');
    await page.locator('#domain-list .domain-tree-domain', { hasText: 'Tasks' }).first().click();
    await page.waitForTimeout(1100);

    await page.screenshot({
      path: path.join(artifactsDir, '31-test-domain-tasks-soft-peers.png'),
      fullPage: false
    });

    const scene = await page.evaluate(collectMidInsideReport);
    // eslint-disable-next-line no-console
    console.log(
      `[JUM-918 soft-peer] midInside totalHits=${String(scene.totalHits)} `
        + `ghostVerticals=${String(scene.ghostVerticalCount)} `
        + `usersEntityDom=${String(scene.usersEntityDomCount)} `
        + `usersLabel="${scene.usersLabel}" softPeers=${String(scene.softPeerEntityCount)} `
        + `focus=${scene.focusKind} scope="${scene.scope}"`
    );

    expect(scene.shellVersion).toBe('0.9.128');
    expect(scene.focusKind).toBe('domain');
    expect(scene.usersEntityDomCount).toBeGreaterThan(0);
    expect(scene.usersLabel).toMatch(/soft peer/i);
    expect(scene.usersLabel).not.toMatch(/0 entities/i);
    expect(scene.totalHits).toBe(0);
    expect(scene.ghostVerticalCount).toBeLessThanOrEqual(2);
    expect(scene.stagedAwayVisible).toBe(0);
    await context.close();
  }, 90000);
});
