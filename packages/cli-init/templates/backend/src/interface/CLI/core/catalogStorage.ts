import fs from 'fs';
import path from 'path';
import type { IWorkspaceCatalog } from '@src/interface/CLI/types';

/**
 * Where the catalog lives, resolved per call rather than at import time.
 *
 * It used to be two module-level constants computed from `process.cwd()` when
 * the module was first loaded. That fixes the catalog to whatever directory the
 * process happened to start in: a CLI that changes directory, or that is
 * imported before the target workspace is known, would read and write somewhere
 * the user never chose — silently, since a missing file just yields the default
 * catalog rather than an error.
 *
 * It also forced the tests to reload the module through `jest.resetModules()`
 * after each `chdir`, which does not exist under Bun's runner (JUM-583). The
 * lazy form is correct on its own terms and portable as a side effect.
 */
const catalogDir = (): string => path.resolve(process.cwd(), '.aaa-cli');
const catalogFile = (): string => path.join(catalogDir(), 'workspace-catalog.json');

const defaultCatalog = (): IWorkspaceCatalog => ({
  version: 1,
  domains: [],
  entities: []
});

export const loadCatalog = async (): Promise<IWorkspaceCatalog> => {
  const file = catalogFile();
  if (!fs.existsSync(file)) {
    return defaultCatalog();
  }

  const data = await fs.promises.readFile(file, 'utf8');
  const parsed = JSON.parse(data) as IWorkspaceCatalog;
  return {
    version: parsed.version || 1,
    domains: parsed.domains || [],
    entities: parsed.entities || []
  };
};

export const saveCatalog = async (catalog: IWorkspaceCatalog): Promise<void> => {
  const dir = catalogDir();
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
  await fs.promises.writeFile(catalogFile(), JSON.stringify(catalog, null, 2), 'utf8');
};

export const getCatalogFilePath = (): string => catalogFile();
