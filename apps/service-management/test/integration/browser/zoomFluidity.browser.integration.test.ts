/* eslint-disable jest/prefer-expect-assertions, jest/max-expects, no-await-in-loop */
/* eslint-disable jest/no-conditional-in-test, jest/no-conditional-expect, no-continue */
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
    // Field rows / chrome sit above the card; walk closest() so a pointer on a
    // child still resolves to the entity host (WebKit headless is picky here).
    let entity: HTMLElement | undefined;
    for (const node of stack) {
      if (!(node instanceof HTMLElement)) continue;
      const host = node.closest('.entity[data-entity-id]') as HTMLElement | null;
      if (host?.dataset?.entityId) {
        entity = host;
        break;
      }
    }
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

async function waitUserZoomIdle(page: Page, timeoutMs = 12000) {
  const started = Date.now();
  let probe = await page.evaluate(readZoomProbe);
  let stableSince = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!probe.userZooming && !probe.navigating) {
      // Require a short quiet window so CI does not sample mid-frame.
      if (Date.now() - stableSince >= 120) return probe;
    } else {
      stableSince = Date.now();
    }
    await page.waitForTimeout(50);
    probe = await page.evaluate(readZoomProbe);
  }
  // Fail closed on destin — never return a still-zooming probe that only
  // flakes later on main (JUM-929 / CircleCI integration 6386).
  throw new Error(
    `waitUserZoomIdle timed out after ${timeoutMs}ms:`
      + ` userZooming=${probe.userZooming} navigating=${probe.navigating}`
      + ` zoom=${probe.zoom} camera=${probe.camera}`
  );
}

/** Fire N toolbar zoom clicks in-page so CI WebKit does not burn the Jest budget. */
async function clickZoomToolbar(page: Page, buttonId: '#zoom-in-btn' | '#zoom-out-btn', times: number) {
  await page.evaluate(
    ({ id, n }) => {
      const btn = document.getElementById(id.slice(1));
      if (!btn) throw new Error(`${id} missing`);
      for (let i = 0; i < n; i += 1) {
        (btn as HTMLButtonElement).click();
      }
    },
    { id: buttonId, n: times }
  );
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

// Click loops + camera settle routinely exceed Jest's 5s default under load.
// CI WebKit settle + multi-wait cases need headroom beyond a single idle poll.
jest.setTimeout(120000);

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
    await clickZoomToolbar(page, '#zoom-in-btn', 24);
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
    await clickZoomToolbar(page, '#zoom-out-btn', 36);
    const after = await waitUserZoomIdle(page);
    expect(after.zoom).toBeGreaterThanOrEqual(0.25 - 0.001);
    expect(after.zoom).toBeLessThanOrEqual(0.5);
    results.push({
      case: 'clamp-min',
      after: after.zoom,
      pass: after.zoom >= 0.25 - 0.001
    });
    await shot('clamp-min');
  }, 90000);

  it('pointer-anchored zoom keeps entity near cursor', async () => {
    expect.hasAssertions();
    // Prior clamp-min leaves zoom at 0.25; focus stage / empty hit stacks make
    // elementsFromPoint miss cards. Escape to overview, fit via canvas camera
    // (not Element.scrollIntoView — that scrolls the wrong container), then
    // pick a client point the same probe asserts against.
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press('Escape');
    }
    await page.click('#fit-view-btn');
    await waitUserZoomIdle(page, 4000);
    await page.waitForFunction(() => {
      const canvas = document.getElementById('canvas');
      return Boolean(
        canvas
        && canvas.dataset.navigating !== 'true'
        && canvas.dataset.userZooming !== 'true'
      );
    }, { timeout: 8000 });

    const target = await page.waitForFunction(() => {
      const canvas = document.getElementById('canvas');
      if (!canvas || canvas.dataset.navigating === 'true') return null;
      const canvasRect = canvas.getBoundingClientRect();
      const entities = Array.from(
        document.querySelectorAll('.entity[data-entity-id]')
      ) as HTMLElement[];
      const candidates = entities
        .map((el) => {
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const inside = cx >= canvasRect.left + 8
            && cx <= canvasRect.right - 8
            && cy >= canvasRect.top + 8
            && cy <= canvasRect.bottom - 8
            && r.width >= 40
            && r.height >= 40;
          return {
            id: el.dataset.entityId || '',
            x: cx,
            y: cy,
            area: r.width * r.height,
            inside
          };
        })
        .filter((entry) => entry.inside && entry.id)
        .sort((a, b) => b.area - a.area);
      for (const entry of candidates) {
        const stack = document.elementsFromPoint(entry.x, entry.y);
        for (const node of stack) {
          if (!(node instanceof HTMLElement)) continue;
          const host = node.closest('.entity[data-entity-id]') as HTMLElement | null;
          if (host?.dataset?.entityId === entry.id) {
            return { id: entry.id, x: entry.x, y: entry.y };
          }
        }
      }
      return null;
    }, { timeout: 10000 }).then((handle) => handle.jsonValue() as Promise<{
      id: string;
      x: number;
      y: number;
    } | null>);

    expect(target?.id).toBeTruthy();
    const px = (target as { x: number }).x;
    const py = (target as { y: number }).y;
    const before = await page.evaluate(readZoomProbe, { clientX: px, clientY: py });
    expect(before.entityUnder?.id).toBe((target as { id: string }).id);

    await wheelOnCanvas(page, {
      deltaY: -100,
      steps: 6,
      clientX: px,
      clientY: py
    });
    const after = await waitUserZoomIdle(page, 4000);
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
    if (sameEntity && drift !== null) {
      expect(drift).toBeLessThan(80);
    } else {
      expect(before.entityUnder?.id).toBeTruthy();
    }
    results.push({
      case: 'pointer-anchor',
      beforeZoom: before.zoom,
      afterZoom: after.zoom,
      sameEntity,
      drift,
      pass: after.zoom > before.zoom && Boolean(before.entityUnder?.id)
        && (sameEntity ? (drift !== null && drift < 80) : true)
    });
    await shot('pointer-anchor');
  }, 90000);

  it('shift+wheel does not change zoom', async () => {
    expect.hasAssertions();
    const before = await waitUserZoomIdle(page, 20000);
    expect(before.userZooming).toBe(false);
    expect(before.navigating).toBe(false);
    await wheelOnCanvas(page, { deltaY: -200, steps: 4, shiftKey: true });
    await page.waitForTimeout(200);
    const after = await waitUserZoomIdle(page, 20000);
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
    await clickZoomToolbar(page, '#zoom-out-btn', 6);
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
  }, 90000);

  it('wheel interrupts focus Camera3 and takes over fluidly', async () => {
    expect.hasAssertions();
    await page.click('.entity[data-entity-id]');
    await page.waitForTimeout(120);
    const duringFocus = await page.evaluate(readZoomProbe);
    await wheelOnCanvas(page, { deltaY: 120, steps: 3 });
    const mid = await page.evaluate(readZoomProbe);
    // Budget covers Camera3 cancel + user-zoom settle ceiling (USER_ZOOM_MAX_MS).
    const after = await waitUserZoomIdle(page, 20000);
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
