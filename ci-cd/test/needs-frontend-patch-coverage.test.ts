/* eslint-disable @typescript-eslint/no-var-requires */
const {
  evaluateNeedsFrontendPatchCoverage
} = require('../needs-frontend-patch-coverage.js');
const { isCoverageSubject } = require('../lib/coverage-subject.js');

describe('needs-frontend-patch-coverage', () => {
  it('skips when the patch only changes package.json / release-policy', () => {
    expect.hasAssertions();
    const verdict = evaluateNeedsFrontendPatchCoverage({
      rootDir: process.cwd(),
      baseRef: 'origin/main',
      listFiles: () => [
        'package.json',
        'release-policy.json',
        'apps/frontend/package.json',
        'apps/backend-template/package.json'
      ]
    });
    expect(verdict.needed).toBe(false);
    expect(verdict.subjects).toStrictEqual([]);
  });

  it('needs coverage when an apps/frontend source subject changes', () => {
    expect.hasAssertions();
    const verdict = evaluateNeedsFrontendPatchCoverage({
      rootDir: process.cwd(),
      baseRef: 'origin/main',
      listFiles: () => [
        'apps/frontend/src/data/sync.ts',
        'package.json'
      ]
    });
    expect(verdict.needed).toBe(true);
    expect(verdict.subjects).toContain('apps/frontend/src/data/sync.ts');
  });

  it('treats frontend tests as non-subjects', () => {
    expect.hasAssertions();
    expect(isCoverageSubject('apps/frontend/test/unit/data/syncDelta.test.ts')).toBe(false);
    const verdict = evaluateNeedsFrontendPatchCoverage({
      rootDir: process.cwd(),
      baseRef: 'origin/main',
      listFiles: () => ['apps/frontend/test/unit/data/syncDelta.test.ts']
    });
    expect(verdict.needed).toBe(false);
  });
});

describe('coverage-subject helpers in isolation', () => {
  it('rejects missing files', () => {
    expect.hasAssertions();
    // Local requires avoid colliding with other ci-cd test files under tsc
    // (TS2451 redeclare of fs/os/path across the suite graph).
    // eslint-disable-next-line global-require
    const fsLocal = require('fs');
    // eslint-disable-next-line global-require
    const osLocal = require('os');
    // eslint-disable-next-line global-require
    const pathLocal = require('path');
    const tmp = fsLocal.mkdtempSync(pathLocal.join(osLocal.tmpdir(), 'cov-subj-'));
    expect(isCoverageSubject('apps/frontend/src/missing.ts', { rootDir: tmp })).toBe(false);
  });
});
