/* eslint-disable @typescript-eslint/no-var-requires */
const { resolveCiPlan, resolveInputFiles } = require('../run-monorepo-ci');

describe('run-monorepo-ci', () => {
  it('does not allow docs-only changes to bypass the canonical matrix', () => {
    expect.hasAssertions();
    const plan = resolveCiPlan({
      root: false,
      apps: [],
      packages: [],
      docsOnly: true,
      files: ['README.md']
    });

    expect(plan).toStrictEqual([['bun', ['run', 'ci:gate:strict']]]);
  });

  it('uses the same canonical matrix for app and package changes', () => {
    expect.hasAssertions();
    const plan = resolveCiPlan({
      root: false,
      apps: ['backend-template'],
      packages: ['sdk-rest-client'],
      docsOnly: false,
      files: ['apps/backend-template/package.json', 'packages/sdk-rest-client/src/index.ts']
    });

    expect(plan).toStrictEqual([['bun', ['run', 'ci:gate:strict']]]);
  });

  it('uses explicit argv files when provided', () => {
    expect.hasAssertions();
    const files = resolveInputFiles(['README.md', 'apps/backend-template/package.json'], {
      baseRef: 'origin/main'
    });
    expect(files).toStrictEqual(['README.md', 'apps/backend-template/package.json']);
  });

  it('reads changed files from git base ref when argv is empty', () => {
    expect.hasAssertions();
    const readChangedFiles = jest.fn().mockReturnValue([
      'apps/backend-template/src/index.ts'
    ]);

    const files = resolveInputFiles([], { baseRef: 'origin/main', readChangedFiles });
    expect(files).toStrictEqual(['apps/backend-template/src/index.ts']);
    expect(readChangedFiles).toHaveBeenCalledWith('origin/main');
  });
});
