#!/usr/bin/env bun
/**
 * Domain Designer nav-video pass — continuous Playwright video + step PNGs +
 * optional in-page MediaRecorder (canvas.captureStream) for CI/agent evidence.
 *
 * Artifacts: apps/service-management/test/artifacts/nav-video-pass/
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
  'apps/service-management/test/artifacts/nav-video-pass'
);
const EXPECTED_SHELL = '0.9.148';
const SHORT = process.argv.includes('--short');

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
  if (/\.(png|webm|mp4|json|md)$/i.test(file) || file.startsWith('frame-')) {
    fs.unlinkSync(path.join(outDir, file));
  }
}
const framesDir = path.join(outDir, 'frames');
fs.mkdirSync(framesDir, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settle(page, ms = 600) {
  await sleep(ms);
  await page.waitForTimeout(60);
}

async function waitCameraIdle(page, timeoutMs = 3500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const busy = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      return canvas?.dataset?.navigating === 'true' || canvas?.dataset?.userZooming === 'true';
    });
    if (!busy) return;
    await sleep(40);
  }
}

const DEPTH_PROBE = `(() => {
  const canvas = document.getElementById('canvas');
  const shellMatch = (document.querySelector('script[src*="script.js?v="]')?.getAttribute('src') || '').match(/[?&]v=([^&]+)/);
  const domains = Array.from(document.querySelectorAll('.canvas .domain[data-domain-id]')).map((node) => {
    const countEl = node.querySelector('.domain-count, .list-meta, .domain-header .meta');
    const entities = Array.from(node.querySelectorAll('.entity[data-entity-id]')).map((ent) => ({
      id: ent.dataset.entityId || '',
      soft: ent.classList.contains('is-soft'),
      quiet: ent.classList.contains('is-quiet'),
      staged: ent.classList.contains('is-staged-away'),
      focus: ent.classList.contains('is-focus'),
      depth: ent.dataset.stageDepth || null,
      scale: window.getComputedStyle(ent).transform,
      opacity: window.getComputedStyle(ent).opacity,
      pe: window.getComputedStyle(ent).pointerEvents,
      visibility: window.getComputedStyle(ent).visibility
    }));
    return {
      id: node.dataset.domainId || '',
      name: (node.querySelector('.domain-name, .domain-title')?.textContent || '').trim(),
      soft: node.classList.contains('is-soft'),
      quiet: node.classList.contains('is-quiet'),
      staged: node.classList.contains('is-staged-away'),
      focus: node.classList.contains('is-focus'),
      depth: node.dataset.stageDepth || null,
      scale: window.getComputedStyle(node).transform,
      opacity: window.getComputedStyle(node).opacity,
      pe: window.getComputedStyle(node).pointerEvents,
      visibility: window.getComputedStyle(node).visibility,
      countLabel: (countEl?.textContent || '').trim(),
      entityCount: entities.length,
      entities
    };
  });
  const inset = 4;
  const entityBoxes = Array.from(document.querySelectorAll('.canvas .entity[data-entity-id]')).map((node) => {
    const rect = node.getBoundingClientRect();
    return {
      id: node.dataset.entityId || '',
      left: rect.left + inset,
      top: rect.top + inset,
      right: rect.right - inset,
      bottom: rect.bottom - inset
    };
  });
  function scorePath(edgePath) {
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
      for (let bi = 0; bi < entityBoxes.length; bi += 1) {
        const box = entityBoxes[bi];
        if (screenX > box.left && screenX < box.right && screenY > box.top && screenY < box.bottom) {
          hits += 1;
          break;
        }
      }
    }
    return hits;
  }
  let midInside = 0;
  document.querySelectorAll('.edges .edge-line[data-relationship-id]').forEach((edgePath) => {
    const style = window.getComputedStyle(edgePath);
    if (style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity || '1') < 0.05) return;
    if (edgePath.classList.contains('is-staged-away') || edgePath.classList.contains('is-quiet')) return;
    midInside += scorePath(edgePath);
  });
  const zoomText = document.getElementById('zoom-indicator')?.textContent || '100%';
  return {
    shell: shellMatch ? shellMatch[1] : null,
    focusKind: canvas?.dataset?.focusKind || null,
    stage: canvas?.dataset?.canvasStage || null,
    camera: canvas?.dataset?.camera || null,
    navigating: canvas?.dataset?.navigating === 'true',
    userZooming: canvas?.dataset?.userZooming === 'true',
    zoomPct: zoomText,
    zoom: Number.parseFloat(zoomText) / 100,
    scope: document.getElementById('canvas-scope-path')?.textContent || '',
    midInside,
    domains,
    ghostDomains: domains.filter((d) => (
      /\\b0\\s*entities?\\b/i.test(d.countLabel)
      || (d.soft && d.entityCount === 0)
    )),
    softCount: domains.reduce((n, d) => n + d.entities.filter((e) => e.soft).length + (d.soft ? 1 : 0), 0),
    quietCount: domains.reduce((n, d) => n + d.entities.filter((e) => e.quiet).length + (d.quiet ? 1 : 0), 0),
    stagedCount: domains.reduce((n, d) => n + d.entities.filter((e) => e.staged).length + (d.staged ? 1 : 0), 0),
    scaledQuiet: domains.some((d) => d.quiet && d.scale && d.scale !== 'none' && !d.scale.includes('matrix(1,')),
    scaledSoftEntities: domains.some((d) => d.entities.some((e) => e.soft && e.scale && e.scale !== 'none' && !e.scale.includes('matrix(1,')))
  };
})()`;

async function probe(page) {
  return page.evaluate(DEPTH_PROBE);
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
  await page.goto(`${baseUrl}?navVideo=${Date.now()}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#canvas', { timeout: 30000 });
  await page.waitForSelector('body[data-designer-ready="true"]', { timeout: 20000 }).catch(() => undefined);
}

async function clickTreeDomain(page, name) {
  return page.evaluate((wanted) => {
    const buttons = Array.from(document.querySelectorAll('#domain-list button.domain-tree-domain'));
    const match = buttons.find((btn) => (
      (btn.querySelector('.domain-tree-name')?.textContent || '').trim() === wanted
    ));
    match?.click();
    return Boolean(match);
  }, name);
}

async function clickTreeEntity(page, name) {
  return page.evaluate((wanted) => {
    const buttons = Array.from(document.querySelectorAll('#domain-list .domain-tree-entity button'));
    const match = buttons.find((btn) => (
      (btn.querySelector('.domain-tree-name')?.textContent || '').trim() === wanted
    ));
    match?.scrollIntoView({ block: 'center' });
    match?.click();
    return Boolean(match);
  }, name);
}

async function expandDomain(page, name) {
  await page.evaluate((wanted) => {
    const findDomainBtn = () => Array.from(
      document.querySelectorAll('#domain-list button.domain-tree-domain')
    ).find((btn) => (
      (btn.querySelector('.domain-tree-name')?.textContent || '').trim() === wanted
    ));
    findDomainBtn()?.click();
    const row = findDomainBtn()?.closest('li');
    const toggle = row?.querySelector('button.domain-tree-toggle');
    if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
  }, name);
  await settle(page, 500);
}

async function startMediaRecorder(page) {
  return page.evaluate(async () => {
    const root = document.querySelector('#tab-domain-designer')
      || document.getElementById('canvas')
      || document.body;
    const stream = root.captureStream
      ? root.captureStream(30)
      : (root instanceof HTMLCanvasElement ? root.captureStream(30) : null);
    if (!stream) {
      window.__navRec = { ok: false, reason: 'captureStream unavailable' };
      return window.__navRec;
    }
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '');
    if (!mime) {
      window.__navRec = { ok: false, reason: 'MediaRecorder mime unsupported' };
      return window.__navRec;
    }
    const chunks = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size) chunks.push(ev.data);
    };
    window.__navRec = { ok: true, rec, chunks, mime, stream };
    rec.start(250);
    return { ok: true, mime };
  });
}

async function stopMediaRecorder(page) {
  return page.evaluate(async () => {
    const pack = window.__navRec;
    if (!pack?.ok || !pack.rec) return { ok: false, reason: pack?.reason || 'no recorder' };
    const blob = await new Promise((resolve) => {
      pack.rec.onstop = () => resolve(new Blob(pack.chunks, { type: pack.mime || 'video/webm' }));
      try {
        pack.rec.stop();
      } catch {
        resolve(new Blob(pack.chunks, { type: pack.mime || 'video/webm' }));
      }
    });
    try {
      pack.stream?.getTracks?.().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    const buf = await blob.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buf));
    return { ok: true, bytes, mime: pack.mime, size: bytes.length };
  });
}

async function wheelZoom(page, deltaY, steps = 6) {
  const box = await page.locator('#canvas').boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  for (let i = 0; i < steps; i += 1) {
    await page.evaluate(({ dy, sx, sy }) => {
      document.getElementById('canvas')?.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: dy,
        deltaMode: 0,
        clientX: sx,
        clientY: sy
      }));
    }, { dy: deltaY, sx: x, sy: y });
    await sleep(30);
  }
}

const steps = [];
let shotIndex = 0;

async function shot(page, name, note = '') {
  shotIndex += 1;
  const file = `${String(shotIndex).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(outDir, file), fullPage: false });
  const p = await probe(page);
  steps.push({
    index: shotIndex,
    name,
    file,
    note,
    focusKind: p.focusKind,
    stage: p.stage,
    camera: p.camera,
    navigating: p.navigating,
    zoomPct: p.zoomPct,
    scope: p.scope,
    shell: p.shell,
    midInside: p.midInside,
    softCount: p.softCount,
    quietCount: p.quietCount,
    stagedCount: p.stagedCount,
    ghostDomains: p.ghostDomains?.map((d) => ({ name: d.name, countLabel: d.countLabel, entityCount: d.entityCount })),
    scaledQuiet: p.scaledQuiet,
    scaledSoftEntities: p.scaledSoftEntities,
    domains: p.domains?.map((d) => ({
      name: d.name,
      soft: d.soft,
      quiet: d.quiet,
      staged: d.staged,
      focus: d.focus,
      depth: d.depth,
      countLabel: d.countLabel,
      entityCount: d.entityCount,
      entities: d.entities.map((e) => ({
        id: e.id.slice(0, 8),
        soft: e.soft,
        quiet: e.quiet,
        focus: e.focus,
        depth: e.depth,
        scale: e.scale,
        opacity: e.opacity
      }))
    }))
  });
  console.log(`[shot] ${file} focus=${p.focusKind} stage=${p.stage} mid=${p.midInside} soft=${p.softCount} quiet=${p.quietCount}`);
  return p;
}

async function main() {
  execFileSync('bun', ['apps/service-management/scripts/sync-service-management-cana-bundle.js'], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  const tempDir = createTempConfigDir({ '.env.dev': envFileContent('express') });
  let server;
  let browser;
  let mediaOk = false;
  let mediaSize = 0;
  let pwVideoPath = null;

  try {
    server = await startServer(tempDir);
    await waitForServer(server.port);
    const baseUrl = `http://127.0.0.1:${String(server.port)}/`;
    browser = await webkit.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: outDir, size: { width: 1440, height: 900 } }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);

    await hardReload(page, baseUrl);
    await shot(page, 'boot', 'after SW unregister');

    const mediaStart = await startMediaRecorder(page).catch((err) => ({ ok: false, reason: String(err) }));
    mediaOk = Boolean(mediaStart?.ok);
    console.log(`[media] start ok=${mediaOk} ${mediaStart?.mime || mediaStart?.reason || ''}`);

    // Load sample
    const loadBtn = page.locator('#domain-designer-empty-load-sample-btn');
    if (await loadBtn.count()) {
      await loadBtn.click();
      await page.waitForSelector('.canvas .entity', { timeout: 20000 });
      await settle(page, 900);
    }
    await shot(page, 'load-sample');

    await openDesignerPanels(page, '#domain-list');
    await settle(page, 400);

    // Overview
    await page.evaluate(() => document.getElementById('canvas')?.click());
    await settle(page, 900);
    await shot(page, 'overview');

    // Domains
    await clickTreeDomain(page, 'Tasks');
    await settle(page, 800);
    await shot(page, 'domain-tasks');

    await clickTreeDomain(page, 'Users');
    await settle(page, 800);
    await shot(page, 'domain-users');

    // Entities via tree
    await expandDomain(page, 'Users');
    await clickTreeEntity(page, 'User');
    await settle(page, 800);
    await shot(page, 'entity-user');

    await expandDomain(page, 'Tasks');
    await clickTreeEntity(page, 'Task');
    await settle(page, 800);
    const taskProbe = await shot(page, 'entity-task');

    if (!SHORT) {
      await clickTreeEntity(page, 'Comment');
      await settle(page, 800);
      await shot(page, 'entity-comment');

      // Fields on Task
      await clickTreeEntity(page, 'Task');
      await settle(page, 600);
      for (const field of ['assigneeId', 'title', 'projectId']) {
        const clicked = await page.evaluate((wanted) => {
          const row = document.querySelector(`.entity-field-row[data-field-name="${wanted}"]`);
          if (!row) return false;
          row.scrollIntoView({ block: 'center' });
          row.click();
          return true;
        }, field);
        await settle(page, 650);
        await shot(page, `field-${field}`, clicked ? '' : 'missing');
      }

      // Relationship edge
      await page.evaluate(() => document.getElementById('canvas')?.click());
      await settle(page, 800);
      const relId = await page.evaluate(() => {
        const hit = document.querySelector('.edges .edge-hit[data-relationship-id]');
        return hit?.dataset?.relationshipId || null;
      });
      if (relId) {
        await page.locator(`.edge-hit[data-relationship-id="${relId}"]`).first().click({ force: true });
        await settle(page, 750);
        await shot(page, 'edge-select', relId);
      } else {
        await shot(page, 'edge-select', 'no edge-hit');
      }
    }

    // Zoom wheel in/out
    await clickTreeEntity(page, 'Task').catch(() => undefined);
    await settle(page, 500);
    await wheelZoom(page, -120, 8);
    await settle(page, 500);
    await shot(page, 'zoom-wheel-in');
    await wheelZoom(page, 120, 10);
    await settle(page, 500);
    await shot(page, 'zoom-wheel-out');

    // Toolbar zoom
    const zoomIn = page.locator('#zoom-in-btn, [data-action="zoom-in"], button[aria-label*="Zoom in" i]').first();
    const zoomOut = page.locator('#zoom-out-btn, [data-action="zoom-out"], button[aria-label*="Zoom out" i]').first();
    if (await zoomIn.count()) {
      await zoomIn.click({ force: true }).catch(() => undefined);
      await settle(page, 400);
      await shot(page, 'zoom-toolbar-in');
    }
    if (await zoomOut.count()) {
      await zoomOut.click({ force: true }).catch(() => undefined);
      await settle(page, 400);
      await shot(page, 'zoom-toolbar-out');
    }

    // Fit / reset
    const fit = page.locator('#fit-view-btn, [data-action="fit"], button[aria-label*="Fit" i]').first();
    const reset = page.locator('#reset-view-btn, [data-action="reset-view"], button[aria-label*="Reset" i]').first();
    if (await fit.count()) {
      await fit.click({ force: true }).catch(() => undefined);
      await settle(page, 700);
      await shot(page, 'fit-view');
    }
    if (await reset.count()) {
      await reset.click({ force: true }).catch(() => undefined);
      await settle(page, 700);
      await shot(page, 'reset-view');
    }

    // Minimap
    const mm = page.locator('.mini-map-viewport, #mini-map, .minimap').first();
    if (await mm.count()) {
      await mm.click({ force: true }).catch(() => undefined);
      await settle(page, 500);
      await shot(page, 'minimap-click');
    }

    // Escape reverse from field
    await clickTreeEntity(page, 'Task');
    await settle(page, 500);
    await page.evaluate(() => {
      const row = document.querySelector('.entity-field-row[data-field-name="assigneeId"]')
        || document.querySelector('.entity-field-row[data-field-name]');
      row?.scrollIntoView({ block: 'center' });
      row?.click();
    });
    await settle(page, 600);
    await shot(page, 'esc-start-field');
    for (const label of ['esc-to-entity', 'esc-to-domain', 'esc-to-overview']) {
      await page.keyboard.press('Escape');
      await waitCameraIdle(page);
      await settle(page, 500);
      await shot(page, label);
    }

    // Soft/quiet peer re-focus: select Task then click quiet/soft peer User
    await expandDomain(page, 'Tasks');
    await clickTreeEntity(page, 'Task');
    await settle(page, 800);
    await shot(page, 'refocus-task');
    const peerBox = await page.evaluate(() => {
      const peer = document.querySelector('.entity.is-soft[data-entity-id], .entity.is-quiet[data-entity-id]');
      if (!peer) return null;
      peer.scrollIntoView({ block: 'center' });
      const grip = peer.querySelector('.entity-drag-grip, .entity-header');
      const rect = (grip || peer).getBoundingClientRect();
      return {
        id: peer.dataset.entityId || '',
        x: rect.left + Math.min(12, rect.width / 2),
        y: rect.top + Math.min(12, rect.height / 2),
        classes: peer.className
      };
    });
    if (peerBox) {
      await page.mouse.click(peerBox.x, peerBox.y);
      await waitCameraIdle(page);
      await settle(page, 600);
      const after = await probe(page);
      await shot(
        page,
        'refocus-quiet-peer',
        `${peerBox.id} → ${after.scope || after.focusKind}`
      );
    } else {
      await shot(page, 'refocus-quiet-peer', 'no soft/quiet peer');
    }

    await shot(page, 'final', `taskProbe soft=${taskProbe.softCount}`);

    // Stop MediaRecorder
    if (mediaOk) {
      const stopped = await stopMediaRecorder(page);
      if (stopped?.ok && stopped.bytes?.length) {
        const mediaPath = path.join(outDir, 'tour-mediarecorder.webm');
        fs.writeFileSync(mediaPath, Buffer.from(Uint8Array.from(stopped.bytes)));
        mediaSize = stopped.size;
        console.log(`[media] wrote ${mediaPath} bytes=${mediaSize}`);
      } else {
        mediaOk = false;
        console.log(`[media] stop failed: ${stopped?.reason || 'empty'}`);
      }
    }

    await context.close();
    // Playwright writes video after context close
    const videos = fs.readdirSync(outDir).filter((f) => f.endsWith('.webm'));
    const pwVid = videos.find((f) => f !== 'tour-mediarecorder.webm' && f !== 'tour.webm');
    if (pwVid) {
      const dest = path.join(outDir, 'tour.webm');
      fs.renameSync(path.join(outDir, pwVid), dest);
      pwVideoPath = dest;
      console.log(`[video] playwright -> ${dest}`);
    }
  } finally {
    if (browser) await browser.close();
    stopServer(server);
    cleanupTempConfigDir(tempDir);
  }

  // ffmpeg frame extract
  let frameCount = 0;
  if (pwVideoPath && fs.existsSync(pwVideoPath)) {
    try {
      execFileSync('ffmpeg', [
        '-y', '-i', pwVideoPath,
        '-vf', 'fps=2',
        path.join(framesDir, 'frame-%03d.png')
      ], { stdio: 'pipe' });
      frameCount = fs.readdirSync(framesDir).filter((f) => f.endsWith('.png')).length;
      console.log(`[ffmpeg] extracted ${frameCount} frames`);
    } catch (err) {
      console.log(`[ffmpeg] failed: ${String(err?.message || err).slice(0, 200)}`);
    }
  }

  // Findings from probes
  const findings = [];
  const shells = new Set(steps.map((s) => s.shell).filter(Boolean));
  if ([...shells].some((s) => s !== EXPECTED_SHELL)) {
    findings.push({
      severity: 'high',
      id: 'stale-shell',
      detail: `Shell mismatch: got ${[...shells].join(',')} expected ${EXPECTED_SHELL}`
    });
  }
  const ghostSteps = steps.filter((s) => (s.ghostDomains || []).length);
  if (ghostSteps.length) {
    findings.push({
      severity: 'high',
      id: 'ghost-0-entities',
      detail: `Ghost 0-entity domains at: ${ghostSteps.map((s) => s.name).join(', ')}`,
      samples: ghostSteps.slice(0, 4).map((s) => ({ step: s.name, ghosts: s.ghostDomains }))
    });
  }
  const stagedSteps = steps.filter((s) => s.stagedCount > 0);
  if (stagedSteps.length) {
    findings.push({
      severity: 'high',
      id: 'peers-hidden-staged-away',
      detail: `is-staged-away still applied: ${stagedSteps.map((s) => `${s.name}:${s.stagedCount}`).join(', ')}`
    });
  }
  const entityFocusNoDepth = steps.filter((s) => (
    (s.focusKind === 'entity' || s.focusKind === 'field')
    && s.quietCount === 0
    && s.softCount === 0
  ));
  if (entityFocusNoDepth.length) {
    findings.push({
      severity: 'high',
      id: 'depth-tiers-missing',
      detail: `Entity/field focus without soft/quiet: ${entityFocusNoDepth.map((s) => s.name).join(', ')}`
    });
  }
  const entityFocusNoScale = steps.filter((s) => (
    (s.focusKind === 'entity' || s.focusKind === 'field')
    && s.quietCount > 0
    && !s.scaledQuiet
    && !s.scaledSoftEntities
  ));
  if (entityFocusNoScale.length) {
    findings.push({
      severity: 'medium',
      id: 'secondary-not-scaled',
      detail: `Quiet/soft present but computed scale ~1: ${entityFocusNoScale.map((s) => s.name).join(', ')}`
    });
  }
  const midHits = steps.filter((s) => Number(s.midInside) > 0);
  if (midHits.length) {
    findings.push({
      severity: 'high',
      id: 'midInside-hits',
      detail: midHits.map((s) => `${s.name}:${s.midInside}`).join(', ')
    });
  }
  const cameraMissing = steps.filter((s) => (
    ['entity-user', 'entity-task', 'entity-comment', 'domain-tasks', 'domain-users'].includes(s.name)
    && s.camera !== '3'
    && !s.navigating
  ));
  // Camera3 may have already settled; check navigating was true is hard post-hoc —
  // flag only if focus kind wrong after entity click.
  const badFocus = steps.filter((s) => (
    s.name.startsWith('entity-') && s.focusKind !== 'entity' && s.focusKind !== 'field'
  ));
  if (badFocus.length) {
    findings.push({
      severity: 'high',
      id: 'entity-click-no-focus',
      detail: badFocus.map((s) => `${s.name}->${s.focusKind}`).join(', ')
    });
  }
  const peerDead = steps.find((s) => s.name === 'refocus-quiet-peer');
  const peerBefore = steps.find((s) => s.name === 'refocus-task');
  if (peerDead && peerDead.note && peerDead.note.includes('no soft')) {
    findings.push({
      severity: 'high',
      id: 'quiet-peer-missing',
      detail: peerDead.note
    });
  } else if (peerDead && peerBefore && peerDead.scope === peerBefore.scope) {
    findings.push({
      severity: 'high',
      id: 'quiet-peer-dead-click',
      detail: `Peer click did not change scope (still ${peerDead.scope}); note=${peerDead.note}`
    });
  } else if (peerDead && peerDead.focusKind !== 'entity' && peerDead.focusKind !== 'field') {
    findings.push({
      severity: 'high',
      id: 'quiet-peer-dead-click',
      detail: `After peer click focusKind=${peerDead.focusKind} scope=${peerDead.scope}`
    });
  }

  const zoomIn = steps.find((s) => s.name === 'zoom-wheel-in');
  const zoomOut = steps.find((s) => s.name === 'zoom-wheel-out');
  if (zoomIn && zoomOut) {
    const zin = Number.parseFloat(zoomIn.zoomPct);
    const zout = Number.parseFloat(zoomOut.zoomPct);
    if (!(zin > zout)) {
      findings.push({
        severity: 'high',
        id: 'zoom-not-fluid',
        detail: `wheel-in ${zoomIn.zoomPct} then wheel-out ${zoomOut.zoomPct}`
      });
    }
  }

  if (!findings.length) {
    findings.push({ severity: 'info', id: 'clean', detail: 'No automated probe failures on this tour.' });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    branch: execFileSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
    expectedShell: EXPECTED_SHELL,
    short: SHORT,
    shotCount: shotIndex,
    video: pwVideoPath ? path.relative(repoRoot, pwVideoPath) : null,
    mediaRecorder: mediaOk ? 'tour-mediarecorder.webm' : null,
    mediaRecorderBytes: mediaSize,
    frameCount,
    findings,
    steps
  };
  fs.writeFileSync(path.join(outDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));

  const analysis = [
    '# Nav video pass — ANALYSIS',
    '',
    `- Generated: ${manifest.generatedAt}`,
    `- Branch: \`${manifest.branch}\``,
    `- Shell expected: **${EXPECTED_SHELL}** (observed: ${[...shells].join(', ') || 'n/a'})`,
    `- Mode: ${SHORT ? 'short verify' : 'full tour'}`,
    `- Shots: **${shotIndex}**`,
    `- Playwright video: \`${pwVideoPath ? 'tour.webm' : 'MISSING'}\``,
    `- MediaRecorder: \`${mediaOk ? 'tour-mediarecorder.webm' : 'unavailable/failed'}\` (${mediaSize} bytes)`,
    `- ffmpeg frames: **${frameCount}** under \`frames/\``,
    '',
    '## Findings',
    '',
    ...findings.map((f) => `- **[${f.severity}] ${f.id}:** ${f.detail}`),
    '',
    '## Step matrix',
    '',
    '| # | Step | Focus | Stage | Zoom | midInside | soft | quiet | staged | Ghosts |',
    '| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |',
    ...steps.map((s) => (
      `| ${s.index} | ${s.name} | ${s.focusKind} | ${s.stage} | ${s.zoomPct} | ${s.midInside} | ${s.softCount} | ${s.quietCount} | ${s.stagedCount} | ${(s.ghostDomains || []).map((g) => g.name).join(';') || '—'} |`
    )),
    '',
    '## Before / after',
    '',
    '_Filled after fixes + short re-verify._',
    '',
    '## Notes',
    '',
    '- Primary capture: Playwright WebKit `recordVideo`.',
    '- Secondary: in-page `MediaRecorder` on `#tab-domain-designer.captureStream(30)` (no getDisplayMedia / no share UI).',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'ANALYSIS.md'), analysis);

  console.log(`\n[nav-video] wrote ${outDir} shots=${shotIndex} findings=${findings.length}`);
  findings.forEach((f) => console.log(`  - [${f.severity}] ${f.id}: ${f.detail}`));
  if (findings.some((f) => f.severity === 'high')) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
