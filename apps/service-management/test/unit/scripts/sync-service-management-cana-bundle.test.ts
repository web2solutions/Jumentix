/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import path from 'node:path';

/**
 * Unit suite for SM cana-bundle sync script (JUM-484) —
 * the script that vendors packages/cana's browser ESM build into the
 * zero-build Service Management SPA so the bare `@jumentix/cana` specifier
 * resolves through the SPA's import map.
 *
 * Everything external is injected (spawn, fs, logger): the suite asserts the
 * script's fail-closed behaviour and its happy-path copy, not bun's bundler.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  CANA_DIST_FILE,
  CANA_SOURCE_ENTRY,
  REQUIRED_BINDING,
  VENDORED_FILE,
  VENDORED_HEADER,
  syncServiceManagementCanaBundle
} = require(path.join(repoRoot, 'apps/service-management/scripts/sync-service-management-cana-bundle.js'));

function createHarness(options: {
  sourceExists?: boolean;
  buildStatus?: number;
  distExists?: boolean;
  distContents?: string;
} = {}) {
  const {
    sourceExists = true,
    buildStatus = 0,
    distExists = true,
    distContents = 'function createCanaDatabaseClient(options) { return options; }\n'
      + 'export { createCanaDatabaseClient };\n'
  } = options;
  const logs: string[] = [];
  const errors: string[] = [];
  const written: Array<{ target: string; contents: string }> = [];
  const spawnCalls: Array<{ command: string; args: string[] }> = [];
  const harness = {
    root: '/repo',
    exists: (target: string) => {
      if (target === path.join('/repo', CANA_SOURCE_ENTRY)) return sourceExists;
      if (target === path.join('/repo', CANA_DIST_FILE)) return distExists;
      return false;
    },
    spawn: (command: string, args: string[]) => {
      spawnCalls.push({ command, args: args.map(String) });
      return { status: buildStatus };
    },
    readFile: () => distContents,
    writeFile: (target: string, contents: string) => { written.push({ target, contents }); },
    logger: {
      log: (line: string) => logs.push(String(line)),
      error: (line: string) => errors.push(String(line))
    }
  };
  return {
    harness, logs, errors, written, spawnCalls
  };
}

describe('sync-service-management-cana-bundle (JUM-484)', () => {
  it('pins the source, dist and vendored paths', () => {
    expect.hasAssertions();
    expect(CANA_SOURCE_ENTRY).toBe(path.join('packages', 'cana', 'src', 'adapter.ts'));
    expect(CANA_DIST_FILE).toBe(path.join('packages', 'cana', 'dist', 'service-management-cana.mjs'));
    expect(VENDORED_FILE).toBe(path.join('apps', 'service-management', 'vendor', 'cana', 'index.js'));
    expect(REQUIRED_BINDING).toBe('createCanaDatabaseClient');
    expect(VENDORED_HEADER).toContain('do not edit');
  });

  it('fails closed when the Cana source entry is missing', () => {
    expect.hasAssertions();
    const { harness, errors, written } = createHarness({ sourceExists: false });
    expect(syncServiceManagementCanaBundle(harness)).toBe(1);
    expect(errors.join('\n')).toContain('source entry not found');
    expect(written).toStrictEqual([]);
  });

  it('fails closed when the bun build fails, writing nothing', () => {
    expect.hasAssertions();
    const {
      harness, errors, written, spawnCalls
    } = createHarness({ buildStatus: 2 });
    expect(syncServiceManagementCanaBundle(harness)).toBe(2);
    expect(errors.join('\n')).toContain('bun build failed');
    expect(written).toStrictEqual([]);
    expect(spawnCalls).toHaveLength(1);
  });

  it('fails closed when the build reports success but the dist file is missing', () => {
    expect.hasAssertions();
    const { harness, errors, written } = createHarness({ distExists: false });
    expect(syncServiceManagementCanaBundle(harness)).toBe(1);
    expect(errors.join('\n')).toContain('is missing');
    expect(written).toStrictEqual([]);
  });

  it('fails closed when the built artifact does not define the required binding', () => {
    expect.hasAssertions();
    const { harness, errors, written } = createHarness({
      distContents: 'export { createCanaDatabaseClient2 as createCanaDatabaseClient };\n'
    });
    expect(syncServiceManagementCanaBundle(harness)).toBe(1);
    expect(errors.join('\n')).toContain('is not defined in the built artifact');
    expect(written).toStrictEqual([]);
  });

  it('builds the browser ESM artifact and vendors it with the generated-file header', () => {
    expect.hasAssertions();
    const {
      harness, logs, written, spawnCalls
    } = createHarness();
    expect(syncServiceManagementCanaBundle(harness)).toBe(0);

    expect(spawnCalls).toHaveLength(1);
    const { args } = spawnCalls[0];
    expect(args[0]).toBe('build');
    expect(args).toContain(path.join('/repo', CANA_SOURCE_ENTRY));
    expect(args).toContain('--outfile');
    expect(args).toContain(path.join('/repo', CANA_DIST_FILE));
    expect(args).toContain('--format');
    expect(args).toContain('esm');
    expect(args).toContain('--target');
    expect(args).toContain('browser');

    expect(written).toHaveLength(1);
    expect(written[0].target).toBe(path.join('/repo', VENDORED_FILE));
    expect(written[0].contents).toContain(VENDORED_HEADER);
    expect(written[0].contents).toContain('function createCanaDatabaseClient');
    expect(logs.join('\n')).toContain('cana bundle synced');
  });
});
