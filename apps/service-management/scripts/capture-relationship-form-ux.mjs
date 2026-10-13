#!/usr/bin/env bun
/**
 * Evidence: relationship inspector calm editor v3 (UX, no commit).
 * Artifacts: apps/service-management/test/artifacts/relationship-form-ux/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from 'playwright-webkit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const outDir = path.resolve(
  repoRoot,
  'apps/service-management/test/artifacts/relationship-form-ux'
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
  if (/\.(png|json|md)$/i.test(file)) fs.unlinkSync(path.join(outDir, file));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settle(page, ms = 700) {
  await sleep(ms);
  await page.waitForTimeout(80);
}

async function hardReload(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body[data-designer-ready="true"]', { timeout: 30000 });
}

let tempDir;
let server;
let browser;
try {
  tempDir = createTempConfigDir({ '.env.dev': envFileContent('express') });
  server = await startServer(tempDir);
  await waitForServer(server.port);
  const baseUrl = `http://127.0.0.1:${String(server.port)}/`;

  browser = await webkit.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  await hardReload(page, baseUrl);
  await settle(page, 500);

  const shellSrc = await page.locator('script[src*="script.js?v="]').first().getAttribute('src');
  const shell = (shellSrc || '').match(/[?&]v=([^&]+)/)?.[1] || '';
  if (shell !== EXPECTED_SHELL) {
    throw new Error(`Shell mismatch: got ${shell || 'n/a'} expected ${EXPECTED_SHELL}`);
  }

  const loadBtn = page.locator('#domain-designer-empty-load-sample-btn');
  if (await loadBtn.count()) {
    await loadBtn.click();
    await page.waitForSelector('.canvas .entity', { timeout: 20000 });
    await settle(page, 1200);
  }

  await openDesignerPanels(page, '#domain-list');
  await settle(page, 400);

  // Prefer overview so edge hits are not staged away, then select a rel.
  await page.locator('#canvas-overview-btn').click().catch(() => {});
  await settle(page, 700);
  const relId = await page.evaluate(() => {
    const hit = document.querySelector(
      '.edges .edge-hit[data-relationship-id]:not(.is-staged-away):not(.is-quiet)'
    ) || document.querySelector('.edges .edge-hit[data-relationship-id]');
    return hit?.dataset?.relationshipId || null;
  });
  if (!relId) throw new Error('No relationship found after loading sample');

  let selected = false;
  const visibleHit = page.locator(
    `.edge-hit[data-relationship-id="${relId}"]:not(.is-staged-away):not(.is-quiet)`
  ).first();
  if (await visibleHit.count()) {
    await visibleHit.click({ force: true });
    selected = true;
  } else {
    await page.locator(`.edge-hit[data-relationship-id="${relId}"]`).first().click({ force: true });
    selected = true;
  }
  await settle(page, 900);

  // Fallback: entity tree link (→ / ←) when canvas hit did not enter edit mode.
  const editing = await page.evaluate(() => (
    document.getElementById('relationship-inspector-panel')?.classList.contains('is-editing')
  ));
  if (!editing) {
    await page.evaluate(() => {
      const firstEntity = document.querySelector('#domain-list .domain-tree-entity button');
      firstEntity?.click();
    });
    await settle(page, 600);
    const link = page.locator('#domain-list .domain-tree-link button').first();
    if (await link.count()) {
      await link.click();
      selected = true;
      await settle(page, 900);
    }
  }
  if (!selected) throw new Error('Could not select a relationship');

  const panel = page.locator('#relationship-inspector-panel');
  await page.waitForFunction(() => {
    const el = document.getElementById('relationship-inspector-panel');
    return Boolean(el && el.classList.contains('is-editing'));
  }, null, { timeout: 15000 });

  const probe = await page.evaluate(() => {
    const body = document.getElementById('relationship-inspector-body');
    const labels = Array.from(body?.querySelectorAll('label') || []).map((el) => el.textContent.trim());
    const fromCard = document.getElementById('relationship-from-card-select');
    const toCard = document.getElementById('relationship-to-card-select');
    const saveBtn = document.getElementById('save-relationship-btn');
    const saveRect = saveBtn?.getBoundingClientRect();
    const panelRect = document.getElementById('relationship-inspector-panel')?.getBoundingClientRect();
    const title = document.getElementById('relationship-inspector-title')?.textContent?.trim() || '';
    const subtitle = document.getElementById('relationship-inspector-subtitle');
    const browse = document.querySelector('#relationship-inspector-panel [data-relationship-section="browse"]');
    const sectionLabels = Array.from(
      document.querySelectorAll('#relationship-inspector-panel .jx-scope-section-label')
    ).map((el) => el.textContent.trim());
    const visibleSectionLabels = Array.from(
      document.querySelectorAll('#relationship-inspector-panel .jx-scope-section-label')
    ).filter((el) => {
      const host = el.closest('[data-relationship-section]');
      if (host?.hidden) return false;
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }).map((el) => el.textContent.trim());
    const pager = Boolean(
      document.getElementById('relationship-prev-btn')
      || document.getElementById('relationship-next-btn')
      || document.getElementById('relationship-nav-index')
    );
    const browseHint = document.getElementById('relationship-browse-hint')?.textContent?.trim() || '';
    const advanced = body?.querySelector('.relationship-advanced');
    const advancedOpen = Boolean(advanced?.open);
    const advancedStyle = advanced ? getComputedStyle(advanced) : null;
    const advancedNestedScroll = Boolean(
      advancedStyle
      && (
        (Number.parseFloat(advancedStyle.maxHeight) > 0 && advancedStyle.maxHeight !== 'none')
        || (advancedStyle.overflowY === 'auto' || advancedStyle.overflowY === 'scroll')
        || (advancedStyle.overflow === 'auto' || advancedStyle.overflow === 'scroll')
      )
    );
    const neonEditing = (() => {
      const el = document.getElementById('relationship-inspector-panel');
      if (!el) return false;
      const border = getComputedStyle(el).borderColor;
      return /52,\s*211,\s*153|rgb\(52,\s*211,\s*153\)|#34d399/i.test(border);
    })();
    const panelText = (document.getElementById('relationship-inspector-panel')?.innerText || '');
    return {
      editing: document.getElementById('relationship-inspector-panel')?.classList.contains('is-editing'),
      bodyHidden: Boolean(body?.hidden),
      labels,
      sectionLabels,
      visibleSectionLabels,
      title,
      subtitlePresent: Boolean(subtitle),
      subtitleHidden: Boolean(subtitle?.hidden),
      subtitleText: subtitle?.textContent?.trim() || '',
      browseHidden: Boolean(browse?.hidden),
      browseHint,
      pager,
      advancedOpen,
      advancedNestedScroll,
      neonEditing,
      fromCardText: fromCard?.selectedOptions?.[0]?.textContent || '',
      toCardText: toCard?.selectedOptions?.[0]?.textContent || '',
      hasFormClass: Boolean(body?.querySelector('.relationship-form')),
      hasStickyActions: Boolean(body?.querySelector('.relationship-form-actions-sticky')),
      hasAdvanced: Boolean(advanced),
      pathBannerInText: /\/\w+\s+[1N]:[1N]\s+\w+\//.test(panelText) || /N:1|1:N/.test(panelText),
      onThisEntityVisible: visibleSectionLabels.includes('On this entity'),
      saveVisibleInPanel: Boolean(
        saveRect && panelRect
        && saveRect.bottom <= panelRect.bottom + 1
        && saveRect.top >= panelRect.top - 1
        && saveRect.height > 0
      ),
      cardinalityVisibleInPanel: (() => {
        const from = document.getElementById('relationship-from-card-select');
        const to = document.getElementById('relationship-to-card-select');
        if (!from || !to || !panelRect) return false;
        const a = from.getBoundingClientRect();
        const b = to.getBoundingClientRect();
        const inPanel = (r) => (
          r.height > 0
          && r.top >= panelRect.top - 1
          && r.bottom <= panelRect.bottom + 1
        );
        return inPanel(a) && inPanel(b);
      })(),
      shell: (document.querySelector('script[src*="script.js?v="]')?.getAttribute('src') || '')
        .match(/[?&]v=([^&]+)/)?.[1] || ''
    };
  });

  const panelShot = path.join(outDir, '01-relationship-edit-panel.png');
  await panel.screenshot({ path: panelShot });

  const fullShot = path.join(outDir, '02-relationship-edit-full.png');
  await page.screenshot({ path: fullShot, fullPage: false });

  // Open Advanced for layout fields evidence.
  await page.locator('.relationship-advanced > summary').click();
  await settle(page, 200);
  await page.locator('#relationship-label-offset-x-input').scrollIntoViewIfNeeded();
  await settle(page, 200);
  const layoutShot = path.join(outDir, '03-relationship-advanced-open.png');
  await panel.screenshot({ path: layoutShot });

  const advancedOpenProbe = await page.evaluate(() => {
    const advanced = document.querySelector('#relationship-inspector-body .relationship-advanced');
    const style = advanced ? getComputedStyle(advanced) : null;
    return {
      open: Boolean(advanced?.open),
      nestedScroll: Boolean(
        style
        && (
          (Number.parseFloat(style.maxHeight) > 0 && style.maxHeight !== 'none')
          || (style.overflowY === 'auto' || style.overflowY === 'scroll')
          || (style.overflow === 'auto' || style.overflow === 'scroll')
        )
      )
    };
  });

  const cardOk = /^(Many|One)$/.test(probe.fromCardText.trim())
    && /^(Many|One)$/.test(probe.toCardText.trim());

  const report = {
    shellExpected: EXPECTED_SHELL,
    shellObserved: probe.shell,
    probe: {
      ...probe,
      advancedOpenAfterClick: advancedOpenProbe.open,
      advancedNestedScrollAfterOpen: advancedOpenProbe.nestedScroll
    },
    shots: [panelShot, fullShot, layoutShot],
    checks: {
      noPathBannerEl: !probe.subtitlePresent,
      noPathBannerText: !probe.pathBannerInText,
      browseHiddenWhileEditing: probe.browseHidden,
      noOnThisEntityInEditCard: !probe.onThisEntityVisible,
      advancedCollapsedByDefault: !probe.advancedOpen,
      advancedNoNestedScroll: !probe.advancedNestedScroll && !advancedOpenProbe.nestedScroll,
      saveVisible: probe.saveVisibleInPanel,
      cardinalityVisible: probe.cardinalityVisibleInPanel,
      shortCardinalityLabels: cardOk
    },
    verdict:
      probe.editing
      && !probe.bodyHidden
      && probe.hasFormClass
      && probe.hasStickyActions
      && probe.hasAdvanced
      && !probe.advancedOpen
      && !probe.advancedNestedScroll
      && !advancedOpenProbe.nestedScroll
      && !probe.pager
      && !probe.neonEditing
      && !probe.subtitlePresent
      && !probe.pathBannerInText
      && probe.browseHidden
      && !probe.onThisEntityVisible
      && probe.saveVisibleInPanel
      && probe.cardinalityVisibleInPanel
      && !probe.sectionLabels.includes('Edit · Relationship')
      && cardOk
      && labelsOk(probe.labels)
      && (probe.title === '' || !/ · /.test(probe.title))
        ? 'PASS'
        : 'FAIL'
  };

  fs.writeFileSync(path.join(outDir, 'REPORT.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(
    path.join(outDir, 'README.md'),
    [
      '# Relationship form UX evidence (v3)',
      '',
      `- Shell: **${EXPECTED_SHELL}** (observed ${probe.shell})`,
      `- Verdict: **${report.verdict}**`,
      `- Path banner element: **${!probe.subtitlePresent}** (must be absent)`,
      `- Path banner text: **${!probe.pathBannerInText}** (must be absent)`,
      `- On this entity in edit card: **${probe.onThisEntityVisible}** (must be false)`,
      `- Browse hidden while editing: **${probe.browseHidden}**`,
      `- Advanced collapsed by default: **${!probe.advancedOpen}**`,
      `- Advanced nested scroll: **${probe.advancedNestedScroll || advancedOpenProbe.nestedScroll}** (must be false)`,
      `- Cardinality visible: **${probe.cardinalityVisibleInPanel}**`,
      `- Sticky Save visible: **${probe.saveVisibleInPanel}**`,
      `- Cardinality labels: \`${probe.fromCardText}\` / \`${probe.toCardText}\``,
      `- Labels: ${probe.labels.join(', ')}`,
      '',
      '## Shots',
      '- `01-relationship-edit-panel.png` — inspector panel crop (no path banner, no on-this-entity, Advanced collapsed)',
      '- `02-relationship-edit-full.png` — full viewport',
      '- `03-relationship-advanced-open.png` — Advanced expanded in document flow',
      ''
    ].join('\n')
  );

  console.log(JSON.stringify({
    verdict: report.verdict,
    shell: probe.shell,
    checks: report.checks,
    labels: probe.labels
  }, null, 2));
  if (report.verdict !== 'PASS') process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  stopServer(server);
  if (tempDir) cleanupTempConfigDir(tempDir);
}

function labelsOk(labels) {
  const need = [
    'Name',
    'From entity',
    'To entity',
    'From cardinality',
    'To cardinality',
    'Label offset X',
    'Label offset Y',
    'Bend X',
    'Bend Y',
    'Anchor'
  ];
  return need.every((label) => labels.includes(label));
}
