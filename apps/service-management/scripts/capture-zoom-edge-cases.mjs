#!/usr/bin/env bun
/**
 * Massive Domain Designer zoom edge-case capture (JUM-918 follow-up).
 * Exercises wheel / buttons / keyboard / clamps / interrupt / delta modes,
 * screenshots each step, writes ZOOM-EDGE.md.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright-webkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const outDir = path.resolve(
  repoRoot,
  'apps/service-management/test/artifacts/zoom-fluidity-playwright'
);
const EXPECTED_SHELL = '0.9.148';

const {
  createTempConfigDir,
  cleanupTempConfigDir,
  envFileContent,
  startServer,
  stopServer,
  waitForServer,
  openDesignerPanels
} = await import('../test/helpers/serverHarness.ts');

fs.mkdirSync(outDir, { recursive: true });
for (const file of fs.readdirSync(outDir)) {
  if (file.endsWith('.png') || file.endsWith('.json') || file.endsWith('.md')) {
    fs.unlinkSync(path.join(outDir, file));
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const READ_PROBE = `(() => {
  const canvas = document.getElementById('canvas');
  const indicator = document.getElementById('zoom-indicator');
  const shellMatch = (document.querySelector('script[src*="script.js?v="]')?.getAttribute('src') || '').match(/[?&]v=([^&]+)/);
  const zoomText = indicator?.textContent || '100%';
  return {
    zoom: Number.parseFloat(zoomText) / 100,
    zoomPct: zoomText,
    userZooming: canvas?.dataset?.userZooming === 'true',
    zoomDirection: canvas?.dataset?.zoomDirection || null,
    camera: canvas?.dataset?.camera || null,
    navigating: canvas?.dataset?.navigating === 'true',
    shell: shellMatch ? shellMatch[1] : null,
    scope: document.getElementById('canvas-scope-path')?.textContent || ''
  };
})()`;

async function probe(page) {
  return page.evaluate(READ_PROBE);
}

async function waitIdle(page, timeoutMs = 2500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const p = await probe(page);
    if (!p.userZooming && !p.navigating) return p;
    await sleep(40);
  }
  return probe(page);
}

async function hardReload(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
    if (window.caches?.keys) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  });
  await page.goto(`${baseUrl}?zoomEdge=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#canvas', { timeout: 30000 });
}

async function wheel(page, deltaY, { steps = 1, shiftKey = false, ctrlKey = false, deltaMode = 0 } = {}) {
  const box = await page.locator('#canvas').boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  for (let i = 0; i < steps; i += 1) {
    await page.evaluate(({ dy, mode, sx, sy, shift, ctrl }) => {
      const canvas = document.getElementById('canvas');
      canvas.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: dy,
        deltaMode: mode,
        clientX: sx,
        clientY: sy,
        shiftKey: shift,
        ctrlKey: ctrl
      }));
    }, { dy: deltaY, mode: deltaMode, sx: x, sy: y, shift: shiftKey, ctrl: ctrlKey });
    await sleep(16);
  }
}

const steps = [];
let idx = 0;

async function record(page, name, run, { requireZoomIncrease = false } = {}) {
  idx += 1;
  const before = await waitIdle(page);
  let error = null;
  try {
    await run({ before });
  } catch (err) {
    error = String(err?.message || err);
  }
  const after = await waitIdle(page);
  const file = `${String(idx).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(outDir, file), fullPage: false });
  let pass = !error && after.shell === EXPECTED_SHELL;
  if (requireZoomIncrease) {
    pass = pass && after.zoom > before.zoom + 0.01;
  }
  const entry = {
    n: idx,
    name,
    file,
    before: before.zoom,
    after: after.zoom,
    shell: after.shell,
    userZooming: after.userZooming,
    error,
    pass
  };
  steps.push(entry);
  process.stdout.write(`${entry.pass ? 'PASS' : 'FAIL'} ${name} ${before.zoomPct || before.zoom} → ${after.zoomPct || after.zoom}\n`);
  return entry;
}

execFileSync('bun', ['apps/service-management/scripts/sync-service-management-cana-bundle.js'], {
  cwd: repoRoot,
  stdio: 'inherit'
});
execFileSync('bun', ['apps/service-management/scripts/sync-service-management-designer-core.js'], {
  cwd: repoRoot,
  stdio: 'inherit'
});

const configDir = createTempConfigDir({
  '.env.dev': envFileContent('express')
});
const server = await startServer(configDir);
await waitForServer(server.port);
const baseUrl = `http://127.0.0.1:${String(server.port)}/`;

const browser = await webkit.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await hardReload(page, baseUrl);
  await page.click('#domain-designer-empty-load-sample-btn');
  await page.waitForSelector('.canvas .entity[data-entity-id]', { timeout: 30000 });
  await sleep(600);
  await openDesignerPanels(page, '#domain-list');

  await record(page, 'shell', async () => {});
  await record(page, 'wheel-in', async () => { await wheel(page, -120, { steps: 5 }); });
  await record(page, 'wheel-out', async () => { await wheel(page, 140, { steps: 5 }); });
  await record(page, 'rapid-burst', async () => {
    await wheel(page, -70, { steps: 2 });
    await wheel(page, -70, { steps: 2 });
    await wheel(page, -70, { steps: 2 });
  });
  await record(page, 'toolbar-in', async () => {
    await page.click('#zoom-in-btn');
    await page.click('#zoom-in-btn');
  });
  await record(page, 'toolbar-out', async () => { await page.click('#zoom-out-btn'); });
  await record(page, 'keyboard', async ({ before }) => {
    await page.click('#canvas');
    await page.keyboard.press('=');
    await waitIdle(page);
    const mid = await probe(page);
    if (!(mid.zoom > before.zoom + 0.01)) {
      await page.keyboard.press('=');
      await waitIdle(page);
    }
  }, { requireZoomIncrease: true });
  await record(page, 'clamp-max', async () => {
    for (let i = 0; i < 24; i += 1) await page.click('#zoom-in-btn');
  });
  await record(page, 'clamp-min', async () => {
    for (let i = 0; i < 36; i += 1) await page.click('#zoom-out-btn');
  });
  await record(page, 'shift-nozoom', async () => {
    await wheel(page, -200, { steps: 4, shiftKey: true });
  });
  await record(page, 'ctrl-pinch', async () => {
    await wheel(page, -90, { steps: 3, ctrlKey: true });
  });
  await record(page, 'delta-line', async () => {
    await wheel(page, -3, { steps: 4, deltaMode: 1 });
  });
  await record(page, 'delta-page', async () => {
    await wheel(page, 1, { steps: 1, deltaMode: 2 });
  });
  await record(page, 'interrupt-focus', async () => {
    await page.click('.entity[data-entity-id]');
    await sleep(100);
    await wheel(page, 120, { steps: 3 });
  });
  await record(page, 'fit-then-wheel', async () => {
    await page.click('#fit-view-btn');
    await sleep(400);
    await wheel(page, -100, { steps: 4 });
  });
  await record(page, 'reset-then-wheel', async () => {
    await page.click('#reset-view-btn');
    await sleep(400);
    await wheel(page, -80, { steps: 3 });
  });
} finally {
  await page.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
  await stopServer(server);
  cleanupTempConfigDir(configDir);
}

const failCount = steps.filter((s) => !s.pass).length;
const md = [
  '# Zoom fluidity edge-case evidence',
  '',
  `- Shell expected: **${EXPECTED_SHELL}**`,
  `- Steps: **${steps.length}**`,
  `- FAIL: **${failCount}**`,
  '',
  '| # | case | before | after | shell | pass |',
  '| --- | --- | --- | --- | --- | --- |',
  ...steps.map((s) => `| ${s.n} | ${s.name} | ${s.before} | ${s.after} | ${s.shell} | ${s.pass ? 'PASS' : 'FAIL'} |`),
  '',
  'Hard Reload the live shell (`0.9.148`) before judging wheel feel in Brave.',
  ''
].join('\n');

fs.writeFileSync(path.join(outDir, 'ZOOM-EDGE.md'), md);
fs.writeFileSync(path.join(outDir, 'MANIFEST.json'), `${JSON.stringify({ expectedShell: EXPECTED_SHELL, failCount, steps }, null, 2)}\n`);

process.stdout.write(`\nWrote ${outDir} fail=${failCount}\n`);
process.exit(failCount > 0 ? 1 : 0);
