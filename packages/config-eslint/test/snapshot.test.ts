import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ESLint } from 'eslint';

import { fixturesRoot } from './helpers';
import {
  base,
  baseStrict,
  node,
  nodeStrict,
  reactNextA11y,
  reactNextA11yStrict,
  stylistic,
  test as testProfile,
  testStrict,
  typescript,
  typescriptStrict,
  vue,
  vueStrict
} from '../src';

const FIXTURES = fixturesRoot();

/**
 * eslint-plugin-n computes some rule options from the nearest package.json /
 * engines at load time, so they legitimately vary with the working directory
 * the suite runs from. Severity is always asserted; options are normalized
 * for the volatile entries only (everything else is compared verbatim).
 */
const VOLATILE_RULE_OPTIONS = new Set([
  'n/no-unsupported-features/es-syntax',
  'n/no-unsupported-features/node-builtins'
]);

function normalizeVolatileOptions(rules: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(rules).map(([ruleId, config]) => [
      ruleId,
      VOLATILE_RULE_OPTIONS.has(ruleId) && Array.isArray(config) ? [config[0], 'normalized'] : config
    ])
  );
}

async function effectiveRules(config: unknown[], file: string): Promise<Record<string, unknown>> {
  const eslint = new ESLint({
    cwd: FIXTURES,
    overrideConfigFile: true,
    overrideConfig: config as never
  });
  const calculated = await eslint.calculateConfigForFile(`${FIXTURES}${file}`);
  if (!calculated) {
    throw new Error(`no effective config for ${file}`);
  }
  return normalizeVolatileOptions(
    Object.fromEntries(
      Object.entries(calculated.rules ?? {}).sort(([a], [b]) => a.localeCompare(b))
    )
  );
}

/**
 * Effective-config snapshots (JUM-14): an accidental rule drop — a plugin
 * bump that silently removes a rule, a profile edited in the wrong order —
 * changes the snapshot and fails this suite. Snapshots are committed JSON so
 * the suite behaves identically under bun test and Jest (the coverage matrix
 * runs both); regenerate with UPDATE_CONFIG_SNAPSHOTS=1 and review the diff
 * deliberately.
 */
describe('effective-config snapshots', () => {
  const cases: [string, () => unknown[], string][] = [
    ['base', () => [...base({ packageDirs: [FIXTURES] }), ...stylistic()], 'base/positive.fixture.js'],
    ['baseStrict', () => [...baseStrict({ packageDirs: [FIXTURES] }), ...stylistic()], 'base/positive.fixture.js'],
    ['typescript', () => [...base({ packageDirs: [FIXTURES] }), ...typescript({ tsconfigRootDir: FIXTURES, untypedFiles: ['typescript/**'] }), ...stylistic()], 'typescript/positive.fixture.ts'],
    ['typescriptStrict', () => [...base({ packageDirs: [FIXTURES] }), ...typescriptStrict({ tsconfigRootDir: FIXTURES, untypedFiles: ['typescript/**'] }), ...stylistic()], 'typescript/positive.fixture.ts'],
    ['node', () => [...base({ packageDirs: [FIXTURES] }), ...node(), ...stylistic()], 'node/positive.fixture.js'],
    ['nodeStrict', () => [...base({ packageDirs: [FIXTURES] }), ...nodeStrict(), ...stylistic()], 'node/positive.fixture.js'],
    ['vue', () => [...base({ packageDirs: [FIXTURES] }), ...vue(), ...stylistic()], 'vue/positive.fixture.vue'],
    ['vueStrict', () => [...base({ packageDirs: [FIXTURES] }), ...vueStrict({ tsconfigRootDir: FIXTURES }), ...stylistic()], 'vue/positive.fixture.vue'],
    ['reactNextA11y', () => [...base({ packageDirs: [FIXTURES] }), ...typescript({ tsconfigRootDir: FIXTURES, untypedFiles: ['react/**'] }), ...reactNextA11y(), ...stylistic()], 'react/positive.fixture.tsx'],
    ['reactNextA11yStrict', () => [...base({ packageDirs: [FIXTURES] }), ...typescript({ tsconfigRootDir: FIXTURES, untypedFiles: ['react/**'] }), ...reactNextA11yStrict(), ...stylistic()], 'react/positive.fixture.tsx'],
    ['test', () => [...base({ packageDirs: [FIXTURES] }), ...typescript({ tsconfigRootDir: FIXTURES, untypedFiles: ['jest/**'] }), ...testProfile({ restifyAllowList: false, untypedFiles: ['jest/**'] }), ...stylistic()], 'jest/test/positive.fixture.ts'],
    ['testStrict', () => [...base({ packageDirs: [FIXTURES] }), ...typescriptStrict({ tsconfigRootDir: FIXTURES, untypedFiles: ['jest/**'] }), ...testStrict({ restifyAllowList: false, untypedFiles: ['jest/**'] }), ...stylistic()], 'jest/test/positive.fixture.ts']
  ];

  const snapshotsDir = join(__dirname, 'snapshots');

  // Conditional lifted out of the test body (jest/no-conditional-in-test).
  const persistSnapshot = (snapshotPath: string, rules: Record<string, unknown>): void => {
    if (process.env.UPDATE_CONFIG_SNAPSHOTS !== '1') {
      return;
    }
    mkdirSync(snapshotsDir, { recursive: true });
    writeFileSync(snapshotPath, `${JSON.stringify(rules, null, 2)}\n`);
  };

  it.each(cases)('%s effective rules match the committed snapshot', async (name, config, file) => {
    expect.hasAssertions();
    const rules = await effectiveRules(config(), file);
    const snapshotPath = join(snapshotsDir, `${name}.json`);
    persistSnapshot(snapshotPath, rules);
    const committed = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    expect(rules).toStrictEqual(committed);
  });
});
