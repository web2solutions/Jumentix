/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Unit suite for the level-parallel topological workspace build (JUM-871) —
 * the replacement for `bun run --filter './packages/*' build`, whose parallel
 * scheduling let a dependent package's `tsc` race its workspace
 * dependencies' `dist` emission (intermittent TS2307).
 *
 * Discovery, graph and levels are pure functions over injectable inputs; the
 * runner takes an injectable spawn so the suite records the exact build
 * order on synthetic fixtures — parallel within a level, sequential across
 * levels, fail closed on cycle or build failure.
 */

const {
  buildWorkspacePackages,
  computeBuildLevels,
  discoverWorkspacePackages,
  findCycle,
  main,
  runAsEntryPoint,
  spawnPackageBuild
} = require('../build-workspace-packages');

type CloseCallback = (exitCode: number) => void;

type FakePackage = {
  name: string;
  dir: string;
  dependencies: string[];
};

function pkg(name: string, dependencies: string[] = []): FakePackage {
  return { name, dir: path.join('/workspace/packages', name), dependencies };
}

function silentLogger() {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    logger: {
      log: (line: string) => logs.push(String(line)),
      error: (line: string) => errors.push(String(line))
    },
    logs,
    errors
  };
}

/** Fire the close callback a deferred spawn registered for `name`. */
function finishBuild(
  resolvers: Map<string, CloseCallback>,
  name: string,
  exitCode: number
): void {
  const close = resolvers.get(name);
  if (!close) throw new Error(`no deferred spawn recorded for ${name}`);
  close(exitCode);
}

/** A deferred spawn: records starts, close callbacks fired by the test. */
function deferredSpawn(order: string[], resolvers: Map<string, CloseCallback>) {
  return (_command: string, _args: string[], options: { cwd: string }) => {
    const name = path.basename(options.cwd);
    order.push(`start:${name}`);
    return {
      on: (event: string, callback: (code: number) => void) => {
        if (event === 'close') resolvers.set(name, callback);
      }
    };
  };
}

const tick = () => new Promise((resolve) => {
  setImmediate(resolve);
});

describe('build-workspace-packages (JUM-871)', () => {
  it('groups packages into topological levels', () => {
    expect.hasAssertions();
    const packages = new Map([
      ['app', pkg('app', ['lib'])],
      ['lib', pkg('lib', ['core'])],
      ['web', pkg('web', ['core'])],
      ['core', pkg('core', [])]
    ]);

    expect(computeBuildLevels(packages)).toStrictEqual([
      ['core'],
      ['lib', 'web'],
      ['app']
    ]);
  });

  it('ignores dependencies on packages outside the workspace', () => {
    expect.hasAssertions();
    const packages = new Map([
      ['app', pkg('app', ['core', 'vue', '@jumentix/not-a-package'])],
      ['core', pkg('core', [])]
    ]);

    // vue and the phantom workspace name install from the registry; they are
    // not build-ordering edges.
    expect(computeBuildLevels(packages)).toStrictEqual([['core'], ['app']]);
  });

  it('discovers packages with a build script and skips the rest', () => {
    expect.hasAssertions();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jum871-discovery-'));
    try {
      const writeManifest = (name: string, manifest: unknown) => {
        const dir = path.join(root, 'packages', name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(manifest), 'utf8');
      };
      writeManifest('with-build', {
        name: 'with-build',
        scripts: { build: 'tsc' },
        dependencies: { external: '^1.0.0' },
        peerDependencies: { peer: '^2.0.0' },
        devDependencies: { 'dev-dep': '^3.0.0' }
      });
      writeManifest('no-build', { name: 'no-build' });
      // 'broken' has no package.json at all; 'stray' is not a directory.
      fs.writeFileSync(path.join(root, 'packages', 'stray.txt'), 'not a package');

      const packages = discoverWorkspacePackages({ root });
      expect([...packages.keys()]).toStrictEqual(['with-build']);
      expect(packages.get('with-build').dir).toBe(path.join(root, 'packages', 'with-build'));
      // All three dependency fields are recorded; external filtering happens
      // at graph time.
      expect(packages.get('with-build').dependencies).toStrictEqual(
        ['external', 'peer', 'dev-dep']
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('ignores an unreadable package manifest while discovering buildable packages', () => {
    expect.hasAssertions();
    const entries = [
      { name: 'broken', isDirectory: () => true },
      { name: 'working', isDirectory: () => true }
    ];
    const packages = discoverWorkspacePackages({
      packagesDir: '/workspace/packages',
      readdir: () => entries,
      readFile: jest.fn()
        .mockImplementationOnce(() => { throw new Error('unreadable manifest'); })
        .mockReturnValueOnce(JSON.stringify({ name: 'working', scripts: { build: 'bun build' } }))
    });

    expect([...packages.keys()]).toStrictEqual(['working']);
  });

  it('fails closed on a dependency cycle, naming the packages on it', async () => {
    expect.hasAssertions();
    const packages = new Map([
      ['a', pkg('a', ['b'])],
      ['b', pkg('b', ['a'])]
    ]);
    const { logger, errors } = silentLogger();

    await expect(
      buildWorkspacePackages({ packages, spawn: jest.fn(), logger })
    ).rejects.toThrow(/cycle/i);
    expect(() => computeBuildLevels(packages)).toThrow('a');
    expect(errors).toStrictEqual([]);
  });

  it('reports no cycle when all candidate dependencies are acyclic', () => {
    expect.hasAssertions();
    const packages = new Map([
      ['app', pkg('app', ['lib'])],
      ['lib', pkg('lib', [])]
    ]);

    expect(findCycle(packages, new Set(['app', 'lib']))).toBeNull();
  });

  it('builds a level in parallel and levels in sequence', async () => {
    expect.hasAssertions();
    const packages = new Map([
      ['app', pkg('app', ['lib'])],
      ['lib', pkg('lib', [])],
      ['web', pkg('web', [])]
    ]);
    const order: string[] = [];
    const resolvers = new Map<string, CloseCallback>();
    const { logger } = silentLogger();

    const run = buildWorkspacePackages({
      packages,
      spawn: deferredSpawn(order, resolvers),
      logger
    });
    await tick();
    await tick();
    // Level 1 (lib, web) both started before either finished — parallel.
    expect(order).toStrictEqual(['start:lib', 'start:web']);

    finishBuild(resolvers, 'lib', 0);
    await tick();
    await tick();
    // app waits for the WHOLE previous level, not just its own dependency.
    expect(order).toStrictEqual(['start:lib', 'start:web']);

    finishBuild(resolvers, 'web', 0);
    await tick();
    await tick();
    expect(order).toStrictEqual(['start:lib', 'start:web', 'start:app']);

    finishBuild(resolvers, 'app', 0);
    await expect(run).resolves.toBe(0);
  });

  it('aborts remaining levels on the first failure and names the package', async () => {
    expect.hasAssertions();
    const packages = new Map([
      ['late', pkg('late', ['bad'])],
      ['bad', pkg('bad', ['ok'])],
      ['ok', pkg('ok', [])]
    ]);
    const order: string[] = [];
    const resolvers = new Map<string, CloseCallback>();
    const { logger, errors } = silentLogger();

    const run = buildWorkspacePackages({
      packages,
      spawn: deferredSpawn(order, resolvers),
      logger
    });
    await tick();
    await tick();
    expect(order).toStrictEqual(['start:ok']);

    finishBuild(resolvers, 'ok', 0);
    await tick();
    await tick();
    expect(order).toStrictEqual(['start:ok', 'start:bad']);

    finishBuild(resolvers, 'bad', 2);
    await expect(run).resolves.toBe(1);

    // The dependent level never starts, and the failure names its package.
    expect(order).toStrictEqual(['start:ok', 'start:bad']);
    expect(errors.join('\n')).toContain('bad build failed with exit code 2');
  });

  it('reports the levels it is about to build', async () => {
    expect.hasAssertions();
    const packages = new Map([
      ['app', pkg('app', ['core'])],
      ['core', pkg('core', [])]
    ]);
    const order: string[] = [];
    const resolvers = new Map<string, CloseCallback>();
    const { logger, logs } = silentLogger();

    const run = buildWorkspacePackages({
      packages,
      spawn: deferredSpawn(order, resolvers),
      logger
    });
    await tick();
    finishBuild(resolvers, 'core', 0);
    await tick();
    finishBuild(resolvers, 'app', 0);
    await expect(run).resolves.toBe(0);

    expect(logs.join('\n')).toContain('[build] level 1/2: core');
    expect(logs.join('\n')).toContain('[build] level 2/2: app');
  });

  it('fails closed when no buildable workspace package exists', async () => {
    expect.hasAssertions();
    const { logger, errors } = silentLogger();
    await expect(
      buildWorkspacePackages({ packages: new Map(), spawn: jest.fn(), logger })
    ).resolves.toBe(1);
    expect(errors.join('\n')).toContain('no workspace packages');
  });

  it('fails closed when a package build process cannot start or has no exit code', async () => {
    expect.hasAssertions();
    const target = pkg('worker');
    const spawnError = () => ({
      on: jest.fn()
        .mockImplementationOnce((_event: string, callback: (error: Error) => void) => callback(new Error('spawn failed')))
        .mockReturnValueOnce(undefined)
    });
    const spawnCloseWithoutCode = () => ({
      on: jest.fn()
        .mockReturnValueOnce(undefined)
        .mockImplementationOnce((_event: string, callback: (code: null) => void) => callback(null))
    });

    await expect(spawnPackageBuild(target, {
      spawn: spawnError
    })).resolves.toBe(1);
    await expect(spawnPackageBuild(target, {
      spawn: spawnCloseWithoutCode
    })).resolves.toBe(1);
  });

  it('reports rejected builds and binds the CLI dispatcher to the resulting status', async () => {
    expect.hasAssertions();
    const errors: string[] = [];
    await expect(main({
      execute: () => Promise.reject(new Error('broken build')),
      logger: { error: (line: string) => errors.push(line) }
    })).resolves.toBe(1);
    expect(errors.join('\n')).toContain('broken build');

    const entry = { id: 'entry' };
    const exits: number[] = [];
    expect(runAsEntryPoint({
      caller: entry,
      entry,
      exit: (code: number) => exits.push(code),
      runMain: () => Promise.resolve(0)
    })).toBe(true);
    await tick();
    expect(exits).toStrictEqual([0]);

    const previousExitCode = process.exitCode;
    try {
      expect(runAsEntryPoint({
        caller: entry,
        entry,
        runMain: () => Promise.resolve(0)
      })).toBe(true);
      await tick();
      expect(process.exitCode).toBe(0);
    } finally {
      process.exitCode = previousExitCode;
    }
  });
});
