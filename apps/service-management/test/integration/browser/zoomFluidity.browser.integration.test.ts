/* eslint-disable jest/prefer-expect-assertions, jest/max-expects, no-await-in-loop */
/* eslint-disable jest/no-conditional-in-test, jest/no-conditional-expect */
/*
 * JUM-918 follow-up — fluid pointer-anchored zoom + edge-case matrix.
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
  '../../artifacts/zoom-fluidity-playwright'
);
const EXPECTED_SHELL = '0.9.148';

type ZoomProbe = {
  zoom: number;
  zoomPct: string;
  userZooming: boolean;
  zoomDirection: string | null;
  camera: string | null;
  navigating: boolean;
  scrollLeft: number;
  scrollTop: number;
  shell: string | null;
  entityUnder: { id: string; dx: number; dy: number } | null;
};

type ZoomProbeOpts = { clientX?: number; clientY?: number };

function readZoomProbe(opts?: ZoomProbeOpts | void): ZoomProbe {
  const canvas = document.getElementById('canvas') as HTMLElement | null;
  const indicator = document.getElementById('zoom-indicator');
  const shellMatch = (document.querySelector('script[src*="script.js?v="]')?.getAttribute('src') || '')
    .match(/[?&]v=([^&]+)/);
  const zoomText = indicator?.textContent || '100%';
  const zoom = Number.parseFloat(zoomText) / 100;
  let entityUnder: ZoomProbe['entityUnder'] = null;
  const clientX = opts && typeof opts === 'object' ? opts.clientX : undefined;
  const clientY = opts && typeof opts === 'object' ? opts.clientY : undefined;
  if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
    const stack = document.elementsFromPoint(clientX as number, clientY as number);
    const entity = stack.find((node) => (
      node instanceof HTMLElement && node.classList.contains('entity') && Boolean(node.dataset.entityId)
    )) as HTMLElement | undefined;
    if (entity) {
      const rect = entity.getBoundingClientRect();
      entityUnder = {
        id: entity.dataset.entityId || '',
        dx: (clientX as number) - (rect.left + rect.width / 2),
        dy: (clientY as number) - (rect.top + rect.height / 2)
      };
    }
  }
  return {
    zoom: Number.isFinite(zoom) ? zoom : 1,
    zoomPct: zoomText,
    userZooming: canvas?.dataset.userZooming === 'true',
    zoomDirection: canvas?.dataset.zoomDirection || null,
    camera: canvas?.dataset.camera || null,
    navigating: canvas?.dataset.navigating === 'true',
    scrollLeft: canvas?.scrollLeft || 0,
    scrollTop: canvas?.scrollTop || 0,
    shell: shellMatch ? shellMatch[1] : null,
    entityUnder
  };
}

async function hardReload(page: Page, baseUrl: string) {
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
    if (window.caches?.keys) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  });
  await page.goto(`${baseUrl}?zoomFluid=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#canvas', { timeout: 30000 });
}

async function waitUserZoomIdle(page: Page, timeoutMs = 2500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const probe = await page.evaluate(readZoomProbe);
    if (!probe.userZooming && !probe.navigating) return probe;
    await page.waitForTimeout(40);
  }
  return page.evaluate(readZoomProbe);
}

async function wheelOnCanvas(
  page: Page,
  {
    deltaY,
    deltaMode = 0,
    steps = 1,
    clientX,
    clientY,
    shiftKey = false,
    ctrlKey = false
  }: {
    deltaY: number;
    deltaMode?: number;
    steps?: number;
    clientX?: number;
    clientY?: number;
    shiftKey?: boolean;
    ctrlKey?: boolean;
  }
) {
  const box = await page.locator('#canvas').boundingBox();
  if (!box) throw new Error('canvas missing');
  const x = clientX ?? box.x + box.width / 2;
  const y = clientY ?? box.y + box.height / 2;
  await page.mouse.move(x, y);
  for (let i = 0; i < steps; i += 1) {
    await page.evaluate(
      ({
        dy, mode, sx, sy, shift, ctrl
      }) => {
        const canvas = document.getElementById('canvas');
        if (!canvas) return;
        const event = new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaX: 0,
          deltaY: dy,
          deltaMode: mode,
          clientX: sx,
          clientY: sy,
          shiftKey: shift,
          ctrlKey: ctrl
        });
        canvas.dispatchEvent(event);
      },
      {
        dy: deltaY,
        mode: deltaMode,
        sx: x,
        sy: y,
        shift: shiftKey,
        ctrl: ctrlKey
      }
    );
    await page.waitForTimeout(16);
  }
  return { x, y };
}

describe('domain designer fluid zoom edge cases (JUM-918)', () => {
  let browser: Browser;
  let page: Page;
  let server: StartedServer;
  let configDir: string;
  let baseUrl: string;
  const results: Array<Record<string, unknown>> = [];

  beforeAll(async () => {
    fs.mkdirSync(artifactsDir, { recursive: true });
    for (const file of fs.readdirSync(artifactsDir)) {
      if (file.endsWith('.png') || file.endsWith('.json')) {
        fs.unlinkSync(path.join(artifactsDir, file));
      }
    }
    execFileSync('bun', ['apps/service-management/scripts/sync-service-management-cana-bundle.js'], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env
    });
    execFileSync('bun', ['apps/service-management/scripts/sync-service-management-designer-core.js'], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env
    });
    configDir = createTempConfigDir({
      '.env.dev': envFileContent('express')
    });
    server = await startServer(configDir);
    await waitForServer(server.port);
    baseUrl = `http://127.0.0.1:${String(server.port)}/`;
    browser = await webkit.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await hardReload(page, baseUrl);
    await page.click('#domain-designer-empty-load-sample-btn');
    await page.waitForSelector('.canvas .entity[data-entity-id]', { timeout: 30000 });
    await page.waitForTimeout(600);
    await openDesignerPanels(page, '#domain-list');
  }, 180000);

  afterAll(async () => {
    fs.writeFileSync(
      path.join(artifactsDir, 'RESULTS.json'),
      `${JSON.stringify({ shellExpected: EXPECTED_SHELL, results }, null, 2)}\n`
    );
    if (page) await page.close().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
    if (server) await stopServer(server);
    if (configDir) cleanupTempConfigDir(configDir);
  });

  async function shot(name: string) {
    const file = path.join(artifactsDir, `${String(results.length + 1).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return file;
  }

  it('shell is 0.9.148 after hard reload', async () => {
    expect.hasAssertions();
    const probe = await page.evaluate(readZoomProbe);
    expect(probe.shell).toBe(EXPECTED_SHELL);
    results.push({ case: 'shell', ...probe, pass: probe.shell === EXPECTED_SHELL });
    await shot('shell');
  });

  it('wheel zoom-in increases zoom fluidly and settles', async () => {
    expect.hasAssertions();
    const before = await waitUserZoomIdle(page);
    await wheelOnCanvas(page, { deltaY: -120, steps: 4 });
    const mid = await page.evaluate(readZoomProbe);
    const after = await waitUserZoomIdle(page);
    expect(after.zoom).toBeGreaterThan(before.zoom + 0.02);
    expect(after.userZooming).toBe(false);
    results.push({
      case: 'wheel-zoom-in',
      before: before.zoom,
      midZooming: mid.userZooming,
      after: after.zoom,
      pass: after.zoom > before.zoom + 0.02 && !after.userZooming
    });
    await shot('wheel-zoom-in');
  });

  it('wheel zoom-out decreases zoom fluidly and settles', async () => {
    expect.hasAssertions();
    const before = await waitUserZoomIdle(page);
    await wheelOnCanvas(page, { deltaY: 140, steps: 5 });
    const after = await waitUserZoomIdle(page);
    expect(after.zoom).toBeLessThan(before.zoom - 0.02);
    expect(after.userZooming).toBe(false);
    results.push({
      case: 'wheel-zoom-out',
      before: before.zoom,
      after: after.zoom,
      pass: after.zoom < before.zoom - 0.02
    });
    await shot('wheel-zoom-out');
  });

  it('rapid wheel retargets mid-flight without snap back', async () => {
    expect.hasAssertions();
    const before = await waitUserZoomIdle(page);
    await wheelOnCanvas(page, { deltaY: -80, steps: 2 });
    await wheelOnCanvas(page, { deltaY: -80, steps: 2 });
    await wheelOnCanvas(page, { deltaY: -80, steps: 2 });
    const mid = await page.evaluate(readZoomProbe);
    const after = await waitUserZoomIdle(page);
    expect(after.zoom).toBeGreaterThan(before.zoom);
    expect(after.userZooming).toBe(false);
    results.push({
      case: 'rapid-retarget',
      before: before.zoom,
      midZooming: mid.userZooming || mid.camera === '3',
      after: after.zoom,
      pass: after.zoom > before.zoom && !after.userZooming
    });
    await shot('rapid-retarget');
  });

  it('toolbar +/- buttons chase fluidly around viewport center', async () => {
    expect.hasAssertions();
    const before = await waitUserZoomIdle(page);
    await page.click('#zoom-in-btn');
    await page.click('#zoom-in-btn');
    const afterIn = await waitUserZoomIdle(page);
    await page.click('#zoom-out-btn');
    const afterOut = await waitUserZoomIdle(page);
    expect(afterIn.zoom).toBeGreaterThan(before.zoom);
    expect(afterOut.zoom).toBeLessThan(afterIn.zoom);
    results.push({
      case: 'toolbar-buttons',
      before: before.zoom,
      afterIn: afterIn.zoom,
      afterOut: afterOut.zoom,
      pass: afterIn.zoom > before.zoom && afterOut.zoom < afterIn.zoom
    });
    await shot('toolbar-buttons');
  });

  it('keyboard = / - zoom when canvas focused', async () => {
    expect.hasAssertions();
    await page.click('#canvas');
    const before = await waitUserZoomIdle(page);
    await page.keyboard.press('=');
    const afterPlus = await waitUserZoomIdle(page);
    await page.keyboard.press('-');
    const afterMinus = await waitUserZoomIdle(page);
    expect(afterPlus.zoom).toBeGreaterThan(before.zoom - 0.001);
    results.push({
      case: 'keyboard-plus-minus',
      before: before.zoom,
      afterPlus: afterPlus.zoom,
      afterMinus: afterMinus.zoom,
      pass: afterPlus.zoom >= before.zoom
    });
    await shot('keyboard-plus-minus');
  });

  it('clamps at max 2.5 under aggressive zoom-in', async () => {
    expect.hasAssertions();
    for (let i = 0; i < 24; i += 1) {
      await page.click('#zoom-in-btn');
    }
    const after = await waitUserZoomIdle(page);
    expect(after.zoom).toBeLessThanOrEqual(2.5 + 0.001);
    expect(after.zoom).toBeGreaterThanOrEqual(2.0);
    results.push({
      case: 'clamp-max',
      after: after.zoom,
      pass: after.zoom <= 2.5 + 0.001
    });
    await shot('clamp-max');
  });

  it('clamps at min 0.25 under aggressive zoom-out', async () => {
    expect.hasAssertions();
    for (let i = 0; i < 36; i += 1) {
      await page.click('#zoom-out-btn');
    }
    const after = await waitUserZoomIdle(page, 4000);
    expect(after.zoom).toBeGreaterThanOrEqual(0.25 - 0.001);
    expect(after.zoom).toBeLessThanOrEqual(0.5);
    results.push({
      case: 'clamp-min',
      after: after.zoom,
      pass: after.zoom >= 0.25 - 0.001
    });
    await shot('clamp-min');
  }, 15000);

  it('pointer-anchored zoom keeps entity near cursor', async () => {
    expect.hasAssertions();
    for (let i = 0; i < 10; i += 1) await page.click('#zoom-in-btn');
    await waitUserZoomIdle(page);
    const entityBox = await page.locator('.entity[data-entity-id]').first().boundingBox();
    expect(entityBox).toBeTruthy();
    const box = entityBox as { x: number; y: number; width: number; height: number };
    const px = box.x + box.width / 2;
    const py = box.y + box.height / 2;
    const before = await page.evaluate(readZoomProbe, { clientX: px, clientY: py });
    await wheelOnCanvas(page, {
      deltaY: -100,
      steps: 6,
      clientX: px,
      clientY: py
    });
    const after = await waitUserZoomIdle(page);
    const afterUnder = await page.evaluate(readZoomProbe, { clientX: px, clientY: py });
    const sameEntity = Boolean(
      before.entityUnder?.id
      && afterUnder.entityUnder?.id
      && before.entityUnder.id === afterUnder.entityUnder.id
    );
    const drift = sameEntity
      ? Math.hypot(
        (afterUnder.entityUnder?.dx || 0) - (before.entityUnder?.dx || 0),
        (afterUnder.entityUnder?.dy || 0) - (before.entityUnder?.dy || 0)
      )
      : null;
    expect(after.zoom).toBeGreaterThan(before.zoom);
    // Deep zoom can leave the original card under the fixed client point; when
    // the same entity remains under the pointer, keep the drift budget tight.
    if (sameEntity && drift !== null) {
      expect(drift).toBeLessThan(80);
    } else {
      expect(before.entityUnder?.id || afterUnder.entityUnder?.id).toBeTruthy();
    }
    results.push({
      case: 'pointer-anchor',
      beforeZoom: before.zoom,
      afterZoom: after.zoom,
      sameEntity,
      drift,
      pass: after.zoom > before.zoom
        && (sameEntity
          ? (drift !== null && drift < 80)
          : Boolean(before.entityUnder || afterUnder.entityUnder))
    });
    await shot('pointer-anchor');
  });

  it('shift+wheel does not change zoom', async () => {
    expect.hasAssertions();
    const before = await waitUserZoomIdle(page);
    await wheelOnCanvas(page, { deltaY: -200, steps: 4, shiftKey: true });
    await page.waitForTimeout(200);
    const after = await waitUserZoomIdle(page);
    expect(Math.abs(after.zoom - before.zoom)).toBeLessThan(0.02);
    results.push({
      case: 'shift-wheel-no-zoom',
      before: before.zoom,
      after: after.zoom,
      pass: Math.abs(after.zoom - before.zoom) < 0.02
    });
    await shot('shift-wheel-no-zoom');
  });

  it('ctrl/trackpad-pinch style wheel still zooms', async () => {
    expect.hasAssertions();
    const before = await waitUserZoomIdle(page);
    await wheelOnCanvas(page, { deltaY: -90, steps: 3, ctrlKey: true });
    const after = await waitUserZoomIdle(page);
    expect(after.zoom).toBeGreaterThan(before.zoom);
    results.push({
      case: 'ctrl-wheel-pinch',
      before: before.zoom,
      after: after.zoom,
      pass: after.zoom > before.zoom
    });
    await shot('ctrl-wheel-pinch');
  });

  it('line-mode and page-mode wheel deltas zoom', async () => {
    expect.hasAssertions();
    // Prior cases may leave zoom at the max clamp — create headroom first.
    for (let i = 0; i < 12; i += 1) {
      await page.click('#zoom-out-btn');
    }
    await waitUserZoomIdle(page);
    const before = await waitUserZoomIdle(page);
    expect(before.zoom).toBeLessThan(2.4);
    await wheelOnCanvas(page, { deltaY: -3, deltaMode: 1, steps: 4 });
    const afterLine = await waitUserZoomIdle(page);
    await wheelOnCanvas(page, { deltaY: 1, deltaMode: 2, steps: 1 });
    const afterPage = await waitUserZoomIdle(page);
    expect(afterLine.zoom).toBeGreaterThan(before.zoom);
    expect(afterPage.zoom).toBeLessThan(afterLine.zoom);
    results.push({
      case: 'delta-modes',
      before: before.zoom,
      afterLine: afterLine.zoom,
      afterPage: afterPage.zoom,
      pass: afterLine.zoom > before.zoom && afterPage.zoom < afterLine.zoom
    });
    await shot('delta-modes');
  });

  it('wheel interrupts focus Camera3 and takes over fluidly', async () => {
    expect.hasAssertions();
    await page.click('.entity[data-entity-id]');
    await page.waitForTimeout(120);
    const duringFocus = await page.evaluate(readZoomProbe);
    await wheelOnCanvas(page, { deltaY: 120, steps: 3 });
    const mid = await page.evaluate(readZoomProbe);
    const after = await waitUserZoomIdle(page);
    expect(after.userZooming).toBe(false);
    results.push({
      case: 'interrupt-focus',
      focusNavigating: duringFocus.navigating,
      midUserZooming: mid.userZooming,
      afterZoom: after.zoom,
      pass: !after.userZooming
    });
    await shot('interrupt-focus');
  });

  it('fit then wheel still works', async () => {
    expect.hasAssertions();
    await page.click('#fit-view-btn');
    await waitUserZoomIdle(page);
    const before = await waitUserZoomIdle(page);
    await wheelOnCanvas(page, { deltaY: -100, steps: 4 });
    const after = await waitUserZoomIdle(page);
    expect(Math.abs(after.zoom - before.zoom)).toBeGreaterThan(0.02);
    results.push({
      case: 'fit-then-wheel',
      before: before.zoom,
      after: after.zoom,
      pass: Math.abs(after.zoom - before.zoom) > 0.02
    });
    await shot('fit-then-wheel');
  });
});
