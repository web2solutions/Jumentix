/* eslint-disable @typescript-eslint/no-var-requires */
const { resolveCiPlan, resolveInputFiles } = require('../../../../../ci-cd/run-monorepo-ci');

describe('run-monorepo-ci', () => {
  it('returns docs-only lightweight plan', () => {
    expect.hasAssertions();
    const plan = resolveCiPlan({
      root: false,
      apps: [],
      packages: [],
      docsOnly: true,
      files: ['README.md']
    });

    expect(plan).toStrictEqual([
      ['npm', ['run', 'lint']],
      ['npm', ['run', 'changelog:check']]
    ]);
  });

  it('returns strict gate plus app/package scoped commands', () => {
    expect.hasAssertions();
    const plan = resolveCiPlan({
      root: false,
      apps: ['backend-template'],
      packages: ['sdk-rest-client'],
      docsOnly: false,
      files: ['apps/backend-template/package.json', 'packages/sdk-rest-client/src/index.ts']
    });

    expect(plan).toStrictEqual([
      ['npm', ['run', 'ci:gate:strict']],
      ['npm', ['run', 'build', '--prefix', 'apps/backend-template']],
      ['npm', ['run', 'test', '--prefix', 'apps/backend-template']],
      ['npm', ['run', 'build', '--prefix', 'packages/sdk-rest-client']],
      ['npm', ['run', 'test', '--prefix', 'packages/sdk-rest-client']]
    ]);
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
