#!/usr/bin/env bun
/**
 * JUM-918 exhaustive Playwright evidence pack (no commit).
 * Captures navigation/selection screenshots + midInside CDP + comparison matrix.
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
  'apps/service-management/test/artifacts/edge-ux-playwright'
);
const refDir = '/Users/eduardoalmeida/.cursor/projects/Users-eduardoalmeida-apps-Jumentix/assets';

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

async function settle(page, ms = 700) {
  await sleep(ms);
  await page.waitForTimeout(120);
}

async function shot(page, name, note = '') {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const meta = {
    name,
    file,
    note,
    scope: await page.locator('#canvas-scope-path').textContent().catch(() => ''),
    focusKind: await page.locator('#canvas').getAttribute('data-focus-kind').catch(() => null),
    stage: await page.locator('#canvas').getAttribute('data-canvas-stage').catch(() => null),
    shell: await page.locator('script[src*="script.js?v="]').first().getAttribute('src').catch(() => '')
  };
  console.log(`[shot] ${name} scope="${meta.scope}" focus=${meta.focusKind} stage=${meta.stage}`);
  return meta;
}

const MID_INSIDE_PROBE_SOURCE = `(() => {
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
  const byRelationship = [];
  let totalHits = 0;
  const paths = document.querySelectorAll('.edges .edge-line[data-relationship-id]');
  for (let pi = 0; pi < paths.length; pi += 1) {
    const edgePath = paths[pi];
    const style = window.getComputedStyle(edgePath);
    if (style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity || '1') < 0.05) {
      continue;
    }
    if (edgePath.classList.contains('is-staged-away') || edgePath.classList.contains('is-quiet')) {
      continue;
    }
    const hits = scorePath(edgePath);
    totalHits += hits;
    byRelationship.push({
      id: edgePath.dataset.relationshipId || '',
      hits: hits,
      d: (edgePath.getAttribute('d') || '').slice(0, 120)
    });
  }
  const ghostVerticalIds = [];
  for (let gi = 0; gi < byRelationship.length; gi += 1) {
    const entry = byRelationship[gi];
    const nums = (entry.d.match(/-?\\d+(\\.\\d+)?/g) || []).map(Number);
    if (nums.length < 4) continue;
    const xs = [];
    const ys = [];
    for (let i = 0; i < nums.length; i += 2) xs.push(nums[i]);
    for (let i = 1; i < nums.length; i += 2) ys.push(nums[i]);
    const xSpan = Math.max.apply(null, xs) - Math.min.apply(null, xs);
    const ySpan = Math.max.apply(null, ys) - Math.min.apply(null, ys);
    if (xSpan < 24 && ySpan > 120) ghostVerticalIds.push(entry.id);
  }
  let labelsOnCards = 0;
  const labels = document.querySelectorAll('.edges .edge-name-label');
  for (let li = 0; li < labels.length; li += 1) {
    const label = labels[li];
    const labelStyle = window.getComputedStyle(label);
    if (labelStyle.display === 'none' || label.classList.contains('is-staged-away') || label.classList.contains('is-quiet')) {
      continue;
    }
    const rect = label.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let bi = 0; bi < entityBoxes.length; bi += 1) {
      const box = entityBoxes[bi];
      if (cx > box.left && cx < box.right && cy > box.top && cy < box.bottom) {
        labelsOnCards += 1;
        break;
      }
    }
  }
  let stagedGhosts = 0;
  const staged = document.querySelectorAll('.domain.is-staged-away');
  for (let si = 0; si < staged.length; si += 1) {
    const style = window.getComputedStyle(staged[si]);
    if (style.visibility !== 'hidden' && Number.parseFloat(style.opacity || '1') > 0.05) stagedGhosts += 1;
  }
  // Blur so focus-within does not intentionally reveal off-state PK chips.
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  const pkOnCount = document.querySelectorAll('.field-pk.on').length;
  let pkOffVisible = 0;
  const pkOff = document.querySelectorAll('.field-pk:not(.on)');
  for (let pi = 0; pi < pkOff.length; pi += 1) {
    const style = window.getComputedStyle(pkOff[pi]);
    if (style.opacity !== '0' && style.visibility !== 'hidden' && style.width !== '0px') pkOffVisible += 1;
  }
  byRelationship.sort(function (a, b) { return b.hits - a.hits; });
  const shellEl = document.querySelector('script[src*="script.js?v="]');
  const shellMatch = shellEl && shellEl.src ? shellEl.src.match(/v=([\\d.]+)/) : null;
  const canvas = document.getElementById('canvas');
  const scopeEl = document.getElementById('canvas-scope-path');
  const usersDomain = Array.from(document.querySelectorAll('.domain[data-domain-id]'))
    .find((node) => ((node.querySelector('.domain-title') || {}).textContent || '') === 'Users');
  const tasksDomain = Array.from(document.querySelectorAll('.domain[data-domain-id]'))
    .find((node) => ((node.querySelector('.domain-title') || {}).textContent || '') === 'Tasks');
  const usersEntityDomCount = usersDomain
    ? usersDomain.querySelectorAll('.entity[data-entity-id]').length
    : 0;
  const usersLabel = usersDomain && usersDomain.querySelector('.entity-count')
    ? (usersDomain.querySelector('.entity-count').textContent || '')
    : '';
  const focusDomains = Array.from(document.querySelectorAll('.domain.is-focus')).map((node) => (
    (node.querySelector('.domain-title') || {}).textContent || node.dataset.domainId || ''
  ));
  const domainDepth = (node) => {
    if (!node) return null;
    return {
      name: (node.querySelector('.domain-title') || {}).textContent || '',
      focus: node.classList.contains('is-focus'),
      soft: node.classList.contains('is-soft'),
      quiet: node.classList.contains('is-quiet'),
      stageDepth: node.dataset.stageDepth || null,
      opacity: Number.parseFloat(window.getComputedStyle(node).opacity || '1')
    };
  };
  const zoomPct = canvas && canvas.dataset
    ? Math.round((Number(document.documentElement.style.getPropertyValue('--canvas-zoom'))
      || Number((window.__jxView && window.__jxView.zoom) || 0)
      || 0) * 100)
    : 0;
  // Prefer live view zoom from canvas transform / data attribute when exposed.
  let liveZoom = null;
  try {
    const zoomLabel = document.getElementById('zoom-indicator');
    const m = zoomLabel && zoomLabel.textContent ? zoomLabel.textContent.match(/(\\d+)\\s*%/) : null;
    if (m) liveZoom = Number(m[1]);
  } catch (_e) { /* ignore */ }
  return {
    totalHits: totalHits,
    byRelationship: byRelationship,
    ghostVerticalIds: ghostVerticalIds,
    labelsOnCards: labelsOnCards,
    stagedGhosts: stagedGhosts,
    pkOnCount: pkOnCount,
    pkOffVisible: pkOffVisible,
    usersEntityDomCount: usersEntityDomCount,
    usersLabel: usersLabel,
    shell: shellMatch ? shellMatch[1] : 'unknown',
    scope: scopeEl ? (scopeEl.textContent || '') : '',
    focusKind: canvas && canvas.dataset ? (canvas.dataset.focusKind || 'none') : 'none',
    canvasStage: canvas && canvas.dataset ? (canvas.dataset.canvasStage || 'overview') : 'overview',
    focusDomainNames: focusDomains,
    focusDomainCount: focusDomains.length,
    usersDepth: domainDepth(usersDomain),
    tasksDepth: domainDepth(tasksDomain),
    zoomPct: liveZoom != null ? liveZoom : zoomPct
  };
})()`;

async function probePage(page) {
  return page.evaluate(MID_INSIDE_PROBE_SOURCE);
}

async function clickTreeDomain(page, name) {
  await openDesignerPanels(page, '#domain-list');
  const btn = page.locator('#domain-list .domain-tree-domain').filter({
    has: page.locator('.domain-tree-name', { hasText: new RegExp(`^${name}$`) })
  }).first();
  await btn.click();
  await settle(page, 900);
}

async function ensureDomainExpanded(page, domainName) {
  await openDesignerPanels(page, '#domain-list');
  const domainItem = page.locator('#domain-list .domain-tree-item').filter({
    has: page.locator('.domain-tree-domain .domain-tree-name', { hasText: new RegExp(`^${domainName}$`) })
  }).first();
  const children = domainItem.locator(':scope > .domain-tree-children');
  const hidden = await children.getAttribute('hidden');
  if (hidden !== null) {
    await domainItem.locator('.domain-tree-toggle').click();
    await settle(page, 350);
  }
  return domainItem;
}

async function clickTreeEntity(page, domainName, entityName) {
  const domainItem = await ensureDomainExpanded(page, domainName);
  const entityBtn = domainItem.locator('.domain-tree-entity > button').filter({
    has: page.locator(':scope > .domain-tree-name', { hasText: new RegExp(`^${entityName}$`) })
  }).first();
  await entityBtn.waitFor({ state: 'visible', timeout: 10000 });
  await entityBtn.click();
  await settle(page, 1000);
  // Confirm scope path mentions the entity; fallback to canvas card click.
  const scope = await page.locator('#canvas-scope-path').textContent();
  if (!new RegExp(entityName, 'i').test(scope || '')) {
    const card = page.locator('.canvas .entity').filter({ hasText: entityName }).first();
    await card.click({ force: true });
    await settle(page, 1000);
  }
}

async function clickCanvasField(page, fieldName) {
  await page.waitForSelector(
    `.entity.selected .entity-field-row[data-field-name="${fieldName}"], .entity.is-focus .entity-field-row[data-field-name="${fieldName}"], .entity-field-row[data-field-name="${fieldName}"]`,
    { state: 'attached', timeout: 15000 }
  );
  const ok = await page.evaluate((name) => {
    const preferred = document.querySelector(
      `.entity.selected .entity-field-row[data-field-name="${name}"], .entity.is-focus .entity-field-row[data-field-name="${name}"]`
    );
    const row = preferred || document.querySelector(`.entity-field-row[data-field-name="${name}"]`);
    if (!row) return false;
    const nameInput = row.querySelector('.field-name-input');
    if (nameInput) {
      nameInput.focus();
      nameInput.click();
      return true;
    }
    row.click();
    return true;
  }, fieldName);
  if (!ok) throw new Error(`field row not found: ${fieldName}`);
  await settle(page, 1100);
}

async function clickRelationship(page, relationshipId) {
  // Unstage peers first: overview → click keeps the edge visible.
  const visible = page.locator(
    `.edge-hit[data-relationship-id="${relationshipId}"]:not(.is-staged-away):not(.is-quiet)`
  ).first();
  if (await visible.count()) {
    await visible.click({ force: true });
  } else {
    // Select via tree link button when painted edge is staged away.
    await openDesignerPanels(page, '#domain-list');
    const link = page.locator(
      `#domain-list .domain-tree-link button`
    ).filter({ hasText: /→|←/ }).first();
    // Prefer evaluate: find relationship by dataset if present, else click canvas hit with force after overview.
    await page.locator('#canvas-overview-btn').click().catch(() => {});
    await settle(page, 600);
    const hit = page.locator(`.edge-hit[data-relationship-id="${relationshipId}"]`).first();
    await hit.click({ force: true });
    void link;
  }
  await settle(page, 1100);
}

async function hoverRelationship(page, relationshipId) {
  const hit = page.locator(
    `.edge-hit[data-relationship-id="${relationshipId}"]:not(.is-staged-away)`
  ).first();
  if (await hit.count()) {
    await hit.hover({ force: true });
  } else {
    await page.locator(`.edge-hit[data-relationship-id="${relationshipId}"]`).first().hover({ force: true });
  }
  await settle(page, 400);
}

async function pressEsc(page) {
  await page.keyboard.press('Escape');
  await settle(page, 800);
}

async function main() {
  execFileSync('bun', ['apps/service-management/scripts/sync-service-management-cana-bundle.js'], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  const tempDir = createTempConfigDir({ '.env.dev': envFileContent('express') });
  let server;
  let browser;
  const shots = [];
  const probes = {};

  try {
    server = await startServer(tempDir);
    await waitForServer(server.port);
    const baseUrl = `http://127.0.0.1:${String(server.port)}/`;
    browser = await webkit.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);

    await page.goto(baseUrl, { waitUntil: 'load' });
    // Soft + hard refresh so SW serves shell 0.9.148 (not a stale cache).
    await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
      if (window.caches?.keys) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }
    });
    await page.reload({ waitUntil: 'load' });
    shots.push(await shot(page, '00-boot-empty', 'empty first-run after hard reload'));

    await page.click('#domain-designer-empty-load-sample-btn');
    await page.waitForSelector('.canvas .entity', { timeout: 20000 });
    await settle(page, 1000);
    shots.push(await shot(page, '01-sample-overview', 'sample loaded overview'));
    probes.overview = await probePage(page);

    // Domain browse / select — THIS is the live 7.34.08AM broken scene.
    await clickTreeDomain(page, 'Tasks');
    shots.push(await shot(page, '02-domain-tasks', 'domain Tasks + Users soft peers (vs 7.34.08AM)'));
    probes.domainTasks = await probePage(page);

    await clickTreeDomain(page, 'Users');
    // Exclusive Users focus contract: Camera3 + unique is-focus + soft/quiet Tasks.
    const usersExclusive = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      const focusDomains = Array.from(document.querySelectorAll('.domain.is-focus'));
      const users = Array.from(document.querySelectorAll('.domain[data-domain-id]'))
        .find((n) => ((n.querySelector('.domain-title') || {}).textContent || '') === 'Users');
      const tasks = Array.from(document.querySelectorAll('.domain[data-domain-id]'))
        .find((n) => ((n.querySelector('.domain-title') || {}).textContent || '') === 'Tasks');
      const zoomLabel = document.getElementById('zoom-indicator');
      const zoomMatch = zoomLabel?.textContent?.match(/(\d+)\s*%/);
      return {
        focusKind: canvas?.dataset?.focusKind || 'none',
        stage: canvas?.dataset?.canvasStage || 'overview',
        focusCount: focusDomains.length,
        usersIsFocus: Boolean(users?.classList.contains('is-focus')),
        tasksSoftOrQuiet: Boolean(
          tasks?.classList.contains('is-soft') || tasks?.classList.contains('is-quiet')
        ),
        tasksOpacity: tasks ? Number.parseFloat(getComputedStyle(tasks).opacity || '1') : null,
        usersOpacity: users ? Number.parseFloat(getComputedStyle(users).opacity || '1') : null,
        zoomPct: zoomMatch ? Number(zoomMatch[1]) : null
      };
    });
    if (
      usersExclusive.focusKind !== 'domain'
      || usersExclusive.stage !== 'focus'
      || usersExclusive.focusCount !== 1
      || !usersExclusive.usersIsFocus
      || !usersExclusive.tasksSoftOrQuiet
      || !(usersExclusive.tasksOpacity < 0.4)
      || !(usersExclusive.zoomPct == null || usersExclusive.zoomPct >= 70)
    ) {
      console.error('[assert] Users exclusive focus FAILED', usersExclusive);
      throw new Error(
        `Users exclusive focus failed: ${JSON.stringify(usersExclusive)}`
      );
    }
    console.log('[assert] Users exclusive focus OK', usersExclusive);
    shots.push(await shot(page, '03-domain-users', 'domain Users exclusive + Tasks soft'));
    probes.domainUsers = await probePage(page);
    probes.domainUsersExclusive = usersExclusive;

    // Entity selects — Tasks side
    await clickTreeEntity(page, 'Tasks', 'Project');
    shots.push(await shot(page, '04-entity-project', 'entity Project'));
    probes.entityProject = await probePage(page);

    await clickTreeEntity(page, 'Tasks', 'Task');
    shots.push(await shot(page, '05-entity-task', 'entity Task'));
    probes.entityTask = await probePage(page);

    await clickTreeEntity(page, 'Tasks', 'Comment');
    shots.push(await shot(page, '06-entity-comment', 'entity Comment'));

    // Users-side entities
    await clickTreeEntity(page, 'Users', 'User');
    shots.push(await shot(page, '07-entity-user', 'entity User'));
    await clickTreeEntity(page, 'Users', 'Organization');
    shots.push(await shot(page, '08-entity-organization', 'entity Organization'));

    // Field selects
    await clickTreeEntity(page, 'Tasks', 'Task');
    await clickCanvasField(page, 'assigneeId');
    shots.push(await shot(page, '09-field-assigneeId', 'field Task.assigneeId'));
    probes.fieldAssignee = await probePage(page);

    await clickCanvasField(page, 'projectId');
    shots.push(await shot(page, '10-field-projectId', 'field Task.projectId'));
    probes.fieldProjectId = await probePage(page);

    await clickTreeEntity(page, 'Tasks', 'Comment');
    await clickCanvasField(page, 'taskId');
    shots.push(await shot(page, '11-field-taskId', 'field Comment.taskId'));
    probes.fieldTaskId = await probePage(page);

    // Relationship hover / select
    await pressEsc(page); // to entity
    await pressEsc(page); // to domain
    await clickTreeEntity(page, 'Tasks', 'Task');
    await hoverRelationship(page, 'sample-rel-task-project');
    shots.push(await shot(page, '12-rel-hover-task-project', 'hover Project↔Task'));
    await clickRelationship(page, 'sample-rel-task-project');
    shots.push(await shot(page, '13-rel-select-task-project', 'select Project↔Task'));
    probes.relTaskProject = await probePage(page);

    // Cross-domain / other edges: return to Task entity so incident edges unstage.
    await pressEsc(page);
    await clickTreeEntity(page, 'Tasks', 'Task');
    await clickRelationship(page, 'sample-rel-task-assignee');
    shots.push(await shot(page, '14-rel-select-task-assignee', 'select Task→User assignee'));
    probes.relAssignee = await probePage(page);

    await pressEsc(page);
    await clickTreeEntity(page, 'Tasks', 'Comment');
    await clickRelationship(page, 'sample-rel-comment-task');
    shots.push(await shot(page, '15-rel-select-comment-task', 'select Comment→Task'));

    // Esc hierarchical back-out
    await clickTreeEntity(page, 'Tasks', 'Task');
    await clickCanvasField(page, 'assigneeId');
    shots.push(await shot(page, '16-esc-start-field', 'before Esc ladder'));
    await pressEsc(page);
    shots.push(await shot(page, '17-esc-to-entity', 'Esc → entity'));
    await pressEsc(page);
    shots.push(await shot(page, '18-esc-to-domain', 'Esc → domain'));
    await pressEsc(page);
    shots.push(await shot(page, '19-esc-to-overview', 'Esc → overview'));
    probes.afterEscOverview = await probePage(page);

    // Camera3 focus scenarios via overview button + reselect
    await clickTreeEntity(page, 'Tasks', 'Project');
    await settle(page, 1100);
    shots.push(await shot(page, '20-camera3-entity-project', 'Camera3 settle on Project'));
    await clickRelationship(page, 'sample-rel-task-project');
    await settle(page, 1100);
    shots.push(await shot(page, '21-camera3-relationship', 'Camera3 settle on relationship'));
    await clickTreeEntity(page, 'Tasks', 'Task');
    await clickCanvasField(page, 'assigneeId');
    await settle(page, 1100);
    shots.push(await shot(page, '22-camera3-field-assignee', 'Camera3 settle on field'));
    probes.camera3Field = await probePage(page);

    // Structure create (domain create visible at overview)
    await pressEsc(page);
    await pressEsc(page);
    await pressEsc(page);
    await openDesignerPanels(page, '#domain-name-input');
    shots.push(await shot(page, '23-structure-create-domain', 'structure create domain toolbar'));

    // Final overview midInside golden
    await page.locator('#canvas-overview-btn').click().catch(() => {});
    await settle(page, 900);
    shots.push(await shot(page, '24-final-overview', 'final overview'));
    probes.finalOverview = await probePage(page);

    await context.close();
  } finally {
    if (browser) await browser.close();
    stopServer(server);
    cleanupTempConfigDir(tempDir);
  }

  const midInsideCommand = 'rtk proxy bun apps/service-management/scripts/capture-edge-ux-evidence.mjs';
  const summary = {
    generatedAt: new Date().toISOString(),
    branch: 'cursor/feature/edge-focus-camera3-mvp',
    shellExpected: '0.9.148',
    midInsideCommand,
    probes,
    shots: shots.map((s) => ({ name: s.name, file: s.file, scope: s.scope, focusKind: s.focusKind })),
    pass: {
      overviewMidInside0: probes.overview?.totalHits === 0,
      domainTasksMidInside0: probes.domainTasks?.totalHits === 0,
      relTaskProjectMidInside0: probes.relTaskProject?.totalHits === 0,
      fieldAssigneeMidInside0: probes.fieldAssignee?.totalHits === 0,
      finalOverviewMidInside0: probes.finalOverview?.totalHits === 0,
      noGhostVerticalsOverview: (probes.overview?.ghostVerticalIds || []).length === 0,
      noStagedGhostsOnField: probes.fieldAssignee?.stagedGhosts === 0,
      shell117: probes.overview?.shell === '0.9.148',
      tasksSoftPeersMounted: (probes.domainTasks?.usersEntityDomCount || 0) > 0,
      usersExclusiveFocus: Boolean(
        probes.domainUsersExclusive?.focusKind === 'domain'
        && probes.domainUsersExclusive?.usersIsFocus
        && probes.domainUsersExclusive?.focusCount === 1
        && probes.domainUsersExclusive?.tasksSoftOrQuiet
        && probes.domainUsersExclusive?.tasksOpacity < 0.4
        && (probes.domainUsersExclusive?.zoomPct == null
          || probes.domainUsersExclusive.zoomPct >= 70)
      )
    }
  };

  fs.writeFileSync(path.join(outDir, 'midInside.json'), JSON.stringify(summary, null, 2));

  const refShots = fs.existsSync(refDir)
    ? fs.readdirSync(refDir).filter((f) => f.startsWith('Screenshot_2026-10-11_') && f.endsWith('.png')).sort()
    : [];

  const matrixRows = [
    {
      scene: 'Sample overview (Users+Tasks)',
      broken: 'Floating vertical gutters between domains; lines through cards; parallel bars',
      after: '01-sample-overview.png',
      midInside: probes.overview?.totalHits,
      ghostVerticals: probes.overview?.ghostVerticalIds?.length ?? 'n/a',
      labelsOnCards: probes.overview?.labelsOnCards,
      focusOk: 'n/a (overview)',
      verdict: probes.overview?.totalHits === 0 && (probes.overview?.ghostVerticalIds || []).length === 0 ? 'PASS' : 'FAIL'
    },
    {
      scene: 'Domain Tasks focus (vs Screenshot_2026-10-11_at_7.34.08_AM)',
      broken: 'Users empty 0-entities chip + vertical corridor of parallel white lines + floating labels',
      after: '02-domain-tasks.png',
      midInside: probes.domainTasks?.totalHits,
      ghostVerticals: probes.domainTasks?.ghostVerticalIds?.length ?? 'n/a',
      labelsOnCards: probes.domainTasks?.labelsOnCards,
      focusOk: String(probes.domainTasks?.focusKind === 'domain'),
      stagedGhosts: probes.domainTasks?.stagedGhosts,
      usersSoftPeers: probes.domainTasks?.usersEntityDomCount,
      verdict: probes.domainTasks?.totalHits === 0
        && probes.domainTasks?.stagedGhosts === 0
        && (probes.domainTasks?.ghostVerticalIds || []).length === 0
        && (probes.domainTasks?.usersEntityDomCount || 0) > 0
        ? 'PASS' : 'FAIL'
    },
    {
      scene: 'Domain Users exclusive (tree Browse click)',
      broken: 'Both domains equal weight; Camera3 never flies; Tasks not soft/quiet',
      after: '03-domain-users.png',
      midInside: probes.domainUsers?.totalHits,
      focusOk: String(probes.domainUsersExclusive?.focusKind === 'domain'
        && probes.domainUsersExclusive?.usersIsFocus
        && probes.domainUsersExclusive?.focusCount === 1),
      tasksSoft: probes.domainUsersExclusive?.tasksSoftOrQuiet,
      tasksOpacity: probes.domainUsersExclusive?.tasksOpacity,
      zoomPct: probes.domainUsersExclusive?.zoomPct,
      verdict: probes.domainUsersExclusive?.focusKind === 'domain'
        && probes.domainUsersExclusive?.usersIsFocus
        && probes.domainUsersExclusive?.focusCount === 1
        && probes.domainUsersExclusive?.tasksSoftOrQuiet
        && probes.domainUsersExclusive?.tasksOpacity < 0.4
        && (probes.domainUsersExclusive?.zoomPct == null
          || probes.domainUsersExclusive.zoomPct >= 70)
        ? 'PASS' : 'FAIL'
    },
    {
      scene: 'Entity Project',
      broken: 'Wrong stage peers; lines through Project/Task text',
      after: '04-entity-project.png',
      midInside: probes.entityProject?.totalHits,
      labelsOnCards: probes.entityProject?.labelsOnCards,
      focusOk: String(probes.entityProject?.focusKind === 'entity'),
      verdict: probes.entityProject?.totalHits === 0
        && probes.entityProject?.focusKind === 'entity'
        ? 'PASS' : 'FAIL'
    },
    {
      scene: 'Entity Task',
      broken: 'Project centered while Task selected',
      after: '05-entity-task.png',
      midInside: probes.entityTask?.totalHits,
      focusOk: String(probes.entityTask?.focusKind === 'entity'),
      verdict: probes.entityTask?.totalHits === 0
        && /Task/i.test(probes.entityTask?.scope || '')
        ? 'PASS' : 'FAIL'
    },
    {
      scene: 'Field assigneeId',
      broken: 'Breadcrumb Field…assigneeId but Project centered; empty inspector',
      after: '09-field-assigneeId.png / 22-camera3-field-assignee.png',
      midInside: probes.fieldAssignee?.totalHits,
      stagedGhosts: probes.fieldAssignee?.stagedGhosts,
      focusOk: String(probes.fieldAssignee?.focusKind === 'field' && /assigneeId/i.test(probes.fieldAssignee?.scope || '')),
      pkOffVisible: probes.fieldAssignee?.pkOffVisible,
      verdict: probes.fieldAssignee?.totalHits === 0
        && probes.fieldAssignee?.focusKind === 'field'
        && probes.fieldAssignee?.stagedGhosts === 0
        && /assigneeId/i.test(probes.fieldAssignee?.scope || '')
        && (probes.fieldAssignee?.usersEntityDomCount || 0) > 0
        ? 'PASS' : 'FAIL'
    },
    {
      scene: 'Field projectId',
      broken: 'Label projectId→id on Task chrome',
      after: '10-field-projectId.png',
      midInside: probes.fieldProjectId?.totalHits,
      labelsOnCards: probes.fieldProjectId?.labelsOnCards,
      focusOk: String(/projectId/i.test(probes.fieldProjectId?.scope || '')),
      verdict: probes.fieldProjectId?.totalHits === 0
        && /projectId/i.test(probes.fieldProjectId?.scope || '')
        ? 'PASS' : 'FAIL'
    },
    {
      scene: 'Relationship Project↔Task',
      broken: 'Corridor through cards; oversized handles',
      after: '13-rel-select-task-project.png',
      midInside: probes.relTaskProject?.totalHits,
      ghostVerticals: probes.relTaskProject?.ghostVerticalIds?.length ?? 'n/a',
      labelsOnCards: probes.relTaskProject?.labelsOnCards,
      focusOk: String(probes.relTaskProject?.focusKind === 'relationship'),
      verdict: probes.relTaskProject?.totalHits === 0
        && probes.relTaskProject?.focusKind === 'relationship'
        ? 'PASS' : 'FAIL'
    },
    {
      scene: 'Relationship Task→User (assignee)',
      broken: 'Cross-domain floating vertical corridor',
      after: '14-rel-select-task-assignee.png',
      midInside: probes.relAssignee?.totalHits,
      ghostVerticals: probes.relAssignee?.ghostVerticalIds?.length ?? 'n/a',
      verdict: probes.relAssignee?.totalHits === 0 && (probes.relAssignee?.ghostVerticalIds || []).length === 0 ? 'PASS' : 'FAIL'
    },
    {
      scene: 'Esc ladder field→entity→domain→overview',
      broken: 'Focus mismatch / stuck stage',
      after: '16…19-esc-*.png',
      midInside: probes.afterEscOverview?.totalHits,
      focusOk: String(probes.afterEscOverview?.focusKind === 'none' || probes.afterEscOverview?.focusKind === 'domain'),
      verdict: probes.afterEscOverview?.totalHits === 0 ? 'PASS' : 'FAIL'
    },
    {
      scene: 'Final overview soft-refresh shell',
      broken: 'Stale SW showing old ghost routes',
      after: '24-final-overview.png',
      midInside: probes.finalOverview?.totalHits,
      shell: probes.finalOverview?.shell,
      verdict: probes.finalOverview?.totalHits === 0 && probes.finalOverview?.shell === '0.9.148' ? 'PASS' : 'FAIL'
    }
  ];

  const failCount = matrixRows.filter((row) => row.verdict === 'FAIL').length;
  const md = [
    '# JUM-918 Edge UX Playwright Evidence Pack',
    '',
    `- Generated: ${summary.generatedAt}`,
    `- Branch: \`cursor/feature/edge-focus-camera3-mvp\``,
    `- Command: \`${midInsideCommand}\``,
    `- Shell: **${probes.overview?.shell || 'unknown'}** (soft-refresh hard Reload if stale)`,
    `- Reference broken shots: \`${refDir}/Screenshot_2026-10-11_*.png\` (${refShots.length} files)`,
    `- Failures: **${failCount}** / ${matrixRows.length}`,
    '',
    '## midInside CDP',
    '',
    '| Probe | totalHits | ghostVerticals | labelsOnCards | stagedGhosts | shell |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...Object.entries(probes).map(([key, value]) => (
      `| ${key} | ${value.totalHits} | ${(value.ghostVerticalIds || []).length} | ${value.labelsOnCards} | ${value.stagedGhosts} | ${value.shell} |`
    )),
    '',
    '## Comparison matrix (broken refs → after)',
    '',
    '| Scene | What was broken (user refs) | After screenshot | midInside | ghostVerticals | focus match | Verdict |',
    '| --- | --- | --- | ---: | ---: | --- | --- |',
    ...matrixRows.map((row) => (
      `| ${row.scene} | ${row.broken} | \`${row.after}\` | ${row.midInside ?? 'n/a'} | ${row.ghostVerticals ?? 'n/a'} | ${row.focusOk ?? 'n/a'} | **${row.verdict}** |`
    )),
    '',
    '## Screenshot index',
    '',
    ...shots.map((s) => `- \`${path.basename(s.file)}\` — ${s.note || s.name} (scope: ${s.scope || '—'})`),
    '',
    '## Soft-refresh note',
    '',
    'If the live browser still shows ghost gutters, hard Reload so SW `0.9.148` + `script.js?v=0.9.148` load. Stale shells keep the pre-fix router.',
    '',
    '## WebGL',
    '',
    'Deferred — CSS transform + scroll Camera3 path; no WebGL scaffolding.',
    ''
  ].join('\n');

  fs.writeFileSync(path.join(outDir, 'COMPARISON.md'), md);
  console.log('\n=== EVIDENCE SUMMARY ===');
  console.log(`shots=${shots.length} failRows=${failCount}`);
  console.log(`overview midInside=${probes.overview?.totalHits}`);
  console.log(`finalOverview midInside=${probes.finalOverview?.totalHits}`);
  console.log(`matrix: ${path.join(outDir, 'COMPARISON.md')}`);
  if (failCount > 0) process.exitCode = 2;
}

await main();
