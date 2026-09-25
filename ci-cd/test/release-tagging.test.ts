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
  it('plans a create action without calling GitHub when --dry-run', () => {
    expect.hasAssertions();
    const result = createAppReleaseTagGithubApi({
      dryRun: true,
      rootDir: process.cwd(),
      repository: 'web2solutions/Jumentix',
      env: { CHANGELOG_GH_TOKEN: 'test-token', GITHUB_REPOSITORY: 'web2solutions/Jumentix' },
      // Decouple from live tip history (after v0.2.1 only ignore-level changelog
      // syncs remain, so the real resolver correctly noops — JUM-889).
      headHasAppTag: () => '',
      resolveNextVersion: () => ({
        action: 'bump',
        bumpLevel: 'patch',
        baseVersion: '0.2.1',
        nextVersion: '0.2.2'
      })
    });
    expect(result).toStrictEqual(expect.objectContaining({
      mode: 'github-api',
      dryRun: true,
      action: 'create',
      tag: 'v0.2.2',
      version: '0.2.2'
    }));
  });

  it('plans a noop when the tip has no releasable commits', () => {
    expect.hasAssertions();
    const result = createAppReleaseTagGithubApi({
      dryRun: true,
      rootDir: process.cwd(),
      repository: 'web2solutions/Jumentix',
      env: { CHANGELOG_GH_TOKEN: 'test-token', GITHUB_REPOSITORY: 'web2solutions/Jumentix' },
      headHasAppTag: () => '',
      resolveNextVersion: () => ({
        action: 'noop',
        reason: 'no-releasable-commits'
      })
    });
    expect(result).toStrictEqual(expect.objectContaining({
      mode: 'github-api',
      dryRun: true,
      action: 'noop',
      reason: 'no-releasable-commits'
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

describe('waitForPullRequestMergeable fail-fast', () => {
  const {
    waitForPullRequestMergeable,
    listFailedRequiredChecks
  } = require('../create-app-release-tag.js');

  it('lists failed required checks from the rollup', () => {
    expect.hasAssertions();
    const failed = listFailedRequiredChecks('https://example.test/pr/1', {
      runGh: () => JSON.stringify([
        { name: 'ci/circleci: coverage', url: 'https://circleci.com/gh/x/1' }
      ])
    });
    expect(failed).toStrictEqual([
      { name: 'ci/circleci: coverage', url: 'https://circleci.com/gh/x/1' }
    ]);
  });

  it('throws immediately when BLOCKED with a failed required check', () => {
    expect.hasAssertions();
    const calls: string[][] = [];
    const returns = [
      'BLOCKED',
      JSON.stringify([
        {
          name: 'ci/circleci: coverage',
          url: 'https://circleci.com/gh/web2solutions/Jumentix/1025'
        }
      ])
    ];
    let next = 0;
    const runGh = (args: string[]) => {
      calls.push(args);
      const value = returns[Math.min(next, returns.length - 1)];
      next += 1;
      return value;
    };
    let thrown: Error | undefined;
    try {
      waitForPullRequestMergeable('https://example.test/pr/479', {
        runGh,
        pollMs: 1,
        timeoutMs: 1000
      });
    } catch (error) {
      thrown = error as Error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(String(thrown?.message)).toMatch(/Required checks failed.*ci\/circleci: coverage/);
    expect(calls.length).toBeGreaterThanOrEqual(2);
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
