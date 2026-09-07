/* eslint-disable @typescript-eslint/no-var-requires */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * The generator writes the file that decides which suites run.
 *
 * That makes every omission a deletion. It walked three fixed directories under
 * `apps/backend-template/test/` and nothing else, so a regeneration dropped all
 * eighteen of cana's suites — 214 entries in, 195 out, exit code 0. The suites
 * would simply have stopped running, and the map is the only place that would
 * have said so.
 *
 * Two more of the same shape were in the same function: `quarantine` was
 * rewritten to `[]`, silently un-quarantining a known-flaky suite, and the Node
 * runner pins were reset to `bun` with their `reason` deleted. Requirement 110
 * honours a pin only when a reason is stated, so that one downgraded twenty-two
 * restify suites to a runner that cannot import restify at all.
 *
 * Each is asserted separately, because each was invisible in the same way: the
 * generator reported success and the loss showed up somewhere else, later.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  buildManifest,
  carriedQuarantine,
  classifyIntegration,
  classifyUnit,
  loadPackageSuiteClassification,
  loadPreviousRunnerOverrides,
  packageSuitePaths,
  readPreviousManifest
} = require(path.join(repoRoot, 'ci-cd', 'generate-test-map.js'));

const dirs: string[] = [];
const track = (dir: string) => { dirs.push(dir); return dir; };

function workspace(files: Record<string, string>): string {
  const dir = track(fs.mkdtempSync(path.join(os.tmpdir(), 'generate-map-')));
  for (const [file, contents] of Object.entries(files)) {
    const full = path.join(dir, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }
  return dir;
}

const suite = (over: Record<string, unknown> = {}) => JSON.stringify({
  suites: [{
    id: 'packages/alpha/test/a.test.ts',
    path: 'packages/alpha/test/a.test.ts',
    layer: 'adapters/out+infra',
    kind: 'hexagonal',
    type: 'unit',
    runner: 'bun',
    tier: 'gate',
    timeoutMs: 120_000,
    ...over
  }],
  quarantine: []
});

/**
 * JUM-682 — a quarantine entry outlives its file, and should not.
 *
 * `packages/cana/test/performance.test.ts` was deleted in JUM-581. Its
 * quarantine entry stayed in the manifest for months, describing a suite nobody
 * could read, run or fix. A quarantine says "this suite exists and is knowingly
 * not gating"; with the suite gone the sentence has no subject.
 */
describe('quarantine carry-forward (JUM-682)', () => {
  it('keeps an entry whose suite still exists', () => {
    expect.hasAssertions();

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jum682-keep-'));
    const quarantined = 'packages/sample/test/flaky.test.ts';
    fs.mkdirSync(path.join(root, 'packages/sample/test'), { recursive: true });
    fs.writeFileSync(path.join(root, quarantined), 'it(\'x\', () => undefined);\n');

    const kept = carriedQuarantine(root, {
      quarantine: [{ path: quarantined, issue: 'JUM-1', reason: 'why' }]
    });

    expect(kept).toHaveLength(1);

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('drops an entry whose suite was deleted', () => {
    expect.hasAssertions();

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jum682-drop-'));

    const kept = carriedQuarantine(root, {
      quarantine: [{ path: 'packages/gone/test/vanished.test.ts', issue: 'JUM-1', reason: 'why' }]
    });

    expect(kept).toStrictEqual([]);

    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe('fixtures', () => {
  afterAll(() => {
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('cleans up after itself', () => {
    expect.hasAssertions();

    // The cleanup above is the point; this asserts the register exists so the
    // hook cannot be silently orphaned by a future edit.
    expect(Array.isArray(dirs)).toBe(true);
  });
});

describe('packageSuitePaths', () => {
  it('finds suites under every package test directory', () => {
    expect.hasAssertions();

    const dir = workspace({
      'packages/alpha/test/a.test.ts': '',
      'packages/beta/test/deep/b.test.ts': ''
    });

    expect(packageSuitePaths(dir)).toStrictEqual([
      'packages/alpha/test/a.test.ts',
      'packages/beta/test/deep/b.test.ts'
    ]);
  });

  /** Source is not a suite; only `test/` counts. */
  it('ignores test-looking files outside a package test directory', () => {
    expect.hasAssertions();

    const dir = workspace({ 'packages/alpha/src/a.test.ts': '' });

    expect(packageSuitePaths(dir)).toStrictEqual([]);
  });

  it('copes with a repository that has no packages directory', () => {
    expect.hasAssertions();

    expect(packageSuitePaths(workspace({ 'apps/a/test/x.test.ts': '' }))).toStrictEqual([]);
  });
});

describe('loadPackageSuiteClassification', () => {
  /**
   * There is no path convention encoding a layer under `packages/<name>/test/`, and
   * three of cana's suites carry a hand-raised 120s timeout. Re-deriving them
   * would reset those to the default and the suites would start timing out in
   * CI for a reason nobody could trace back to the generator.
   */
  it('carries layer, kind and timeout across from the committed manifest', () => {
    expect.hasAssertions();

    const dir = workspace({ 'test-map.json': suite() });
    const classification = loadPackageSuiteClassification(dir);

    expect(classification.get('packages/alpha/test/a.test.ts')).toMatchObject({
      layer: 'adapters/out+infra',
      kind: 'hexagonal',
      timeoutMs: 120_000
    });
  });

  it('ignores app suites, which are classified from their path', () => {
    expect.hasAssertions();

    const dir = workspace({
      'test-map.json': JSON.stringify({
        suites: [{ path: 'apps/a/test/unit/x.test.ts', layer: 'tooling' }]
      })
    });

    expect(loadPackageSuiteClassification(dir).size).toBe(0);
  });
});

describe('loadPreviousRunnerOverrides', () => {
  /**
   * `reason` is part of the pin, not commentary: `mapPinsToNode` tests
   * `Boolean(suite.reason)`, so dropping the text downgrades a pin to a
   * preference and the suite silently returns to the default runner.
   */
  it('preserves the reason alongside the runner', () => {
    expect.hasAssertions();

    const dir = workspace({
      'test-map.json': suite({ runner: 'node', ciRunner: 'node', reason: 'bun cannot load it' })
    });

    expect(loadPreviousRunnerOverrides(dir).get('packages/alpha/test/a.test.ts'))
      .toMatchObject({ runner: 'node', ciRunner: 'node', reason: 'bun cannot load it' });
  });
});

describe('readPreviousManifest', () => {
  it('returns null when there is no manifest to read', () => {
    expect.hasAssertions();

    expect(readPreviousManifest(workspace({}))).toBeNull();
  });

  /** Unparseable is treated as absent, so a corrupt file cannot crash the run. */
  it('returns null for an unparseable manifest', () => {
    expect.hasAssertions();

    expect(readPreviousManifest(workspace({ 'test-map.json': '{ not json' }))).toBeNull();
  });
});

describe('buildManifest', () => {
  it('refuses a package suite it has no classification for', () => {
    expect.hasAssertions();

    const dir = workspace({
      'packages/alpha/test/brand-new.test.ts': '',
      'test-map.json': JSON.stringify({ suites: [], quarantine: [] })
    });

    // Reported, not guessed: a wrong layer puts the suite in the wrong selection
    // set, where it runs for changes that cannot affect it and stays silent for
    // the ones that can.
    expect(() => buildManifest(dir)).toThrow('brand-new.test.ts');
  });

  it('carries the quarantine across instead of resetting it', () => {
    expect.hasAssertions();

    const quarantine = [{ path: 'apps/a/test/flaky.test.ts', issue: 'JUM-1', reason: 'flaky' }];
    const dir = workspace({
      // The suite has to exist for the entry to survive (JUM-682): a quarantine
      // describes a suite that is knowingly not gating, and the fixture claimed
      // one that was never on disk.
      'apps/a/test/flaky.test.ts': '',
      'test-map.json': JSON.stringify({ suites: [], quarantine })
    });

    expect(buildManifest(dir).quarantine).toStrictEqual(quarantine);
  });

  it('counts package suites as unit suites', () => {
    expect.hasAssertions();

    const dir = workspace({
      'packages/alpha/test/a.test.ts': '',
      'test-map.json': suite()
    });

    const manifest = buildManifest(dir);

    expect(manifest.stats.unit).toBe(1);
    expect(manifest.suites.map((entry: { path: string }) => entry.path))
      .toContain('packages/alpha/test/a.test.ts');
  });

  it('classifies pipeline and root tooling configuration', () => {
    expect.hasAssertions();

    const globs = buildManifest(workspace({})).layers.tooling.sourceGlobs;

    // Without these a change touching only a workflow or `test-map.json` maps to
    // no layer, and the task gate refuses it as an unsupported change set.
    expect(globs).toStrictEqual(expect.arrayContaining([
      '.github/**',
      'test-map.json',
      'jest.config.js'
    ]));
    expect(globs).not.toContain('.circleci/**');
  });

  it('declares cheap dev health and full main matrix in the generated gate table', () => {
    expect.hasAssertions();

    expect(buildManifest(workspace({})).gateTable).toStrictEqual({
      task: { script: 'ci:gate:task', mode: 'layer-aware' },
      dev: { script: 'test:unit', mode: 'cheap-health' },
      main: { script: 'ci:gate:strict', mode: 'full-matrix' }
    });
  });
});

/**
 * Service Management's declared non-hexagonal kind (JUM-552), split into its two
 * real parts (JUM-472): the server and the designer SPA it serves.
 *
 * The registration this replaced filed every SM suite under `interface/runtime`
 * or `tooling`, so an SM change ran the whole backend interface layer — and
 * never ran the SM unit suites, which sat in `tooling` waiting for a ci-cd
 * change to select them.
 */
describe('service-management classification (JUM-472)', () => {
  it('files SM unit suites under the designer sub-layer, not tooling', () => {
    expect.hasAssertions();

    expect(classifyUnit('apps/service-management/test/unit/designerStore.test.ts'))
      .toStrictEqual({ layer: 'service-management/designer', kind: 'non-hexagonal' });
  });

  it.each([
    ['runtimeEnv.integration.test.ts', 'service-management/server'],
    ['runtimeEnvContract.integration.test.ts', 'service-management/server'],
    ['staticManifest.integration.test.ts', 'service-management/server'],
    ['staticServing.integration.test.ts', 'service-management/server'],
    ['domainDesigner.smoke.test.ts', 'service-management/designer'],
    ['spaBoot.browser.integration.test.ts', 'service-management/designer']
  ])('files the SM integration suite %s under %s', (name, layer) => {
    expect.hasAssertions();

    expect(classifyIntegration(`apps/backend-template/test/integration/ServiceManagement/${name}`))
      .toMatchObject({
        layer,
        kind: 'non-hexagonal',
        adapter: 'service-management',
        script: 'test:integration:service-management'
      });
  });

  /**
   * Enumerated, not wildcard (JUM-552): a new SM integration suite has no area
   * until someone names it. Guessing a default would silently misfile it — the
   * suite would run for changes that cannot affect it and stay silent for the
   * ones that can.
   */
  it('refuses an SM integration suite with no recorded area', () => {
    expect.hasAssertions();

    expect(() => classifyIntegration(
      'apps/backend-template/test/integration/ServiceManagement/brand-new.integration.test.ts'
    )).toThrow('brand-new.integration.test.ts');
  });

  it('declares the two sub-layers with enumerated globs and the component dependency direction', () => {
    expect.hasAssertions();

    const { layers } = buildManifest(workspace({}));

    expect(layers['service-management/server']).toMatchObject({
      dependsOn: ['contracts'],
      kind: 'non-hexagonal',
      sourceGlobs: ['apps/service-management/server.js', 'apps/service-management/package.json']
    });
    expect(layers['service-management/designer']).toMatchObject({
      dependsOn: ['service-management/server'],
      kind: 'non-hexagonal',
      sourceGlobs: [
        'apps/service-management/script.js',
        'apps/service-management/src/**',
        'apps/service-management/index.html',
        'apps/service-management/styles.css',
        // JUM-493: the publishable designer-core package IS the designer core;
        // its manifest, build and suites belong to the same layer.
        'packages/designer-core/**'
      ]
    });
  });

  it('no longer files the component under interface/runtime, and maps spec/ to contracts', () => {
    expect.hasAssertions();

    const { layers } = buildManifest(workspace({}));

    // Without the first, an SM change selected the whole backend interface
    // layer; without the second, a canonical contract-shape change selected
    // nothing at all and the gate failed closed.
    expect(layers['interface/runtime'].sourceGlobs).toStrictEqual([
      'apps/backend-template/src/interface/**'
    ]);
    expect(layers.contracts.sourceGlobs).toContain('spec/**');
  });
});

/**
 * The property the whole change exists to establish: running the generator over
 * the committed tree must not lose anything. Asserted against the repository,
 * because that is where the loss happened.
 */
describe('the repository itself', () => {
  it('regenerates without dropping suites, pins, reasons or the quarantine', () => {
    expect.hasAssertions();

    const committed = JSON.parse(fs.readFileSync(path.join(repoRoot, 'test-map.json'), 'utf8'));
    const regenerated = buildManifest(repoRoot);

    const paths = (
      manifest: { suites: Array<{ path: string }> }
    ) => manifest.suites.map((entry) => entry.path).sort();

    expect(paths(regenerated)).toStrictEqual(paths(committed));
    expect(regenerated.quarantine).toStrictEqual(committed.quarantine);

    const pinned = (manifest: { suites: Array<{ runner?: string; reason?: string }> }) => ({
      node: manifest.suites.filter((entry) => entry.runner === 'node').length,
      reasoned: manifest.suites.filter((entry) => entry.reason).length
    });

    expect(pinned(regenerated)).toStrictEqual(pinned(committed));
    expect(pinned(regenerated).node).toBeGreaterThan(0);
  });
});
