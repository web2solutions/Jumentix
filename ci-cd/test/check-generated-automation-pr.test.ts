/* eslint-disable @typescript-eslint/no-var-requires */
const {
  isAllowedReleasePath,
  validateGeneratedAutomationPr
} = require('../check-generated-automation-pr');

describe('check-generated-automation-pr', () => {
  it('allows only version metadata on app-release branches', () => {
    expect.hasAssertions();
    const result = validateGeneratedAutomationPr({
      headRef: 'chore/release-v0.2.15',
      baseRef: 'main',
      changedFiles: [
        'package.json',
        'release-policy.json',
        'apps/frontend/package.json',
        'apps/backend-template/package.json'
      ]
    });
    expect(result.failures).toStrictEqual([]);
    expect(isAllowedReleasePath('apps/service-management/package.json')).toBe(true);
    expect(isAllowedReleasePath('ci-cd/create-app-release-tag.js')).toBe(false);
  });

  it('rejects unexpected paths on release and changelog branches', () => {
    expect.hasAssertions();
    const release = validateGeneratedAutomationPr({
      headRef: 'chore/release-v0.2.15',
      changedFiles: ['package.json', 'README.md']
    });
    expect(release.failures).toStrictEqual([
      '[generated-automation] release PR must only bump version metadata; unexpected file: README.md'
    ]);

    const changelog = validateGeneratedAutomationPr({
      headRef: 'chore/changelog-sync-deadbeef',
      changedFiles: ['CHANGELOG.md', 'package.json']
    });
    expect(changelog.failures).toStrictEqual([
      '[generated-automation] changelog PR must only touch CHANGELOG.md; unexpected file: package.json'
    ]);
  });

  it('forces base main when CircleCI QUALITY_GATE_TARGET equals the head branch', () => {
    expect.hasAssertions();
    const result = validateGeneratedAutomationPr({
      headRef: 'chore/release-v0.2.15',
      env: {
        CIRCLE_BRANCH: 'chore/release-v0.2.15',
        JUMENTIX_QUALITY_GATE_TARGET: 'chore/release-v0.2.15'
      },
      changedFiles: ['package.json', 'release-policy.json']
    });
    expect(result.baseRef).toBe('main');
    expect(result.failures).toStrictEqual([]);
  });
});
