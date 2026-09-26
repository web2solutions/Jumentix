import {
  base,
  baseStrict,
  node,
  nodeStrict,
  reactNextA11y,
  reactNextA11yStrict,
  stylistic,
  stylisticStrict,
  test as testProfile,
  testStrict,
  typescript,
  typescriptStrict,
  vue,
  vueStrict
} from '../src';

const profiles: [string, () => unknown[]][] = [
  ['base', base],
  ['baseStrict', baseStrict],
  ['typescript', typescript],
  ['typescriptStrict', typescriptStrict],
  ['node', node],
  ['nodeStrict', nodeStrict],
  ['vue', vue],
  ['vueStrict', vueStrict],
  ['reactNextA11y', reactNextA11y],
  ['reactNextA11yStrict', reactNextA11yStrict],
  ['test', testProfile],
  ['testStrict', testStrict],
  ['stylistic', stylistic],
  ['stylisticStrict', stylisticStrict]
];

describe('exports contract', () => {
  it.each(profiles)('%s resolves to a non-empty flat-config array', (name, profile) => {
    expect.hasAssertions();
    const config = profile();
    expect(Array.isArray(config)).toBe(true);
    expect(config.length).toBeGreaterThan(0);
    for (const block of config) {
      expect(typeof block).toBe('object');
      expect(block).not.toBeNull();
    }
  });

  it('strict variants are supersets of their profile', () => {
    expect.hasAssertions();
    expect(baseStrict().length).toBeGreaterThan(base().length);
    expect(typescriptStrict().length).toBeGreaterThan(typescript().length);
    expect(vueStrict().length).toBeGreaterThan(vue().length);
    expect(reactNextA11yStrict().length).toBeGreaterThan(reactNextA11y().length);
    expect(testStrict().length).toBeGreaterThan(testProfile().length);
  });
});
