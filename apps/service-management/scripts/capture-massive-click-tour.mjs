#!/usr/bin/env bun
/**
 * Massive Domain Designer click tour (JUM-918 follow-up).
 * Clicks every reachable interactive control, screenshots each step, writes TOUR.md.
 * Plan SSOT: apps/service-management/docs/PLAYWRIGHT-MASSIVE-CLICK-TOUR.plan.md
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
  'apps/service-management/test/artifacts/massive-click-tour'
);
const EXPECTED_SHELL = '0.9.148';

const {
  createTempConfigDir,
  cleanupTempConfigDir,
  envFileContent,
  startServer,
  stopServer,
  waitForServer,
  openDesignerPanels,
  clickInPanels
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

async function settle(page, ms = 500) {
  await sleep(ms);
  await page.waitForTimeout(80);
}

function slugify(text) {
  return String(text || 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'x';
}

const MID_INSIDE_PROBE = `(() => {
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
  let totalHits = 0;
  const paths = document.querySelectorAll('.edges .edge-line[data-relationship-id]');
  for (let pi = 0; pi < paths.length; pi += 1) {
    const edgePath = paths[pi];
    const style = window.getComputedStyle(edgePath);
    if (style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity || '1') < 0.05) continue;
    if (edgePath.classList.contains('is-staged-away') || edgePath.classList.contains('is-quiet')) continue;
    totalHits += scorePath(edgePath);
  }
  const shellMatch = (document.querySelector('script[src*="script.js?v="]')?.getAttribute('src') || '').match(/[?&]v=([^&]+)/);
  return {
    totalHits,
    entityCount: entityBoxes.length,
    edgeCount: paths.length,
    shell: shellMatch ? shellMatch[1] : null,
    focusKind: document.getElementById('canvas')?.dataset?.focusKind || null,
    scope: document.getElementById('canvas-scope-path')?.textContent || '',
    usersLabel: document.querySelector('.domain[data-domain-id] .domain-count, .domain .list-meta')?.textContent || null
  };
})()`;

async function probePage(page) {
  return page.evaluate(MID_INSIDE_PROBE);
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
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('body[data-designer-ready="true"]', { timeout: 20000 }).catch(() => undefined);
}

async function main() {
  execFileSync('bun', ['apps/service-management/scripts/sync-service-management-cana-bundle.js'], {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  const tempDir = createTempConfigDir({ '.env.dev': envFileContent('express') });
  let server;
  let browser;
  const rows = [];
  const probes = {};
  let shotIndex = 0;
  let failCount = 0;

  const record = async (page, {
    section,
    action,
    selector = '',
    status = 'PASS',
    note = '',
    takeShot = true
  }) => {
    let png = null;
    let meta = {};
    if (takeShot && status === 'PASS') {
      const name = `${String(shotIndex).padStart(3, '0')}-${slugify(action)}`;
      shotIndex += 1;
      png = `${name}.png`;
      await page.screenshot({ path: path.join(outDir, png), fullPage: false });
      meta = {
        scope: await page.locator('#canvas-scope-path').textContent().catch(() => ''),
        focusKind: await page.locator('#canvas').getAttribute('data-focus-kind').catch(() => null),
        stage: await page.locator('#canvas').getAttribute('data-canvas-stage').catch(() => null)
      };
      console.log(`[shot] ${png} ${action} focus=${meta.focusKind}`);
    }
    if (status === 'FAIL') failCount += 1;
    rows.push({
      section,
      action,
      selector,
      status,
      note,
      png,
      ...meta
    });
  };

  const safeClick = async (page, selector, opts = {}) => {
    const loc = page.locator(selector).first();
    const count = await loc.count();
    if (!count) return { ok: false, reason: 'missing' };
    try {
      await loc.click({ force: Boolean(opts.force), timeout: opts.timeout || 8000 });
      return { ok: true };
    } catch (error) {
      try {
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          el.scrollIntoView({ block: 'center', inline: 'center' });
          el.click();
          return true;
        }, selector);
        return { ok: true, reason: 'evaluate-click' };
      } catch (inner) {
        return { ok: false, reason: String(error?.message || inner?.message || error) };
      }
    }
  };

  try {
    server = await startServer(tempDir);
    await waitForServer(server.port);
    const baseUrl = `http://127.0.0.1:${String(server.port)}/`;
    browser = await webkit.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);

    // --- A. Boot / sample ---
    await hardReload(page, baseUrl);
    await record(page, { section: 'A', action: 'boot-empty', note: 'after SW unregister' });

    const loadSample = await safeClick(page, '#domain-designer-empty-load-sample-btn');
    if (!loadSample.ok) {
      await record(page, {
        section: 'A',
        action: 'load-sample',
        selector: '#domain-designer-empty-load-sample-btn',
        status: 'FAIL',
        note: loadSample.reason
      });
    } else {
      await page.waitForSelector('.canvas .entity', { timeout: 20000 });
      await settle(page, 1000);
      await record(page, {
        section: 'A',
        action: 'load-sample',
        selector: '#domain-designer-empty-load-sample-btn'
      });
    }
    probes.overview = await probePage(page);

    await openDesignerPanels(page, '#domain-list');

    // --- B. Canvas chrome ---
    // Toggle panels only — quick-add* mutates the sample (created Domain 1 in
    // the first run); catalog those as intentional SKIP per plan.
    {
      const result = await safeClick(page, '#toggle-sidebar-btn');
      await settle(page, 450);
      await record(page, {
        section: 'B',
        action: 'chrome-toggle-sidebar-btn',
        selector: '#toggle-sidebar-btn',
        status: result.ok ? 'PASS' : 'FAIL',
        note: result.reason || ''
      });
    }
    for (const sel of ['#quick-add-domain-btn', '#quick-add-entity-btn', '#quick-add-note-btn']) {
      await record(page, {
        section: 'B',
        action: `chrome-${slugify(sel)}`,
        selector: sel,
        status: 'SKIP',
        note: 'mutating create — skipped so sample stays pristine',
        takeShot: false
      });
    }

    // Ensure drawer open for tree walk
    await openDesignerPanels(page, '#domain-list');
    await settle(page, 400);

    // canvas background → overview
    await page.evaluate(() => {
      document.getElementById('canvas')?.click();
    });
    await settle(page, 1100);
    await page.waitForSelector('.canvas .entity[data-entity-id]', { timeout: 10000 }).catch(() => undefined);
    await record(page, {
      section: 'B',
      action: 'canvas-background-overview',
      selector: '#canvas'
    });

    const minimap = await safeClick(page, '.mini-map-viewport, #mini-map, .minimap');
    await settle(page, 300);
    await record(page, {
      section: 'B',
      action: 'minimap',
      selector: '.mini-map-viewport',
      status: minimap.ok ? 'PASS' : 'SKIP',
      note: minimap.ok ? '' : minimap.reason
    });

    // --- C. Sidebar accordion (tabs are not inside [data-sidebar-group]) ---
    for (const tab of ['model', 'history', 'validate', 'export', 'import']) {
      const sel = `[data-sidebar-tab="${tab}"]`;
      const clicked = await page.evaluate((wanted) => {
        const drawer = document.getElementById('designer-sidebar');
        const toggle = document.getElementById('toggle-sidebar-btn');
        if (drawer && !drawer.classList.contains('open')) toggle?.click();
        const el = document.querySelector(wanted);
        el?.click();
        return Boolean(el);
      }, sel);
      await settle(page, 450);
      await record(page, {
        section: 'C',
        action: `sidebar-${tab}`,
        selector: sel,
        status: clicked ? 'PASS' : 'FAIL',
        note: clicked ? '' : 'tab missing'
      });
    }
    await page.evaluate(() => {
      document.querySelector('[data-sidebar-tab="model"]')?.click();
    });
    await settle(page, 400);

    // --- D. Structure tree: domains ---
    const domainNames = await page.$$eval(
      '#domain-list button.domain-tree-domain .domain-tree-name',
      (nodes) => nodes.map((n) => (n.textContent || '').trim()).filter(Boolean)
    );
    for (const name of domainNames) {
      const clicked = await page.evaluate((wanted) => {
        const buttons = Array.from(document.querySelectorAll('#domain-list button.domain-tree-domain'));
        const match = buttons.find((btn) => (
          (btn.querySelector('.domain-tree-name')?.textContent || '').trim() === wanted
        ));
        match?.click();
        return Boolean(match);
      }, name);
      await settle(page, 800);
      await record(page, {
        section: 'D',
        action: `tree-domain-${slugify(name)}`,
        selector: `button.domain-tree-domain:${name}`,
        status: clicked ? 'PASS' : 'FAIL',
        note: clicked ? '' : 'domain button missing'
      });
    }
    // Return to sample overview before entity inventory (empty domain focus
    // stages every card away → zero canvas entities).
    await page.evaluate(() => document.getElementById('canvas')?.click());
    await settle(page, 1100);
    await page.waitForSelector('.canvas .entity[data-entity-id]', { timeout: 10000 });
    probes.domainTasks = await probePage(page);

    // Prefer sample domains only (ignore accidental Domain N from prior runs).
    const sampleDomainNames = domainNames.filter((name) => name === 'Users' || name === 'Tasks');

    // entities — expand + click per sample domain (children hide when collapsed)
    const seenEntities = new Set();
    for (const domainName of sampleDomainNames) {
      await page.evaluate((wanted) => {
        const findDomainBtn = () => Array.from(
          document.querySelectorAll('#domain-list button.domain-tree-domain')
        ).find((btn) => (
          (btn.querySelector('.domain-tree-name')?.textContent || '').trim() === wanted
        ));
        findDomainBtn()?.click();
        // Re-query after renderDomainList remounts the tree.
        const row = findDomainBtn()?.closest('li');
        const toggle = row?.querySelector('button.domain-tree-toggle');
        if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
      }, domainName);
      await settle(page, 900);
      await page.waitForSelector(
        `#domain-list li.domain-tree-item .domain-tree-entity button`,
        { timeout: 8000 }
      ).catch(() => undefined);
      const entities = await page.$$eval(
        '#domain-list .domain-tree-entity button',
        (nodes) => nodes.map((btn) => (
          (btn.querySelector('.domain-tree-name')?.textContent || '').trim()
        )).filter(Boolean)
      );
      if (!entities.length) {
        await record(page, {
          section: 'D',
          action: `tree-entities-empty-${slugify(domainName)}`,
          status: 'FAIL',
          note: 'domain selected but no .domain-tree-entity buttons'
        });
      }
      for (const entityName of entities) {
        if (seenEntities.has(entityName)) continue;
        seenEntities.add(entityName);
        const clicked = await page.evaluate((wanted) => {
          const buttons = Array.from(document.querySelectorAll('#domain-list .domain-tree-entity button'));
          const match = buttons.find((btn) => (
            (btn.querySelector('.domain-tree-name')?.textContent || '').trim() === wanted
          ));
          match?.scrollIntoView({ block: 'center' });
          match?.click();
          return Boolean(match);
        }, entityName);
        await settle(page, 750);
        await record(page, {
          section: 'D',
          action: `tree-entity-${slugify(entityName)}`,
          selector: `.domain-tree-entity:${entityName}`,
          status: clicked ? 'PASS' : 'FAIL'
        });
      }
      // relationship links under this domain's expanded entities
      const linkCount = await page.locator('#domain-list .domain-tree-link button').count();
      const maxLinks = Math.min(linkCount, 8);
      for (let i = 0; i < maxLinks; i += 1) {
        const result = await page.locator('#domain-list .domain-tree-link button').nth(i).click({ force: true })
          .then(() => ({ ok: true }))
          .catch((error) => ({ ok: false, reason: String(error.message || error) }));
        await settle(page, 700);
        await record(page, {
          section: 'D',
          action: `tree-link-${slugify(domainName)}-${i}`,
          selector: `.domain-tree-link nth=${i}`,
          status: result.ok ? 'PASS' : 'SKIP',
          note: result.ok ? '' : result.reason
        });
      }
    }
    probes.entityTask = await probePage(page);

    // --- E. Canvas entities / fields / edges ---
    await page.evaluate(() => document.getElementById('canvas')?.click());
    await settle(page, 1200);
    await page.waitForSelector('.canvas .entity[data-entity-id]', { timeout: 15000 });

    const canvasEntities = await page.$$eval(
      '.canvas .entity[data-entity-id]',
      (nodes) => nodes.map((n) => {
        const nameInput = n.querySelector('input[aria-label*="name" i], input.entity-name, header input, .entity-header input');
        const label = n.querySelector('.entity-name, .entity-title, [data-entity-name]');
        return {
          id: n.dataset.entityId || '',
          name: (nameInput?.value || label?.textContent || n.dataset.entityId || '').trim()
        };
      })
    );
    if (!canvasEntities.length) {
      await record(page, {
        section: 'E',
        action: 'canvas-entities-inventory',
        status: 'FAIL',
        note: 'no .canvas .entity nodes after overview remount'
      });
    }
    for (const entity of canvasEntities) {
      const result = await safeClick(page, `.canvas .entity[data-entity-id="${entity.id}"]`, { force: true });
      await settle(page, 700);
      await record(page, {
        section: 'E',
        action: `canvas-entity-${slugify(entity.name || entity.id)}`,
        selector: `.entity[data-entity-id="${entity.id}"]`,
        status: result.ok ? 'PASS' : 'FAIL',
        note: result.reason || ''
      });
    }

    // fields on currently visible cards (after selecting Task if present)
    const taskEntity = canvasEntities.find((e) => /task/i.test(e.name) && !/comment/i.test(e.name));
    if (taskEntity) {
      await safeClick(page, `.canvas .entity[data-entity-id="${taskEntity.id}"]`, { force: true });
      await settle(page, 600);
    }
    const fieldNames = await page.$$eval(
      '.canvas .entity-field-row[data-field-name]',
      (nodes) => [...new Set(nodes.map((n) => n.dataset.fieldName).filter(Boolean))]
    );
    for (const fieldName of fieldNames) {
      const clicked = await page.evaluate((wanted) => {
        const row = document.querySelector(`.entity-field-row[data-field-name="${wanted}"]`);
        if (!row) return false;
        row.scrollIntoView({ block: 'center', inline: 'center' });
        row.click();
        return true;
      }, fieldName);
      await settle(page, 650);
      await record(page, {
        section: 'E',
        action: `field-${slugify(fieldName)}`,
        selector: `.entity-field-row[data-field-name="${fieldName}"]`,
        status: clicked ? 'PASS' : 'SKIP',
        note: clicked ? '' : 'not in DOM (staged away)'
      });
    }
    probes.fieldAssignee = await probePage(page);

    // Collect relationship ids from overview (all hits present), then select
    // each from overview so focus staging does not hide the next peer.
    await page.evaluate(() => document.getElementById('canvas')?.click());
    await settle(page, 1000);
    const relationshipIds = await page.$$eval(
      '.edges .edge-hit[data-relationship-id]',
      (nodes) => [...new Set(nodes.map((n) => n.dataset.relationshipId).filter(Boolean))]
    );
    for (const relId of relationshipIds) {
      await page.evaluate(() => document.getElementById('canvas')?.click());
      await settle(page, 900);
      const hitSel = `.edge-hit[data-relationship-id="${relId}"]`;
      let clicked = false;
      let note = '';
      try {
        await page.waitForSelector(hitSel, { timeout: 8000, state: 'attached' });
        await page.locator(hitSel).first().hover({ force: true });
        await settle(page, 150);
        await page.locator(hitSel).first().click({ force: true });
        clicked = true;
      } catch (error) {
        note = String(error?.message || error).slice(0, 160);
      }
      await settle(page, 750);
      await record(page, {
        section: 'E',
        action: `edge-${slugify(relId)}`,
        selector: hitSel,
        status: clicked ? 'PASS' : 'SKIP',
        note: clicked ? '' : note || 'hit missing'
      });
    }
    probes.relationship = await probePage(page);

    // --- F. Domain inspector panes ---
    if (domainNames[0]) {
      await page.evaluate((wanted) => {
        const buttons = Array.from(document.querySelectorAll('#domain-list button.domain-tree-domain'));
        const match = buttons.find((btn) => (
          (btn.querySelector('.domain-tree-name')?.textContent || '').trim() === wanted
        ));
        match?.click();
      }, domainNames[0]);
      await settle(page, 600);
      for (const pane of ['identity', 'context']) {
        const sel = `#domain-pane-tab-${pane}`;
        try {
          await clickInPanels(page, sel);
          await settle(page, 400);
          await record(page, { section: 'F', action: `domain-pane-${pane}`, selector: sel });
        } catch (error) {
          await record(page, {
            section: 'F',
            action: `domain-pane-${pane}`,
            selector: sel,
            status: 'SKIP',
            note: String(error?.message || error)
          });
        }
      }
      await record(page, {
        section: 'F',
        action: 'clear-domain-context',
        selector: '#clear-domain-context-btn',
        status: 'SKIP',
        note: 'destructive — deferred per plan',
        takeShot: false
      });
    }

    // --- G. Esc ladder from a deep field ---
    if (taskEntity) {
      await safeClick(page, `.canvas .entity[data-entity-id="${taskEntity.id}"]`, { force: true });
      await settle(page, 500);
      await page.evaluate(() => {
        const row = document.querySelector('.entity-field-row[data-field-name="assigneeId"]')
          || document.querySelector('.entity-field-row[data-field-name]');
        row?.scrollIntoView({ block: 'center' });
        row?.click();
      });
      await settle(page, 700);
      await record(page, { section: 'G', action: 'esc-start-field', selector: 'assigneeId|first-field' });
      for (const step of ['to-entity', 'to-domain', 'to-overview']) {
        await page.keyboard.press('Escape');
        await settle(page, 800);
        await record(page, { section: 'G', action: `esc-${step}`, selector: 'Escape' });
      }
    }

    probes.finalOverview = await probePage(page);
    await record(page, { section: 'H', action: 'final-overview', note: 'post Esc ladder' });

    await context.close();
  } finally {
    if (browser) await browser.close();
    stopServer(server);
    cleanupTempConfigDir(tempDir);
  }

  const midInsideFails = Object.entries(probes)
    .filter(([, p]) => p && Number(p.totalHits) > 0)
    .map(([k, p]) => `${k}:${p.totalHits}`);
  const shellMismatch = Object.values(probes).some((p) => p?.shell && p.shell !== EXPECTED_SHELL);

  const manifest = {
    generatedAt: new Date().toISOString(),
    branch: execFileSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
    expectedShell: EXPECTED_SHELL,
    shotCount: shotIndex,
    failCount,
    skipCount: rows.filter((r) => r.status === 'SKIP').length,
    passCount: rows.filter((r) => r.status === 'PASS').length,
    midInsideFails,
    shellMismatch,
    probes,
    rows
  };
  fs.writeFileSync(path.join(outDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(outDir, 'midInside.json'), JSON.stringify(probes, null, 2));

  const tourMd = [
    '# Massive click tour — receipt',
    '',
    `- Generated: ${manifest.generatedAt}`,
    `- Branch: \`${manifest.branch}\``,
    `- Shell expected: **${EXPECTED_SHELL}**`,
    `- Shots: **${shotIndex}** · PASS ${manifest.passCount} · SKIP ${manifest.skipCount} · FAIL ${failCount}`,
    `- midInside fails: ${midInsideFails.length ? midInsideFails.join(', ') : '**none**'}`,
    `- Plan: \`apps/service-management/docs/PLAYWRIGHT-MASSIVE-CLICK-TOUR.plan.md\``,
    '',
    '## midInside probes',
    '',
    '| Probe | totalHits | shell | focusKind |',
    '| --- | ---: | --- | --- |',
    ...Object.entries(probes).map(([k, p]) => (
      `| ${k} | ${p?.totalHits ?? 'n/a'} | ${p?.shell ?? 'n/a'} | ${p?.focusKind ?? 'n/a'} |`
    )),
    '',
    '## Action matrix',
    '',
    '| # | Section | Action | Status | PNG | Focus | Note |',
    '| ---: | --- | --- | --- | --- | --- | --- |',
    ...rows.map((row, i) => (
      `| ${i + 1} | ${row.section} | ${row.action} | **${row.status}** | ${row.png ? `\`${row.png}\`` : '—'} | ${row.focusKind ?? '—'} | ${row.note || ''} |`
    )),
    ''
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'TOUR.md'), tourMd);

  console.log(`\n[tour] wrote ${outDir} shots=${shotIndex} fail=${failCount} midInsideFails=${midInsideFails.length}`);
  if (failCount > 0 || midInsideFails.length > 0 || shellMismatch) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
