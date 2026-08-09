/**
 * Links the SHIPPED ESM bundle in a real browser engine (JUM-629).
 *
 * Every other spec in this package imports Cana from `../src` and is bundled
 * by Bun before a browser ever sees it — the bundler stands between the test
 * and the artefact a consumer receives. That gap was real: bun 1.3.14 emitted
 * `dist/index.mjs` with export statements referencing bindings it had
 * tree-shaken away, and WebKit refused to link the module at all while every
 * source-level suite stayed green.
 *
 * This spec closes the gap. `cypress.config.js` serves the built
 * `packages/cana/dist/index.mjs` plus a small page that imports it, drives a
 * real IndexedDB round trip through it, and postMessages the outcome. The
 * spec iframes that page and asserts on the report. The indirection is forced
 * by the harness, not decoration: an inline module script is blocked by the
 * spec frame's CSP, and a dynamic `import()` written here is rewritten by
 * Cypress's webpack preprocessor — both would stand between the test and the
 * defect, which lives in the emitted bytes.
 */

const distUrl = Cypress.env('CANA_DIST_URL') as string;
const distPageUrl = Cypress.env('CANA_DIST_PAGE_URL') as string;

interface DistPageReport {
  ok: boolean;
  error?: string;
  exports?: string[];
  row?: unknown;
}

/**
 * Load the served page in an iframe and resolve with its report. The page
 * links `dist/index.mjs` with the browser's own module loader and reports
 * failure itself, so a rejection here means only one thing: the page never
 * got far enough to report — a broken route, not a broken bundle.
 */
function loadDistPage(url: string): Promise<DistPageReport> {
  return new Promise((resolve, reject) => {
    window.addEventListener('message', (event) => {
      const data = event.data as DistPageReport & { type?: string };
      if (data?.type === 'cana-dist') resolve(data);
    }, { once: true });
    setTimeout(() => reject(new Error('the cana-dist page never reported — check the config route')), 15_000);

    const iframe = document.createElement('iframe');
    iframe.src = url;
    document.body.appendChild(iframe);
  });
}

describe('cana shipped ESM bundle (dist/index.mjs)', () => {
  it('is served for the run', () => {
    // A missing URL means the config route is gone; a 404 means the build is
    // broken. Naming each failure keeps the real one — a link error — distinct.
    expect(distUrl, 'CANA_DIST_URL configured by cypress.config.js').to.be.a('string');
    cy.request(distUrl).its('status').should('eq', 200);
  });

  it('links as an ES module and exposes the public surface', async () => {
    // WebKit rejects a module with dangling export bindings at link time,
    // before any evaluation — the page reports that refusal as `ok: false`.
    const report = await loadDistPage(distPageUrl);

    expect(report.error, 'module link error reported by the page').to.equal(undefined);
    expect(report.ok).to.equal(true);

    for (const name of [
      'createClient',
      'createCanaDatabaseClient',
      'createWorkerHost',
      'openDatabase',
      'closeDatabase',
      'deleteDatabase',
      'canaError',
      'isCanaError',
      'validateSchema',
      'keyStrategyOf',
      'classifyOpen',
      'StorageDurability',
      'runTransaction',
      'runConformance'
    ]) {
      expect(report.exports, `export ${name}`).to.include(name);
    }
  });

  it('runs against the browser IndexedDB, not just links', async () => {
    // The page opened a database through the shipped bundle, wrote a record,
    // read it back, and deleted the database — the bindings bun dropped were
    // exactly this lifecycle surface, so a working round trip proves them.
    const report = await loadDistPage(distPageUrl);

    expect(report.ok).to.equal(true);
    expect(report.row).to.deep.equal({ id: 'one', value: 1 });
  });
});
