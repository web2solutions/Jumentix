/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const {
  assertAcyclic,
  outwardClosure,
  validateTestMap
} = require('../../../../../ci-cd/lib/test-map');
const { createLayerAwarePlan, matchGlob, resolveAlias } = require('../../../../../ci-cd/lib/layer-resolver');
const { buildGateEvidence, validateGateEvidence } = require('../../../../../ci-cd/lib/gate-evidence');

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
        root: path.resolve(__dirname, '../../../../../'),
        graph: new Map([
          ['apps/backend-template/src/modules/Users/domain/Model/User.ts', []]
        ])
      }
    );
    expect(plan.type).toBe('layer-aware');
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
    const root = path.resolve(__dirname, '../../../../../');
    // eslint-disable-next-line global-require
    const { readTestMap } = require('../../../../../ci-cd/lib/test-map');
    const result = validateTestMap(readTestMap(path.join(root, 'test-map.json')), { root });
    expect(result.ok).toBe(true);
  });
});
