/* eslint-disable @typescript-eslint/no-var-requires */
const {
  extractChangelogSection
} = require('../create-github-release.js');
const {
  packageTagName,
  resolveCohort
} = require('../publish-npm-cohort.js');

describe('create-github-release helpers', () => {
  it('extracts the CHANGELOG section for an application tag', () => {
    expect.hasAssertions();
    const changelog = [
      '# Changelog',
      '',
      '## Unreleased',
      '',
      '- pending',
      '',
      '## v0.1.0 - 2026-09-23',
      '',
      '- 2026-09-23 [JUM-1][Feature] thing - Author',
      '',
      '## v0.0.2 - 2026-09-01',
      '',
      '- older',
      ''
    ].join('\n');
    const section = extractChangelogSection(changelog, 'v0.1.0');
    expect(section.title).toBe('v0.1.0');
    expect(section.body).toContain('[JUM-1][Feature] thing');
    expect(section.body).not.toContain('older');
  });
});

describe('publish-npm-cohort helpers', () => {
  it('builds package tags from name and version', () => {
    expect.hasAssertions();
    expect(packageTagName('@jumentix/cana', '0.1.0')).toBe('@jumentix/cana@0.1.0');
  });

  it('resolves known cohorts and rejects unknown ones', () => {
    expect.hasAssertions();
    expect(resolveCohort('cana')).toStrictEqual(['cana', 'cana-react', 'cana-vue']);
    expect(() => resolveCohort('nope')).toThrow(/Unsupported release cohort/);
  });
});
