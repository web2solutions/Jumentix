import * as catalogStorage from '@src/interface/CLI/core/catalogStorage';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('cli catalog storage', () => {
  const runInTempWorkspace = async (callback: () => Promise<void>): Promise<void> => {
    const previousCwd = process.cwd();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aaa-cli-test-'));

    try {
      process.chdir(tmpDir);
      // No module reload: catalogStorage resolves its path per call, so the
      // chdir above is enough. It used to need `jest.resetModules()` because the
      // path was computed at import time (JUM-583).
      await callback();
    } finally {
      process.chdir(previousCwd);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  };

  it('loads default catalog when file does not exist', async () => {
    expect.hasAssertions();
    await runInTempWorkspace(async () => {
      const module = catalogStorage;
      const catalog = await module.loadCatalog();

      expect(catalog).toStrictEqual({
        version: 1,
        domains: [],
        entities: []
      });
    });
  });

  it('saves and reloads catalog contents', async () => {
    expect.hasAssertions();
    await runInTempWorkspace(async () => {
      const module = catalogStorage;

      const payload = {
        version: 1,
        domains: [{
          id: 'd1',
          name: 'Users',
          status: 'active',
          tags: ['core'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          description: 'user management',
          boundedContext: 'identity'
        }],
        entities: [{
          id: 'e1',
          name: 'User',
          domain: 'Users',
          kind: 'aggregate',
          description: 'user aggregate root',
          fields: [],
          behaviors: ['create', 'update'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      };

      await module.saveCatalog(payload as any);
      const loaded = await module.loadCatalog();

      expect(loaded).toStrictEqual(payload);
      expect(fs.existsSync(module.getCatalogFilePath())).toBe(true);

      await module.saveCatalog(payload as any);
      const raw = await fs.promises.readFile(module.getCatalogFilePath(), 'utf8');
      expect(JSON.parse(raw).domains).toHaveLength(1);
    });
  });

  it('normalizes loaded catalog when optional fields are missing', async () => {
    expect.hasAssertions();
    await runInTempWorkspace(async () => {
      const module = catalogStorage;
      const catalogPath = module.getCatalogFilePath();
      await fs.promises.mkdir(path.dirname(catalogPath), { recursive: true });
      await fs.promises.writeFile(catalogPath, JSON.stringify({ version: 0 }), 'utf8');

      const loaded = await module.loadCatalog();
      expect(loaded).toStrictEqual({
        version: 1,
        domains: [],
        entities: []
      });
    });
  });
});
