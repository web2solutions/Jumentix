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
  softDomainCount: number;
  softDomainDepthOk: boolean;
  softDomainScale: number;
  softEntityScale: number;
  quietEntityCount: number;
  focusEntityCount: number;
  focusDomainCount: number;
  isFocusTotal: number;
  softHasFocus: boolean;
  focusNearViewportCenter: boolean;
  usersEntityDomCount: number;
  usersLabel: string;
  usersIsSoft: boolean;
  usersClickable: boolean;
  fieldFocusOk: boolean;
  shellVersion: string;
  scope: string;
  focusKind: string;
};

function collectMidInsideReport(): MidInsideReport {
  const readCssScale = (node: Element): number => {
    const transform = window.getComputedStyle(node).transform || '';
    if (!transform || transform === 'none') return 1;
    const matrix = transform.match(/matrix\(([^)]+)\)/);
    if (matrix) {
      const sx = Number.parseFloat(matrix[1].split(',')[0] || '1');
      return Number.isFinite(sx) && sx > 0 ? Math.abs(sx) : 1;
    }
    const scale = transform.match(/scale\(([^)]+)\)/);
    if (scale) {
      const sx = Number.parseFloat(scale[1].split(',')[0] || '1');
      return Number.isFinite(sx) && sx > 0 ? Math.abs(sx) : 1;
    }
    return 1;
  };

  const inset = 4;
  // Quiet depth-2 siblings stay on stage as background; midInside gates the
  // focus card (soft peers are scaled down under corridor tips).
  const entityBoxes = Array.from(
    document.querySelectorAll<HTMLElement>('.canvas .entity[data-entity-id]')
  )
    .filter((node) => (
      node.classList.contains('is-focus')
      || node.dataset.stageDepth === '0'
    ))
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
    if (edgePath.classList.contains('is-quiet') || edgePath.classList.contains('is-staged-away')) {
      return;
    }
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

  const softDomains = Array.from(
    document.querySelectorAll<HTMLElement>('.domain.is-soft, .domain[data-stage-depth="1"]')
  );
  const softDomainCount = softDomains.length;
  let softDomainScale = 1;
  let softDomainDepthOk = false;
  if (softDomains[0]) {
    const style = window.getComputedStyle(softDomains[0]);
    // Soft peers intentionally sit ~0.26 opacity (recessed veil); keep above
    // invisible/zero while still clickable.
    softDomainDepthOk = style.visibility !== 'hidden'
      && Number.parseFloat(style.opacity || '1') > 0.18
      && style.pointerEvents !== 'none';
    softDomainScale = readCssScale(softDomains[0]);
  }

  const softEntity = document.querySelector<HTMLElement>(
    '.entity.is-soft, .entity[data-stage-depth="1"]'
  );
  const softEntityScale = softEntity ? readCssScale(softEntity) : 0;
  const quietEntityCount = document.querySelectorAll(
    '.entity.is-quiet, .entity[data-stage-depth="2"]'
  ).length;
  const focusEntityCount = document.querySelectorAll('.entity.is-focus').length;
  const focusDomainCount = document.querySelectorAll('.domain.is-focus').length;
  const isFocusTotal = document.querySelectorAll('.is-focus').length;
  const softHasFocus = Array.from(
    document.querySelectorAll('.is-soft, .is-quiet')
  ).some((node) => node.classList.contains('is-focus'));
  const focusSubject = document.querySelector<HTMLElement>(
    '.entity.is-focus, .domain.is-focus'
  );
  let focusNearViewportCenter = false;
  if (focusSubject) {
    const rect = focusSubject.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    if (canvasRect) {
      const fx = rect.left + rect.width / 2;
      const fy = rect.top + rect.height / 2;
      const cx = canvasRect.left + canvasRect.width / 2;
      const cy = canvasRect.top + canvasRect.height / 2;
      focusNearViewportCenter = Math.hypot(fx - cx, fy - cy)
        < Math.max(canvasRect.width, canvasRect.height) * 0.42;
    }
  }

  const usersDomain = Array.from(document.querySelectorAll<HTMLElement>('.domain[data-domain-id]'))
    .find((node) => (node.querySelector('.domain-title')?.textContent || '') === 'Users');
  const usersEntityDomCount = usersDomain
    ? usersDomain.querySelectorAll('.entity[data-entity-id]').length
    : 0;
  const usersLabel = usersDomain?.querySelector('.entity-count')?.textContent || '';
  const usersIsSoft = Boolean(
    usersDomain?.classList.contains('is-soft')
    || usersDomain?.dataset.stageDepth === '1'
  );
  const usersClickable = Boolean(
    usersDomain
    && window.getComputedStyle(usersDomain).pointerEvents !== 'none'
    && window.getComputedStyle(usersDomain).visibility !== 'hidden'
  );
  const softPeerEntityCount = document.querySelectorAll('.entity.is-soft').length;

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
    softDomainCount,
    softDomainDepthOk,
    softDomainScale,
    softEntityScale,
    quietEntityCount,
    focusEntityCount,
    focusDomainCount,
    isFocusTotal,
    softHasFocus,
    focusNearViewportCenter,
    usersEntityDomCount,
    usersLabel,
    usersIsSoft,
    usersClickable,
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

/**
 * Wait until Camera3 flight / user-zoom settle and the focus subject is near
 * viewport center. Camera3 arms `navigating` asynchronously after the click, so
 * a bare "not busy" check can return before the flight starts.
 */
async function waitCanvasCameraIdle(page: Page, timeoutMs = 15000) {
  const started = Date.now();
  let sawBusy = false;
  const armUntil = started + 500;
  while (Date.now() - started < timeoutMs) {
    const probe = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      const busy = canvas?.dataset.navigating === 'true'
        || canvas?.dataset.userZooming === 'true';
      const focusSubject = document.querySelector<HTMLElement>(
        '.entity.is-focus, .domain.is-focus'
      );
      let focusNearViewportCenter = false;
      if (focusSubject && canvas) {
        const rect = focusSubject.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        const fx = rect.left + rect.width / 2;
        const fy = rect.top + rect.height / 2;
        const cx = canvasRect.left + canvasRect.width / 2;
        const cy = canvasRect.top + canvasRect.height / 2;
        focusNearViewportCenter = Math.hypot(fx - cx, fy - cy)
          < Math.max(canvasRect.width, canvasRect.height) * 0.42;
      }
      return { busy: Boolean(busy), focusNearViewportCenter };
    });
    if (probe.busy) sawBusy = true;
    const armed = sawBusy || Date.now() >= armUntil;
    if (armed && !probe.busy && probe.focusNearViewportCenter) return;
    await page.waitForTimeout(50);
  }
  throw new Error(`canvas focus not settled near center after ${timeoutMs}ms`);
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
    await page.evaluate(() => {
      const findDomainBtn = () => Array.from(
        document.querySelectorAll('#domain-list button.domain-tree-domain')
      ).find((btn) => (
        (btn.querySelector('.domain-tree-name')?.textContent || '').trim() === 'Tasks'
      ));
      (findDomainBtn() as HTMLElement | undefined)?.click();
      const row = findDomainBtn()?.closest('li');
      const toggle = row?.querySelector('button.domain-tree-toggle') as HTMLButtonElement | null;
      if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
      const buttons = Array.from(document.querySelectorAll('#domain-list .domain-tree-entity button'));
      const match = buttons.find((btn) => (
        (btn.querySelector('.domain-tree-name')?.textContent || '').trim() === 'Task'
      ));
      match?.scrollIntoView({ block: 'center' });
      (match as HTMLElement | undefined)?.click();
    });
    await page.waitForTimeout(700);
    // Camera3 may leave the row off-screen; dispatch in-page (Playwright viewport click fails).
    await page.evaluate(() => {
      const row = document.querySelector('.entity-field-row[data-field-name="assigneeId"]') as HTMLElement | null;
      row?.scrollIntoView({ block: 'center', inline: 'center' });
      row?.click();
    });
    await waitCanvasCameraIdle(page);
    await page.screenshot({
      path: path.join(artifactsDir, '32-test-field-assigneeId.png'),
      fullPage: false
    });
    const report = await page.evaluate(collectMidInsideReport);

    expect(report.shellVersion).toBe('0.9.148');
    expect(report.totalHits).toBe(0);
    expect(report.byRelationship.some((entry) => entry.pathLen >= 2)).toBe(true);
    expect(report.fieldFocusOk).toBe(true);
    expect(report.stagedAwayVisible).toBe(0);
    expect(report.usersEntityDomCount).toBeGreaterThan(0);
    // Unique focus: field → owning entity alone; domain may be context-active only.
    expect(report.focusEntityCount).toBe(1);
    expect(report.focusDomainCount).toBe(0);
    expect(report.isFocusTotal).toBe(1);
    expect(report.softHasFocus).toBe(false);
    expect(report.focusNearViewportCenter).toBe(true);
    expect(report.softPeerEntityCount).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(
      `[JUM-918 CDP] midInside totalHits=${String(report.totalHits)} `
        + `ghostVerticals=${String(report.ghostVerticalCount)} `
        + `shell=${report.shellVersion} fieldFocusOk=${String(report.fieldFocusOk)} `
        + `usersEntityDom=${String(report.usersEntityDomCount)} `
        + `focusEntities=${String(report.focusEntityCount)} softPeers=${String(report.softPeerEntityCount)} `
        + `quietEntities=${String(report.quietEntityCount)} `
        + `stagedAwayVisible=${String(report.stagedAwayVisible)} edges=${String(report.byRelationship.length)}`
    );
    await context.close();
  }, 90000);

  it('keeps Users as scaled soft peers on Tasks domain focus', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await hardReloadShell(page, baseUrl);
    await page.click('#domain-designer-empty-load-sample-btn');
    await page.waitForSelector('.canvas .entity', { timeout: 15000 });
    await page.waitForTimeout(500);

    await openDesignerPanels(page, '#domain-list');
    await page.locator('#domain-list .domain-tree-domain', { hasText: 'Tasks' }).first().click();
    await waitCanvasCameraIdle(page);

    await page.screenshot({
      path: path.join(artifactsDir, '31-test-domain-tasks-peers-staged.png'),
      fullPage: false
    });

    const scene = await page.evaluate(collectMidInsideReport);
    // eslint-disable-next-line no-console
    console.log(
      `[JUM-918 domain-focus] midInside totalHits=${String(scene.totalHits)} `
        + `ghostVerticals=${String(scene.ghostVerticalCount)} `
        + `usersEntityDom=${String(scene.usersEntityDomCount)} `
        + `usersLabel="${scene.usersLabel}" softPeers=${String(scene.softPeerEntityCount)} `
        + `softDomains=${String(scene.softDomainCount)} scale=${String(scene.softDomainScale)} `
        + `usersIsSoft=${String(scene.usersIsSoft)} usersClickable=${String(scene.usersClickable)} `
        + `focus=${scene.focusKind} scope="${scene.scope}"`
    );

    expect(scene.shellVersion).toBe('0.9.148');
    expect(scene.focusKind).toBe('domain');
    // Unique focus: domain alone; soft peers never carry is-focus.
    expect(scene.focusDomainCount).toBe(1);
    expect(scene.focusEntityCount).toBe(0);
    expect(scene.isFocusTotal).toBe(1);
    expect(scene.softHasFocus).toBe(false);
    expect(scene.focusNearViewportCenter).toBe(true);
    // Soft peers stay on stage with real endpoint cards (entity mid-scale).
    expect(scene.softDomainCount).toBeGreaterThan(0);
    expect(scene.softPeerEntityCount).toBeGreaterThan(0);
    expect(scene.usersEntityDomCount).toBeGreaterThan(0);
    expect(scene.usersIsSoft).toBe(true);
    expect(scene.usersClickable).toBe(true);
    expect(scene.softDomainDepthOk).toBe(true);
    // Soft-peer domains advertise truthful inventory ("N in background"), not
    // endpoint-stub counts like "1 soft peer".
    expect(scene.usersLabel).toMatch(/in background|soft peer/i);
    // Soft depth scale lives on the domain (CSS ~0.78); nested soft entities stay at 1
    // so edge anchors do not compound-shrink.
    expect(scene.softDomainScale).toBeGreaterThan(0.74);
    expect(scene.softDomainScale).toBeLessThan(0.9);
    expect(scene.totalHits).toBe(0);
    expect(scene.ghostVerticalCount).toBeLessThanOrEqual(2);
    expect(scene.stagedAwayVisible).toBe(0);
    await context.close();
  }, 90000);

  it('sends sibling entities to background scale on entity focus', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await hardReloadShell(page, baseUrl);
    await page.click('#domain-designer-empty-load-sample-btn');
    await page.waitForSelector('.canvas .entity', { timeout: 15000 });
    await page.waitForTimeout(500);

    await openDesignerPanels(page, '#domain-list');
    await page.evaluate(() => {
      const findDomainBtn = () => Array.from(
        document.querySelectorAll('#domain-list button.domain-tree-domain')
      ).find((btn) => (
        (btn.querySelector('.domain-tree-name')?.textContent || '').trim() === 'Tasks'
      ));
      (findDomainBtn() as HTMLElement | undefined)?.click();
      const row = findDomainBtn()?.closest('li');
      const toggle = row?.querySelector('button.domain-tree-toggle') as HTMLButtonElement | null;
      if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
      const buttons = Array.from(document.querySelectorAll('#domain-list .domain-tree-entity button'));
      const match = buttons.find((btn) => (
        (btn.querySelector('.domain-tree-name')?.textContent || '').trim() === 'Task'
      ));
      match?.scrollIntoView({ block: 'center' });
      (match as HTMLElement | undefined)?.click();
    });
    await waitCanvasCameraIdle(page);

    await page.screenshot({
      path: path.join(artifactsDir, '33-test-entity-task-siblings-bg.png'),
      fullPage: false
    });

    const scene = await page.evaluate(collectMidInsideReport);
    // eslint-disable-next-line no-console
    console.log(
      `[JUM-918 entity-focus] focus=${scene.focusKind} focusEntities=${String(scene.focusEntityCount)} `
        + `quietEntities=${String(scene.quietEntityCount)} softPeers=${String(scene.softPeerEntityCount)} `
        + `softScale=${String(scene.softEntityScale)} hits=${String(scene.totalHits)}`
    );

    expect(scene.shellVersion).toBe('0.9.148');
    expect(scene.focusKind).toBe('entity');
    // Unique focus: entity alone; home domain may be context-active without is-focus.
    expect(scene.focusEntityCount).toBe(1);
    expect(scene.focusDomainCount).toBe(0);
    expect(scene.isFocusTotal).toBe(1);
    expect(scene.softHasFocus).toBe(false);
    expect(scene.focusNearViewportCenter).toBe(true);
    // Sibling cards stay on stage at quieter depth (not hidden).
    expect(scene.quietEntityCount).toBeGreaterThan(0);
    expect(scene.softPeerEntityCount).toBeGreaterThan(0);
    // Cross-domain soft peers shrink via soft-domain CSS scale; quiet siblings
    // in the focus domain keep entity-tier scale.
    const softScale = scene.softDomainCount > 0
      ? scene.softDomainScale
      : scene.softEntityScale;
    expect(softScale).toBeGreaterThan(0.74);
    expect(softScale).toBeLessThan(0.9);
    expect(scene.totalHits).toBe(0);
    expect(scene.stagedAwayVisible).toBe(0);
    await context.close();
  }, 90000);

  it('selects domain from canvas header click (not tree)', async () => {
    expect.hasAssertions();
    const context = await browser!.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await hardReloadShell(page, baseUrl);
    await page.click('#domain-designer-empty-load-sample-btn');
    await page.waitForSelector('.canvas .domain[data-domain-id]', { timeout: 15000 });
    await page.waitForTimeout(500);

    // Overview — Escape may already be overview after sample load.
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(180);
    }

    const clicked = await page.evaluate(() => {
      const domains = Array.from(document.querySelectorAll<HTMLElement>('.domain[data-domain-id]'));
      const users = domains.find((node) => (
        (node.querySelector('.domain-title')?.textContent || '').trim() === 'Users'
      ));
      const header = users?.querySelector('.domain-header') as HTMLElement | null;
      if (!users || !header) return { ok: false, reason: 'missing Users domain header' };
      const rect = header.getBoundingClientRect();
      const x = rect.left + Math.min(90, Math.max(40, rect.width * 0.45));
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      header.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 7,
        button: 0,
        buttons: 1,
        pointerType: 'mouse'
      }));
      header.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId: 7,
        button: 0,
        buttons: 0,
        pointerType: 'mouse'
      }));
      return {
        ok: true,
        domainId: users.dataset.domainId || null,
        hitTag: hit?.tagName || null,
        hitDomain: (hit as Element | null)?.closest?.('.domain')?.getAttribute('data-domain-id') || null
      };
    });
    expect(clicked.ok).toBe(true);
    await waitCanvasCameraIdle(page);

    await page.screenshot({
      path: path.join(artifactsDir, '34-test-canvas-domain-users-click.png'),
      fullPage: false
    });

    const scene = await page.evaluate(collectMidInsideReport);
    // eslint-disable-next-line no-console
    console.log(
      `[JUM-918 canvas-domain-click] focus=${scene.focusKind} focusDomains=${String(scene.focusDomainCount)} `
        + `shell=${scene.shellVersion} scope="${scene.scope}"`
    );

    expect(scene.shellVersion).toBe('0.9.148');
    expect(scene.focusKind).toBe('domain');
    expect(scene.focusDomainCount).toBe(1);
    expect(scene.isFocusTotal).toBe(1);
    expect(scene.focusNearViewportCenter).toBe(true);
    // Users exclusive after canvas header click — Tasks soft/quiet, not equal stage.
    const usersFocus = await page.evaluate(() => {
      const users = Array.from(document.querySelectorAll<HTMLElement>('.domain[data-domain-id]'))
        .find((node) => (node.querySelector('.domain-title')?.textContent || '').trim() === 'Users');
      const canvas = document.getElementById('canvas');
      return {
        usersIsFocus: Boolean(users?.classList.contains('is-focus')),
        stage: canvas?.dataset.canvasStage || 'overview'
      };
    });
    expect(usersFocus.usersIsFocus).toBe(true);
    expect(usersFocus.stage).toBe('focus');
    await context.close();
  }, 90000);
});
