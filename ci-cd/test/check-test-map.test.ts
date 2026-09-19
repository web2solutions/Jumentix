/* eslint-disable @typescript-eslint/no-var-requires */

// Imported rather than required: an import makes this a module. Without one,
// TypeScript treats the file as a global script and these two names collide with
// the same declarations in check-workspace-boundaries.test.ts — a TS2451 that
// surfaces only when both files are in one program, so it passes file-by-file
// and fails the CI gate, which compiles the whole set.
import fs from 'fs';
import path from 'path';

const {
  assertAcyclic,
  outwardClosure,
  readTestMap,
  validateTestMap
} = require('../lib/test-map');
const { createLayerAwarePlan, matchGlob, resolveAlias } = require('../lib/layer-resolver');
const { buildGateEvidence, validateGateEvidence } = require('../lib/gate-evidence');

describe('hexagonal test pyramid libraries', () => {
  const manifest = {
    schemaVersion: 1,
    layers: {
      domain: { dependsOn: [], sourceGlobs: ['apps/backend-template/src/modules/*/domain/**'] },
      application: { dependsOn: ['domain'], sourceGlobs: ['apps/backend-template/src/modules/*/application/**'] },
      tooling: { dependsOn: [], sourceGlobs: ['ci-cd/**'], kind: 'non-hexagonal' }
    },
    suites: [
      {
        id: 'apps/backend-template/test/unit/modules/Users/domain/Model/User.test.ts',
        path: 'apps/backend-template/test/unit/modules/Users/domain/Model/User.test.ts',
        layer: 'domain',
        type: 'unit',
        runner: 'bun',
        tier: 'gate'
      }
    ],
    quarantine: [],
    pathAliases: {
      '@src': 'apps/backend-template/src',
      '@jumentix': 'packages'
    },
    sourceRoots: ['apps/backend-template/src', 'ci-cd']
  };

  it('expands blast radius outward through reverse dependsOn', () => {
    expect.hasAssertions();
    expect(outwardClosure(manifest, ['domain']).sort()).toStrictEqual(['application', 'domain']);
  });

  it('rejects cyclic dependsOn graphs', () => {
    expect.hasAssertions();
    expect(() => assertAcyclic({
      layers: {
        a: { dependsOn: ['b'] },
        b: { dependsOn: ['a'] }
      }
    })).toThrow(/cycle/i);
  });

  it('resolves path aliases used by the dependency graph', () => {
    expect.hasAssertions();
    expect(resolveAlias('@src/modules/Users/domain/Model/User', manifest.pathAliases))
      .toBe('apps/backend-template/src/modules/Users/domain/Model/User');
    expect(matchGlob(
      'apps/backend-template/src/modules/Users/domain/Model/User.ts',
      'apps/backend-template/src/modules/*/domain/**'
    )).toBe(true);
  });

  it('builds a layer-aware plan for a domain source change', () => {
    expect.hasAssertions();
    const plan = createLayerAwarePlan(
      ['apps/backend-template/src/modules/Users/domain/Model/User.ts'],
      {
        manifest,
        root: path.resolve(__dirname, '../..'),
        graph: new Map([
          ['apps/backend-template/src/modules/Users/domain/Model/User.ts', []]
        ])
      }
    );
    expect(plan.type).toBe('layer-aware');
    // arrayContaining is the point: the claim is that these two layers were
    // selected, not that they were the only ones.
    // eslint-disable-next-line jest/prefer-strict-equal -- asymmetric matcher, see above
    expect(plan.selectedLayers).toEqual(expect.arrayContaining(['domain', 'application']));
    expect(plan.unitSuites).toContain(
      'apps/backend-template/test/unit/modules/Users/domain/Model/User.test.ts'
    );
  });

  it('fails closed when evidence omits planned suites', () => {
    expect.hasAssertions();
    const evidence = buildGateEvidence(
      {
        files: ['apps/backend-template/src/modules/Users/domain/Model/User.ts'],
        selectedLayers: ['domain'],
        notRunLayers: ['tooling'],
        reasons: {},
        suites: [{ path: 'apps/backend-template/test/unit/modules/Users/domain/Model/User.test.ts' }],
        unitSuites: ['apps/backend-template/test/unit/modules/Users/domain/Model/User.test.ts'],
        integrationScripts: []
      },
      {
        executedSuites: [],
        suiteResults: [],
        status: 0,
        outcome: 'passed'
      }
    );
    expect(validateGateEvidence(evidence).ok).toBe(false);
  });

  it('validates the repository test-map against the real tree', () => {
    expect.hasAssertions();
    const root = path.resolve(__dirname, '../..');
    const result = validateTestMap(readTestMap(path.join(root, 'test-map.json')), { root });
    expect(result.ok).toBe(true);
  });

  it('resolves local Bun vs CI Node runtimes (Req 106)', () => {
    expect.hasAssertions();
    // eslint-disable-next-line global-require
    const { resolveTestRuntime, effectiveRunner } = require('../lib/test-runtime');
    expect(resolveTestRuntime({})).toBe('bun');
    expect(resolveTestRuntime({ CI: 'true' })).toBe('node');
    expect(resolveTestRuntime({ JUMENTIX_TEST_RUNTIME: 'node' })).toBe('node');
    expect(effectiveRunner({ runner: 'bun', ciRunner: 'node' }, {})).toBe('bun');
    expect(effectiveRunner({ runner: 'bun', ciRunner: 'node' }, { CI: 'true' })).toBe('node');
  });

  it('rejects local runner:"node" in the manifest (Req 106)', () => {
    expect.hasAssertions();
    const bad = {
      ...manifest,
      suites: [
        {
          ...manifest.suites[0],
          runner: 'node'
        }
      ]
    };
    const result = validateTestMap(bad, { root: path.resolve(__dirname, '../..') });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error: string) => error.includes('ciRunner'))).toBe(true);
  });
});

/**
 * The gate-side half of the JUM-472 registration: what the layer-aware selector
 * plans for Service Management changes now that the component is its own
 * non-hexagonal kind.
 *
 * Before the split, an SM source change selected `interface/runtime` — every
 * backend interface suite and no SM unit suite — and an SM unit-suite change
 * selected `tooling`, running fifty-odd governance suites instead.
 */
describe('service-management selection (JUM-472)', () => {
  const smSuite = (suitePath: string, layer: string, type: string, extra: object = {}) => ({
    id: suitePath,
    path: suitePath,
    layer,
    kind: 'non-hexagonal',
    type,
    runner: 'bun',
    tier: 'gate',
    ...extra
  });

  const smManifest = {
    schemaVersion: 1,
    layers: {
      contracts: { dependsOn: [], sourceGlobs: ['spec/**'] },
      'service-management/server': {
        dependsOn: ['contracts'],
        sourceGlobs: ['apps/service-management/server.js', 'apps/service-management/package.json'],
        kind: 'non-hexagonal'
      },
      'service-management/designer': {
        dependsOn: ['service-management/server'],
        sourceGlobs: ['apps/service-management/script.js', 'apps/service-management/src/**'],
        kind: 'non-hexagonal'
      },
      tooling: { dependsOn: [], sourceGlobs: ['ci-cd/**'], kind: 'non-hexagonal' }
    },
    suites: [
      smSuite(
        'apps/service-management/test/unit/designerStore.test.ts',
        'service-management/designer',
        'unit'
      ),
      smSuite(
        'apps/service-management/test/integration/server/runtimeEnv.integration.test.ts',
        'service-management/server',
        'integration',
        { script: 'test:integration:service-management' }
      ),
      smSuite(
        'apps/service-management/test/integration/browser/spaBoot.browser.integration.test.ts',
        'service-management/designer',
        'integration',
        { script: 'test:integration:service-management' }
      ),
      smSuite('ci-cd/test/check-test-map.test.ts', 'tooling', 'unit')
    ],
    quarantine: [],
    pathAliases: {},
    sourceRoots: []
  };

  const planFor = (files: string[]) => createLayerAwarePlan(files, {
    manifest: smManifest,
    root: path.resolve(__dirname, '../..'),
    graph: new Map()
  });

  it('selects exactly the designer suites for a designer SPA change', () => {
    expect.hasAssertions();

    const plan = planFor(['apps/service-management/src/store/LocalStorageDesignerStore.js']);

    expect(plan.selectedLayers).toStrictEqual(['service-management/designer']);
    expect(plan.unitSuites).toStrictEqual([
      'apps/service-management/test/unit/designerStore.test.ts'
    ]);
    expect(plan.integrationScripts).toStrictEqual(['test:integration:service-management']);
  });

  it('runs the whole component — and nothing else — for a server change', () => {
    expect.hasAssertions();

    // The designer is served by and calls the server, so a server change
    // propagates outward to the designer suites; the blast radius stops there.
    const plan = planFor(['apps/service-management/server.js']);

    expect(plan.selectedLayers.sort()).toStrictEqual([
      'service-management/designer',
      'service-management/server'
    ]);
    expect(plan.unitSuites).toStrictEqual([
      'apps/service-management/test/unit/designerStore.test.ts'
    ]);
  });

  it('selects the SM suites for a changed SM suite file, not the tooling layer', () => {
    expect.hasAssertions();

    const plan = planFor(['apps/service-management/test/unit/designerStore.test.ts']);

    expect(plan.selectedLayers).toStrictEqual(['service-management/designer']);
    expect(plan.unitSuites).not.toContain('ci-cd/test/check-test-map.test.ts');
  });

  it('reaches the SM contract suites from a contract-shape change through reverse dependencies', () => {
    expect.hasAssertions();

    // No SM file changed and no import edge can exist against a YAML spec — the
    // selection has to come from the layer graph, or the contract-parity suites
    // silently stop covering the artifact they assert against.
    const plan = planFor(['spec/1.0.0.yml']);

    // arrayContaining is the point: a contract-shape change selects the whole
    // dependent pyramid; the claim here is that the SM layers are inside it.
    // eslint-disable-next-line jest/prefer-strict-equal -- asymmetric matcher, see above
    expect(plan.selectedLayers).toEqual(expect.arrayContaining([
      'contracts',
      'service-management/server',
      'service-management/designer'
    ]));
    expect(plan.integrationScripts).toContain('test:integration:service-management');
  });
});

/**
 * JUM-622 and JUM-623 — the browser harness is reachable by the selector.
 *
 * Asserted against the committed manifest, not a fixture. A fixture would prove
 * the resolver can select a layer that exists; what failed is that the layer did
 * not exist, so nothing under the harness matched and the task gate refused the
 * change set outright. Cana's only real coverage is these eighteen specs.
 *
 * JUM-623 then found the layer covered the spec directory and not the support
 * file and config at the repository root — which every spec loads. The paths
 * below are checked for existence for that reason: a glob matches a path that
 * was never there just as happily as one that is.
 */
describe('browser-harness selection (JUM-622, JUM-623)', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const realManifest = readTestMap(path.join(repoRoot, 'test-map.json'));
  const planFor = (files: string[]) => createLayerAwarePlan(files, {
    manifest: realManifest,
    root: repoRoot,
    graph: new Map()
  });

  it('registers every cypress spec that exists on disk', () => {
    expect.hasAssertions();

    const registered = realManifest.suites
      .filter((suite: { layer: string }) => suite.layer === 'browser-harness')
      .map((suite: { path: string }) => suite.path)
      .sort();
    const onDisk = fs.readdirSync(path.join(repoRoot, 'packages/cana/cypress'))
      .filter((name) => name.endsWith('.cy.ts'))
      .map((name) => `packages/cana/cypress/${name}`)
      .sort();

    expect(registered).toStrictEqual(onDisk);
  });

  // JUM-623. Every path asserted below has to exist, because glob matching does
  // not care whether it does. The JUM-622 version of the case underneath this
  // one asserted against `packages/cana/cypress/support/e2e.js` — a path that
  // has never existed — and passed, while the real support file at
  // `cypress/support/e2e.js` still mapped to no layer at all.
  const harnessFile = (relativePath: string) => {
    expect(fs.existsSync(path.join(repoRoot, relativePath))).toBe(true);
    return relativePath;
  };

  it('plans the browser suite for a change confined to the harness', () => {
    expect.hasAssertions();

    // The exact change set the gate rejected as `unsupported-change-set`.
    const plan = planFor(['CHANGELOG.md', harnessFile('cypress/support/e2e.js')]);

    expect(plan.type).toBe('layer-aware');
    expect(plan.selectedLayers).toStrictEqual(['browser-harness']);
    expect(plan.integrationScripts).toStrictEqual(['test:browser']);
  });

  it('plans the tooling layer for a lockfile-only change', () => {
    expect.hasAssertions();

    // bun.lock matches no source glob and is not documentation-only — without
    // the toolchain pin rule the gate rejected it as `unsupported-change-set`.
    const plan = planFor(['CHANGELOG.md', 'bun.lock']);

    expect(plan.type).toBe('layer-aware');
    expect(plan.selectedLayers).toStrictEqual(['tooling']);
  });

  it('plans the browser suite for a change to the cypress config', () => {
    expect.hasAssertions();

    // `cypress.config.js` carries specPattern, supportFile and the timeouts —
    // a change here can break every spec at once.
    const plan = planFor([harnessFile('cypress.config.js')]);

    expect(plan.selectedLayers).toStrictEqual(['browser-harness']);
    expect(plan.integrationScripts).toStrictEqual(['test:browser']);
  });

  it('plans the browser suite for a change to the shared spec helpers', () => {
    expect.hasAssertions();

    const plan = planFor([harnessFile('packages/cana/cypress/harness.ts')]);

    expect(plan.selectedLayers).toStrictEqual(['browser-harness']);
  });

  it('plans the browser suite for a change to cana source', () => {
    expect.hasAssertions();

    const plan = planFor(['packages/cana/src/CanaDatabase.ts']);

    expect(plan.selectedLayers).toContain('browser-harness');
    expect(plan.integrationScripts).toContain('test:browser');
  });

  it('keeps the browser run out of unrelated backend changes', () => {
    expect.hasAssertions();

    // `dependsOn: []` is the whole claim. Blast radius is outward, so listing
    // any backend layer as a dependency would drag a 294-test browser run into
    // every infra change; these specs cannot be affected by one.
    const plan = planFor(['apps/backend-template/src/infra/exceptions/index.ts']);

    expect(plan.selectedLayers).not.toContain('browser-harness');
    expect(plan.integrationScripts).not.toContain('test:browser');
  });
});

/**
 * Requirement 110's two structural rules, checked against the repository itself.
 *
 * Both are the kind that hold until someone reasonably decides otherwise in a
 * single file, at which point nothing fails and the property is gone.
 */
describe('requirement 110 runner rules', () => {
  const repoRootFor110 = path.resolve(__dirname, '../..');

  const testFilesUnder = (directory: string): string[] => {
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        const isNested = entry.isDirectory() && entry.name !== 'node_modules';
        const isTest = !entry.isDirectory() && /\.test\.tsx?$/.test(entry.name);
        if (isNested) walk(full);
        if (isTest) found.push(full);
      }
    };
    walk(path.join(repoRootFor110, directory));
    return found;
  };

  it('has no test file importing bun:test', () => {
    expect.hasAssertions();
    // Requirement 110 keeps Jest as the coverage instrument, which means the
    // coverage run and the test run must execute the same source. One import of
    // Bun's own test module makes that file uncoverable, and under Jest it fails
    // as a module-resolution error — which reads like a broken path rather than
    // a policy violation.
    //
    // The specifier is assembled rather than spelled out so this file does not
    // match its own check. Excluding this path instead would be an allowlist
    // entry capable of hiding a real violation later.
    const specifier = ['bun', 'test'].join(':');
    const importsRuntime = new RegExp(`(from|require\\()\\s*\\(?['"]${specifier}['"]`);

    const importers = testFilesUnder('apps/backend-template/test')
      .filter((file) => importsRuntime.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(repoRootFor110, file));

    expect(importers).toStrictEqual([]);
  });

  /** A node pin with no stated reason. Hoisted so the predicate is not a branch in a test body. */
  const isUnexplainedNodePin = (suite: { runner: string; reason?: string }) => (
    suite.runner === 'node' && !suite.reason
  );

  it('gives every node-pinned suite a reason', () => {
    expect.hasAssertions();
    // The exception exists for suites Bun cannot load at all. Without a stated
    // reason it is indistinguishable from someone routing around a failure.
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repoRootFor110, 'test-map.json'), 'utf8')
    ) as { suites: { path: string; runner: string; reason?: string }[] };

    const unexplained = manifest.suites
      .filter(isUnexplainedNodePin)
      .map((suite) => suite.path);

    expect(unexplained).toStrictEqual([]);
  });
});

describe('interface GUI placeholder docs do not select interface/runtime (JUM-757)', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const realManifest = readTestMap(path.join(repoRoot, 'test-map.json'));
  const planFor = (files: string[]) => createLayerAwarePlan(files, {
    manifest: realManifest,
    root: repoRoot,
    graph: new Map()
  });

  it('keeps README-only GUI placeholders out of the interface/runtime blast radius', () => {
    expect.hasAssertions();

    const plan = planFor([
      'apps/backend-template/src/interface/GUI/README.md',
      'apps/backend-template/src/interface/GUI/web/README.md',
      'apps/jumentix-website/components/architecture/HexagonalArchitectureMap.tsx'
    ]);

    expect(plan.selectedLayers).not.toContain('interface/runtime');
    expect([...plan.selectedLayers].sort()).toStrictEqual(['tooling', 'website']);
  });
});
