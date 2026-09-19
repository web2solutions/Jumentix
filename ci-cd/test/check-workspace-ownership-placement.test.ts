/* eslint-disable @typescript-eslint/no-var-requires */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const {
  findViolations,
  inferAssertedWorkspaces,
  suiteHome
} = require('../check-workspace-ownership-placement');

describe('check-workspace-ownership-placement (Req 137)', () => {
  const workspaces = [
    'apps/backend-template',
    'apps/service-management',
    'ci-cd',
    'packages/mutex-service'
  ];

  it('derives suite home from path', () => {
    expect.hasAssertions();
    expect(suiteHome('ci-cd/test/entry-point.test.ts')).toBe('ci-cd');
    expect(suiteHome('apps/service-management/test/unit/x.test.ts')).toBe('apps/service-management');
    expect(suiteHome('packages/mutex-service/test/x.test.ts')).toBe('packages/mutex-service');
  });

  it('flags a suite parked under the wrong workspace', () => {
    expect.hasAssertions();
    const asserted = inferAssertedWorkspaces(
      'apps/backend-template/test/unit/ServiceManagement/x.test.ts',
      'require(\'apps/service-management/server.js\')',
      workspaces
    );
    expect(asserted).toContain('apps/service-management');
  });

  it('allows consumer @jumentix wiring without flagging the package', () => {
    expect.hasAssertions();
    const asserted = inferAssertedWorkspaces(
      'apps/service-management/test/unit/x.test.ts',
      'const { x } = require(\'@jumentix/designer-core/model/rbacContract.js\');',
      workspaces
    );
    expect(asserted).toStrictEqual([]);
  });

  it('flags deep packages/*/src clones from an app suite', () => {
    expect.hasAssertions();
    const asserted = inferAssertedWorkspaces(
      'apps/backend-template/test/unit/infra/x.test.ts',
      'jest.mock(\'packages/mutex-service/src/MutexService\');',
      workspaces
    );
    expect(asserted).toContain('packages/mutex-service');
  });

  it('does not flag Req 126 config path pins from service-management', () => {
    expect.hasAssertions();
    const asserted = inferAssertedWorkspaces(
      'apps/service-management/test/unit/x.test.ts',
      'const pinned = \'apps/backend-template/src/config\';',
      workspaces
    );
    expect(asserted).not.toContain('apps/backend-template');
  });

  it('fails closed on a forbidden ServiceManagement home under backend-template', () => {
    expect.hasAssertions();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ownership-'));
    try {
      const forbidden = path.join(root, 'apps/backend-template/test/unit/ServiceManagement');
      fs.mkdirSync(forbidden, { recursive: true });
      fs.writeFileSync(path.join(forbidden, 'x.test.ts'), 'it("x", () => {});');
      const { violations } = findViolations(root, { allowlist: [] });
      expect(violations.some((v: { rule: string }) => v.rule === 'forbidden-sm-under-backend-template')).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('honours --changed blast radius', () => {
    expect.hasAssertions();
    const { violations } = findViolations(process.cwd(), {
      allowlist: [],
      changed: ['ci-cd/test/entry-point.test.ts']
    });
    const suiteHits = violations.filter((v: { rule: string; suite: string }) => v.rule === 'suite-home-vs-sut');
    expect(suiteHits.every((v: { suite: string }) => v.suite === 'ci-cd/test/entry-point.test.ts')).toBe(true);
  });
});
