/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  classifyZone,
  collectSourceFiles,
  readImports,
  validateImport
} = require('../check-workspace-boundaries');

describe('check-workspace-boundaries', () => {
  const rootDir = '/repo';

  it('classifies workspace zones', () => {
    expect.hasAssertions();
    expect(classifyZone(path.join('apps', 'backend-template', 'src', 'x.ts'))).toBe('backend');
    expect(classifyZone(path.join('apps', 'service-management', 'server.js'))).toBe('service-management');
    expect(classifyZone(path.join('packages', 'message-mediator', 'src', 'index.ts'))).toBe('package');
    expect(classifyZone(path.join('sdk-clients', 'rest', 'index.ts'))).toBe('legacy-sdk');
  });

  it('reads static and dynamic imports from source', () => {
    expect.hasAssertions();
    const source = `
      import x from '@src/modules/foo';
      const y = await import('@jumentix/message-mediator');
      const z = await import('./local-module');
    `;
    expect(readImports(source)).toStrictEqual([
      '@src/modules/foo',
      '@jumentix/message-mediator',
      './local-module'
    ]);
  });

  it('does not scan generated dist output', () => {
    expect.hasAssertions();
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-boundaries-'));

    try {
      const sourceDir = path.join(temporaryRoot, 'packages', 'example', 'src');
      const distDir = path.join(temporaryRoot, 'packages', 'example', 'dist');
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.mkdirSync(distDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, 'index.ts'), 'export {};\n');
      fs.writeFileSync(path.join(distDir, 'index.d.ts'), 'import x from \'@src/generated\';\n');

      expect(collectSourceFiles(temporaryRoot, 'packages')).toStrictEqual([
        path.join(sourceDir, 'index.ts')
      ]);
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('does not scan packaged CLI template slices (JUM-845)', () => {
    expect.hasAssertions();
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-boundaries-tpl-'));

    try {
      const sourceDir = path.join(temporaryRoot, 'packages', 'cli-init', 'src');
      const templatesDir = path.join(temporaryRoot, 'packages', 'cli-init', 'templates', 'backend');
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.mkdirSync(templatesDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, 'index.ts'), 'export {};\n');
      fs.writeFileSync(path.join(templatesDir, 'seed.ts'), 'import x from \'@src/modules/Users\';\n');

      expect(collectSourceFiles(temporaryRoot, 'packages')).toStrictEqual([
        path.join(sourceDir, 'index.ts')
      ]);
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  it('allows backend @src alias usage', () => {
    expect.hasAssertions();
    const violations = validateImport({
      rootDir,
      currentFile: path.join(rootDir, 'apps/backend-template/src/file.ts'),
      relativeFilePath: path.join('apps', 'backend-template', 'src', 'file.ts'),
      importPath: '@src/modules/Users'
    });
    expect(violations).toStrictEqual([]);
  });

  /**
   * The bridge is gone (JUM-601).
   *
   * This test used to assert the opposite: `external-store-proxy` was named in
   * a one-entry allowlist, with no date, no issue and no reason, so nothing
   * made it expire. The three database errors it needed now live in
   * `@jumentix/persistence-contracts`, and the file it exempted is subject to
   * the rule like every other.
   */
  it('no longer exempts external-store-proxy from the @src rule', () => {
    expect.hasAssertions();
    const violations = validateImport({
      rootDir,
      currentFile: path.join(rootDir, 'packages/external-store-proxy/src/ExternalStoreProxy.ts'),
      relativeFilePath: path.join('packages', 'external-store-proxy', 'src', 'ExternalStoreProxy.ts'),
      importPath: '@src/infra/exceptions'
    });
    expect(violations).toStrictEqual([
      'packages/external-store-proxy/src/ExternalStoreProxy.ts: '
      + '@src alias is only allowed inside apps/backend-template'
    ]);
  });

  it('blocks @src outside backend and app-cross imports from packages', () => {
    expect.hasAssertions();
    const fromServiceManagement = validateImport({
      rootDir,
      currentFile: path.join(rootDir, 'apps/service-management/src/file.ts'),
      relativeFilePath: path.join('apps', 'service-management', 'src', 'file.ts'),
      importPath: '@src/modules/Users'
    });
    expect(fromServiceManagement).toContain(
      'apps/service-management/src/file.ts: @src alias is only allowed inside apps/backend-template'
    );

    const fromPackage = validateImport({
      rootDir,
      currentFile: path.join(rootDir, 'packages/sdk-rest-client/src/index.ts'),
      relativeFilePath: path.join('packages', 'sdk-rest-client', 'src', 'index.ts'),
      importPath: '../../../apps/backend-template/src/interface/HTTP/RestAPI'
    });
    expect(fromPackage).toContain(
      'packages/sdk-rest-client/src/index.ts: packages must not import from apps ("../../../apps/backend-template/src/interface/HTTP/RestAPI")'
    );
  });

  it('blocks legacy sdk-clients imports for non-legacy zones', () => {
    expect.hasAssertions();
    const legacySdk = validateImport({
      rootDir,
      currentFile: path.join(rootDir, 'apps/backend-template/src/file.ts'),
      relativeFilePath: path.join('apps', 'backend-template', 'src', 'file.ts'),
      importPath: 'sdk-clients/rest'
    });
    expect(legacySdk).toContain(
      'apps/backend-template/src/file.ts: legacy sdk-clients import is forbidden ("sdk-clients/rest")'
    );
  });
});
