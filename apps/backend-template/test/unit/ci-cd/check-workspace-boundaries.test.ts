/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const { classifyZone, readImports, validateImport } = require('../../../../../ci-cd/check-workspace-boundaries');

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

  it('allows explicitly bridged package @src alias usage during migration', () => {
    expect.hasAssertions();
    const violations = validateImport({
      rootDir,
      currentFile: path.join(rootDir, 'packages/external-store-proxy/src/ExternalStoreProxy.ts'),
      relativeFilePath: path.join('packages', 'external-store-proxy', 'src', 'ExternalStoreProxy.ts'),
      importPath: '@src/infra/exceptions'
    });
    expect(violations).toStrictEqual([]);
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
