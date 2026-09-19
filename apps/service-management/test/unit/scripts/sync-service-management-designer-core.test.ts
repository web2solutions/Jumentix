/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import path from 'node:path';

/**
 * Unit suite for SM designer-core sync script (JUM-493) —
 * the script that vendors the `packages/designer-core/src/` module tree into
 * the zero-build Service Management SPA so the bare
 * `@jumentix/designer-core/…` specifiers resolve through the SPA's import map.
 *
 * Everything external is injected (fs, logger): the suite asserts the
 * script's fail-closed behaviour and its replace-not-merge copy, not the
 * filesystem.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  PACKAGE_SRC,
  VENDORED_DIR,
  syncServiceManagementDesignerCore
} = require(path.join(repoRoot, 'apps/service-management/scripts/sync-service-management-designer-core.js'));

type DirEntry = { name: string; isDirectory: () => boolean };

function createHarness(options: {
  sourceExists?: boolean;
  modules?: Record<string, string>;
} = {}) {
  const {
    sourceExists = true,
    modules = {
      'index.js': 'export * from \'./model/modelQueries.js\';\n',
      'model/modelQueries.js': 'export function toSchemaName() {}\n'
    }
  } = options;
  const logs: string[] = [];
  const errors: string[] = [];
  const written: Array<{ target: string; contents: string }> = [];
  const removed: string[] = [];
  const srcRoot = path.join('/repo', PACKAGE_SRC);

  const entriesOf = (dir: string): DirEntry[] => {
    const prefix = dir === srcRoot ? '' : `${path.relative(srcRoot, dir)}/`;
    const seen = new Map<string, DirEntry>();
    const addDir = (name: string) => {
      if (!seen.has(name)) seen.set(name, { name, isDirectory: () => true });
    };
    const addFile = (name: string) => {
      if (!seen.has(name)) seen.set(name, { name, isDirectory: () => false });
    };
    for (const rel of Object.keys(modules)) {
      if (rel.startsWith(prefix)) {
        const rest = rel.slice(prefix.length);
        if (rest.includes('/')) addDir(rest.split('/')[0]);
        else if (rest.length > 0) addFile(rest);
      }
    }
    return [...seen.values()];
  };

  const harness = {
    root: '/repo',
    exists: (target: string) => target === srcRoot && sourceExists,
    readDir: entriesOf,
    readFile: (target: string) => {
      const rel = path.relative(srcRoot, target).replace(/\\/g, '/');
      if (!(rel in modules)) throw new Error(`unexpected read: ${target}`);
      return modules[rel];
    },
    writeFile: (target: string, contents: string) => { written.push({ target, contents }); },
    removeDir: (target: string) => { removed.push(target); },
    logger: {
      log: (line: string) => logs.push(String(line)),
      error: (line: string) => errors.push(String(line))
    }
  };
  return {
    harness, logs, errors, written, removed
  };
}

describe('sync-service-management-designer-core (JUM-493)', () => {
  it('pins the package source and vendored-tree paths', () => {
    expect.hasAssertions();
    expect(PACKAGE_SRC).toBe(path.join('packages', 'designer-core', 'src'));
    expect(VENDORED_DIR).toBe(path.join('apps', 'service-management', 'vendor', 'designer-core'));
  });

  it('fails closed when the package source is missing', () => {
    expect.hasAssertions();
    const { harness, errors, written } = createHarness({ sourceExists: false });
    expect(syncServiceManagementDesignerCore(harness)).toBe(1);
    expect(errors.join('\n')).toContain('package source not found');
    expect(written).toStrictEqual([]);
  });

  it('fails closed when the source tree has no barrel', () => {
    expect.hasAssertions();
    const { harness, errors, written } = createHarness({
      modules: { 'model/modelQueries.js': 'export {}\n' }
    });
    expect(syncServiceManagementDesignerCore(harness)).toBe(1);
    expect(errors.join('\n')).toContain('index.js missing');
    expect(written).toStrictEqual([]);
  });

  it('replaces the vendored tree with a verbatim copy of the package sources', () => {
    expect.hasAssertions();
    const {
      harness, logs, written, removed
    } = createHarness();
    expect(syncServiceManagementDesignerCore(harness)).toBe(0);

    // Replace, not merge: the old tree is removed first so a module deleted
    // from the package stops being served.
    expect(removed).toStrictEqual([path.join('/repo', VENDORED_DIR)]);

    const byTarget = new Map(written.map((entry) => [entry.target, entry.contents]));
    expect(byTarget.get(path.join('/repo', VENDORED_DIR, 'index.js')))
      .toBe('export * from \'./model/modelQueries.js\';\n');
    expect(byTarget.get(path.join('/repo', VENDORED_DIR, 'model', 'modelQueries.js')))
      .toBe('export function toSchemaName() {}\n');
    expect(logs.join('\n')).toContain('designer-core synced');
  });

  it('skips non-JavaScript files when walking the module tree', () => {
    expect.hasAssertions();
    const { harness, written } = createHarness({
      modules: {
        'index.js': 'export {}\n',
        'model/modelQueries.js': 'export function toSchemaName() {}\n',
        'model/NOTES.md': '# notes\n',
        'README.md': '# designer-core\n'
      }
    });
    expect(syncServiceManagementDesignerCore(harness)).toBe(0);
    const copied = written.map((entry) => path.basename(entry.target)).sort();
    expect(copied).toStrictEqual(['index.js', 'modelQueries.js']);
  });

  it('defaults to the process working directory when called without options', () => {
    expect.hasAssertions();
    // The default-argument path runs the real sync against the checkout: the
    // package src tree exists, so this is the same replace-not-merge copy the
    // CI script performs, targeted at the gitignored vendor directory.
    const repoRootDir = path.resolve(repoRoot);
    expect(process.cwd()).toBe(repoRootDir);
    expect(syncServiceManagementDesignerCore()).toBe(0);
    const fs = require('fs');
    expect(fs.existsSync(path.join(repoRootDir, VENDORED_DIR, 'index.js'))).toBe(true);
  });
});
