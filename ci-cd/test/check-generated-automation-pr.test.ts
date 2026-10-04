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
        'apps/backend-template/package.json',
        'packages/cli-init/templates.manifest.json',
        'packages/cli-init/templates/backend/package.json',
        'packages/cli-init/templates/frontend/package.json'
      ]
    });
    expect(result.failures).toStrictEqual([]);
    expect(isAllowedReleasePath('apps/service-management/package.json')).toBe(true);
    expect(isAllowedReleasePath('packages/cli-init/templates/backend/package.json')).toBe(true);
  });

  it('allows packaging-gate repairs that ship with a release bump', () => {
    expect.hasAssertions();
    expect(isAllowedReleasePath('ci-cd/check-generated-automation-pr.js')).toBe(true);
    expect(isAllowedReleasePath('ci-cd/create-app-release-tag.js')).toBe(true);
    expect(isAllowedReleasePath('ci-cd/test/check-generated-automation-pr.test.ts')).toBe(true);
    expect(isAllowedReleasePath('README.md')).toBe(false);
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

  it('allows only package manifests on package-bump branches', () => {
    expect.hasAssertions();
    const ok = validateGeneratedAutomationPr({
      headRef: 'chore/package-bump-deadbeef',
      baseRef: 'main',
      changedFiles: [
        'packages/cana/package.json',
        'packages/cli-init/package.json',
        'packages/cli-init/templates.manifest.json'
      ]
    });
    expect(ok.failures).toStrictEqual([]);

    const bad = validateGeneratedAutomationPr({
      headRef: 'chore/package-bump-deadbeef',
      changedFiles: ['packages/cana/package.json', 'README.md']
    });
    expect(bad.failures).toStrictEqual([
      '[generated-automation] package-bump PR must only touch package manifests' +
        ' (+ cli-init templates.manifest.json); unexpected file: README.md'
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
