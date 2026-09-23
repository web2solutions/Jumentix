/* eslint-disable @typescript-eslint/no-var-requires */
const {
  bumpSemver,
  classifySubject,
  computeNextVersion,
  extractNature,
  hasBreakingMarker
} = require('../lib/next-version.js');

describe('next-version', () => {
  it('maps Feature/feat to minor and Fix to patch; highest wins', () => {
    expect.hasAssertions();
    const result = computeNextVersion({
      baseVersion: '0.0.2',
      subjects: [
        '[JUM-100][Fix] patch one',
        '[JUM-101][Feature] add thing',
        '[JUM-102][Docs] ignore me',
        'fix: also patch'
      ],
      lastAppTag: 'v0.0.2'
    });
    expect(result.action).toBe('bump');
    expect(result.bumpLevel).toBe('minor');
    expect(result.nextVersion).toBe('0.1.0');
  });

  it('returns noop when there are no commits since the last tag', () => {
    expect.hasAssertions();
    const result = computeNextVersion({
      baseVersion: '0.1.0',
      subjects: [],
      lastAppTag: 'v0.1.0'
    });
    expect(result).toMatchObject({
      action: 'noop',
      reason: 'no-commits',
      nextVersion: '0.1.0',
      bumpLevel: null
    });
  });

  it('returns noop when every commit is ignored', () => {
    expect.hasAssertions();
    const result = computeNextVersion({
      baseVersion: '0.0.2',
      subjects: [
        'chore: synchronize changelog',
        '[JUM-200][Docs] docs only',
        '[JUM-201][Chore] chore only',
        'chore(release): v0.0.2'
      ],
      lastAppTag: 'v0.0.2'
    });
    expect(result.action).toBe('noop');
    expect(result.reason).toBe('no-releasable-commits');
  });

  it('bootstraps from zero tags without crashing and bumps from history', () => {
    expect.hasAssertions();
    const result = computeNextVersion({
      baseVersion: '0.0.2',
      subjects: [
        '[JUM-1][Feature] first',
        '[JUM-2][Fix] second'
      ],
      lastAppTag: null
    });
    expect(result.action).toBe('bump');
    expect(result.lastAppTag).toBeNull();
    expect(result.nextVersion).toBe('0.1.0');
  });

  it('treats breaking markers as major', () => {
    expect.hasAssertions();
    expect(hasBreakingMarker('feat!: break api')).toBe(true);
    expect(hasBreakingMarker('[JUM-9][Breaking] hard cut')).toBe(true);
    expect(classifySubject('fix: something\n\nBREAKING CHANGE: gone')).toBe('major');
    expect(bumpSemver('0.1.0', 'major')).toBe('1.0.0');
  });

  it('extracts Nature from PR-title style subjects', () => {
    expect.hasAssertions();
    expect(extractNature('[JUM-882][Feature] Tag conventions')).toBe('feature');
    expect(extractNature('feat(scope): conventional')).toBe('feat');
  });
});
