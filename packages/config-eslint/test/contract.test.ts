import { fixturesRoot, lintFixtures, ruleIds } from './helpers';
import {
  base,
  node,
  nodeStrict,
  reactNextA11y,
  stylistic,
  test as testProfile,
  typescript,
  typescriptStrict,
  vue,
  vueStrict
} from '../src';

const FIXTURES = fixturesRoot();

// Hoisted out of the test body: jest/no-conditional-in-test bans the
// ternary inside `it`.
const severityOf = (rule: unknown): unknown => (Array.isArray(rule) ? rule[0] : rule);
const fromFixtures = (relative: string): string => `${FIXTURES}${relative}`;

describe('profile fixtures — positive passes, negative flags', () => {
  it('base: no-console flags, clean module passes', async () => {
    expect.hasAssertions();
    const config = [...base(), ...stylistic()];
    const negative = await lintFixtures(config, ['base/negative.fixture.js']);
    expect(ruleIds(negative)).toContain('no-console');
    const positive = await lintFixtures(config, ['base/positive.fixture.js']);
    expect(ruleIds(positive)).toStrictEqual([]);
  });

  it('typescript: ts-expect-error without a description flags', async () => {
    expect.hasAssertions();
    const config = [
      ...base(),
      ...typescript({ tsconfigRootDir: FIXTURES, untypedFiles: ['typescript/**'] }),
      ...stylistic()
    ];
    const negative = await lintFixtures(config, ['typescript/negative.fixture.ts']);
    expect(ruleIds(negative)).toContain('@typescript-eslint/ban-ts-comment');
    const positive = await lintFixtures(config, ['typescript/positive.fixture.ts']);
    expect(ruleIds(positive)).toStrictEqual([]);
  });

  // JUM-44 owner decision (2026-09-24, 3,482 measured): no-explicit-any stays
  // off even in the strict variant — the contract test pins that decision.
  it('typescript strict: explicit any stays allowed (documented owner decision)', async () => {
    expect.hasAssertions();
    const config = [
      ...base(),
      ...typescriptStrict({ tsconfigRootDir: FIXTURES, untypedFiles: ['typescript/**'] }),
      ...stylistic()
    ];
    const results = await lintFixtures(config, ['typescript/negative-any.fixture.ts']);
    expect(ruleIds(results)).not.toContain('@typescript-eslint/no-explicit-any');
  });

  it('node: deprecated Buffer constructor flags', async () => {
    expect.hasAssertions();
    const config = [...base(), ...node(), ...stylistic()];
    const negative = await lintFixtures(config, ['node/negative.fixture.mjs']);
    expect(ruleIds(negative)).toContain('n/no-deprecated-api');
    const positive = await lintFixtures(config, ['node/positive.fixture.mjs']);
    expect(ruleIds(positive)).toStrictEqual([]);
  });

  it('node strict: an undeclared package flags via the dependency guard', async () => {
    expect.hasAssertions();
    const config = [...base({ packageDirs: [FIXTURES] }), ...nodeStrict(), ...stylistic()];
    const results = await lintFixtures(config, ['node/negative-extraneous.fixture.mjs']);
    expect(ruleIds(results)).toContain('import-x/no-extraneous-dependencies');
  });

  it('vue strict: inaccessible template flags via vuejs-accessibility', async () => {
    expect.hasAssertions();
    const config = [...base(), ...vueStrict({ tsconfigRootDir: FIXTURES }), ...stylistic()];
    const negative = await lintFixtures(config, ['vue/negative.fixture.vue']);
    expect(ruleIds(negative)).toContain('vuejs-accessibility/alt-text');
    const positive = await lintFixtures(config, ['vue/positive.fixture.vue']);
    expect(ruleIds(positive)).toStrictEqual([]);
  });

  it('vue non-strict keeps the current seed contract (essential tier)', async () => {
    expect.hasAssertions();
    const config = [...base(), ...vue(), ...stylistic()];
    const results = await lintFixtures(config, ['vue/negative.fixture.vue']);
    // a11y is strict-only: the missing alt must NOT flag at profile-active level
    expect(ruleIds(results)).not.toContain('vuejs-accessibility/alt-text');
  });

  it('reactNextA11y: missing alt text flags via jsx-a11y', async () => {
    expect.hasAssertions();
    const config = [
      ...base(),
      ...typescript({ tsconfigRootDir: FIXTURES, untypedFiles: ['react/**'] }),
      ...reactNextA11y(),
      ...stylistic()
    ];
    const negative = await lintFixtures(config, ['react/negative.fixture.tsx']);
    expect(ruleIds(negative)).toContain('jsx-a11y/alt-text');
    const positive = await lintFixtures(config, ['react/positive.fixture.tsx']);
    expect(ruleIds(positive)).toStrictEqual([]);
  });

  it('test: assertion-less test flags via jest/expect-expect', async () => {
    expect.hasAssertions();
    const config = [
      ...base(),
      ...typescript({ tsconfigRootDir: FIXTURES, untypedFiles: ['jest/**'] }),
      ...testProfile({ restifyAllowList: false, untypedFiles: ['jest/**'] }),
      ...stylistic()
    ];
    const negative = await lintFixtures(config, ['jest/test/negative.fixture.ts']);
    expect(ruleIds(negative)).toContain('jest/expect-expect');
    const positive = await lintFixtures(config, ['jest/test/positive.fixture.ts']);
    expect(ruleIds(positive)).toStrictEqual([]);
  });

  it('stylistic: prettier-compat disables formatting rules', async () => {
    expect.hasAssertions();
    const config = [...base(), ...stylistic()];
    const results = await lintFixtures(config, ['base/positive.fixture.js']);
    const { ESLint } = await import('eslint');
    const eslint = new ESLint({ cwd: FIXTURES, overrideConfigFile: true, overrideConfig: config });
    const calculated = await eslint.calculateConfigForFile(
      fromFixtures('base/positive.fixture.js')
    );
    expect([0, 'off']).toContainEqual(severityOf(calculated.rules.semi));
    expect([0, 'off']).toContainEqual(severityOf(calculated.rules.quotes));
    expect(results.length).toBeGreaterThan(0);
  });
});
