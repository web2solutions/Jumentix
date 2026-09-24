/* eslint-disable @typescript-eslint/no-var-requires */
const {
  extractChangelogSection
} = require('../create-github-release.js');
const {
  packageTagName,
  resolveCohort
} = require('../publish-npm-cohort.js');
const {
  resolveRepository,
  resolveToken
} = require('../lib/github-signed-commit.js');
const {
  createAppReleaseTagGithubApi
} = require('../create-app-release-tag.js');

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

  it('accepts CHANGELOG_GH_TOKEN as a release credential alias', () => {
    expect.hasAssertions();
    expect(resolveToken({ CHANGELOG_GH_TOKEN: 'pat' })).toBe('pat');
    expect(resolveToken({ GH_TOKEN: 'gh', CHANGELOG_GH_TOKEN: 'pat' })).toBe('gh');
    expect(resolveRepository({ GITHUB_REPOSITORY: 'web2solutions/Jumentix' }))
      .toBe('web2solutions/Jumentix');
  });
});

describe('create-app-release-tag --github-api dry-run', () => {
  it('plans a tag without calling GitHub when --dry-run', () => {
    expect.hasAssertions();
    const result = createAppReleaseTagGithubApi({
      dryRun: true,
      rootDir: process.cwd(),
      repository: 'web2solutions/Jumentix',
      env: { CHANGELOG_GH_TOKEN: 'test-token', GITHUB_REPOSITORY: 'web2solutions/Jumentix' }
    });
    expect(result).toStrictEqual(expect.objectContaining({
      mode: 'github-api',
      dryRun: true,
      action: 'create',
      tag: expect.stringMatching(/^v\d+\.\d+\.\d+$/)
    }));
  });
});

describe('create-app-release-tag absolute CLI resolution', () => {
  const {
    resolveSleepBinary,
    resolveBunBinary
  } = require('../create-app-release-tag.js');

  it('resolves sleep to a fixed system path', () => {
    expect.hasAssertions();
    expect(resolveSleepBinary(() => true)).toBe('/bin/sleep');
    expect(resolveSleepBinary((p: string) => p === '/usr/bin/sleep')).toBe('/usr/bin/sleep');
  });

  it('resolves bun without searching PATH by bare name', () => {
    expect.hasAssertions();
    expect(resolveBunBinary({
      execPath: '/usr/bin/node',
      exists: (p: string) => p === '/usr/local/bin/bun'
    })).toBe('/usr/local/bin/bun');
    expect(resolveBunBinary({
      execPath: '/opt/homebrew/bin/bun',
      exists: () => false
    })).toBe('/opt/homebrew/bin/bun');
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
