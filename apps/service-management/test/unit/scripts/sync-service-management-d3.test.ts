/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import path from 'node:path';

/**
 * Unit suite for the SM d3 sync script — vendors the D3 ESM build into the
 * zero-build Service Management SPA so the import map's `./vendor/d3/index.js`
 * specifier resolves without a CDN.
 *
 * Everything external is injected (spawn, fs, logger, require resolution):
 * the suite asserts the script's fail-closed behaviour and its happy-path
 * copy, not bun's bundler.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  VENDORED_FILE,
  syncServiceManagementD3
} = require(path.join(repoRoot, 'apps/service-management/scripts/sync-service-management-d3.js'));

const DIST_FILE = path.join('apps', 'service-management', 'vendor', 'd3', '.build.mjs');

function createHarness(options: {
  sourceEntry?: string | null;
  buildStatus?: number | null;
  distExists?: boolean;
  artifact?: string;
} = {}) {
  const {
    sourceEntry = '/repo/node_modules/d3/src/index.js',
    buildStatus = 0,
    distExists = true,
    artifact = 'export { scaleLinear }\n'
  } = options;
  const logs: string[] = [];
  const errors: string[] = [];
  const written: Array<{ target: string; contents: string }> = [];
  const spawnCalls: Array<{ command: string; args: string[] }> = [];
  const harness = {
    root: '/repo',
    sourceEntry,
    exists: (target: string) => {
      if (sourceEntry && target === sourceEntry) return true;
      if (target === path.join('/repo', DIST_FILE)) return distExists;
      return false;
    },
    spawn: (command: string, args: string[]) => {
      spawnCalls.push({ command, args: args.map(String) });
      return { status: buildStatus };
    },
    readFile: () => artifact,
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

describe('sync-service-management-d3', () => {
  it('pins the vendored d3 path', () => {
    expect.hasAssertions();
    expect(VENDORED_FILE).toBe(path.join('apps', 'service-management', 'vendor', 'd3', 'index.js'));
  });

  it('fails closed when no d3 entry resolves under the root', () => {
    expect.hasAssertions();
    const { harness, errors, written } = createHarness({ sourceEntry: null });
    // exists() denies every candidate, so resolveD3Entry falls through its
    // require.resolve attempts against the nonexistent /repo root and the
    // script reports the missing entry.
    expect(syncServiceManagementD3(harness)).toBe(1);
    expect(errors.join('\n')).toContain('d3 package entry not found');
    expect(written).toStrictEqual([]);
  });

  it('fails closed when the bun build exits non-zero', () => {
    expect.hasAssertions();
    const { harness, errors, written } = createHarness({ buildStatus: 2 });
    expect(syncServiceManagementD3(harness)).toBe(2);
    expect(errors.join('\n')).toContain('bun build failed with status 2');
    expect(written).toStrictEqual([]);
  });

  it('fails closed when the build errored before producing a status', () => {
    expect.hasAssertions();
    const { harness, errors } = createHarness({ buildStatus: null });
    expect(syncServiceManagementD3(harness)).toBe(1);
    expect(errors.join('\n')).toContain('bun build failed');
  });

  it('fails closed when the build reports success but the dist file is missing', () => {
    expect.hasAssertions();
    const { harness, errors, written } = createHarness({ distExists: false });
    expect(syncServiceManagementD3(harness)).toBe(1);
    expect(errors.join('\n')).toContain('is missing');
    expect(written).toStrictEqual([]);
  });

  it('fails closed when the artifact carries no d3 scale export at all', () => {
    expect.hasAssertions();
    const { harness, errors, written } = createHarness({ artifact: 'export const nothing = 1;\n' });
    expect(syncServiceManagementD3(harness)).toBe(1);
    expect(errors.join('\n')).toContain('missing expected d3 scale exports');
    expect(written).toStrictEqual([]);
  });

  it('accepts an artifact that carries the generic scale export and vendors it', () => {
    expect.hasAssertions();
    const {
      harness, logs, written, spawnCalls
    } = createHarness({
      artifact: 'export function scale() {}\n'
    });
    expect(syncServiceManagementD3(harness)).toBe(0);
    expect(spawnCalls).toHaveLength(1);
    expect(written).toHaveLength(1);
    expect(written[0].target).toBe(path.join('/repo', VENDORED_FILE));
    expect(written[0].contents).toContain('do not edit');
    expect(written[0].contents).toContain('export function scale');
    expect(logs.join('\n')).toContain('d3 synced');
  });

  it('defaults to the process working directory when called without options', () => {
    expect.hasAssertions();
    const repoRootDir = path.resolve(repoRoot);
    expect(process.cwd()).toBe(repoRootDir);
    // The default-argument path runs the real sync against the checkout: the
    // d3 package entry exists under node_modules, so this performs the same
    // bun build + vendor copy the CI script performs, targeted at the
    // gitignored vendor directory.
    expect(syncServiceManagementD3()).toBe(0);
    const fs = require('fs');
    const vendored = fs.readFileSync(path.join(repoRootDir, VENDORED_FILE), 'utf8');
    expect(vendored).toContain('do not edit');
    expect(vendored).toContain('scaleLinear');
  });
});
