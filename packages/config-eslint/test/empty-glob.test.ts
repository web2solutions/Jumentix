import { lintFixtures } from './helpers';

describe('empty-glob detection (JUM-14)', () => {
  it('a config whose globs match nothing fails loudly', async () => {
    expect.hasAssertions();
    await expect(
      lintFixtures(
        [{ files: ['**/*.doesnotexist'], rules: { 'no-console': 'error' } }],
        ['base/positive.fixture.js']
      )
    ).rejects.toThrow(/empty-glob/);
  });

  it('linting zero files fails loudly even with a valid config', async () => {
    expect.hasAssertions();
    await expect(lintFixtures([{ files: ['**/*.js'], rules: {} }], [])).rejects.toThrow(
      /empty-glob/
    );
  });
});
