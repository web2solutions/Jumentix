/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'node:path';

const { launch, localCliReady, planLaunch } = require('../bin/launcher.js');

/**
 * JUM-901: `bun x github:web2solutions/Jumentix#dev` installs the repository
 * with no build output, and the root entry point required
 * `packages/cli-init/dist/cli` unconditionally:
 *
 *   Error: Cannot find module '../packages/cli-init/dist/cli'  (exit 1)
 *
 * The launcher now runs the local build only when it can actually load, and
 * otherwise delegates to the published package at the same version.
 */
const root = '/checkout/packages/cli-init';
const manifest = {
  name: '@jumentix/cli-init',
  version: '0.1.0',
  dependencies: { '@jumentix/designer-core': '0.1.0', yaml: '^2.5.1' }
};

describe('repository CLI launcher (JUM-901)', () => {
  it('delegates to the published package when the checkout has no dist (the shipped crash)', () => {
    expect.hasAssertions();

    const plan = planLaunch(['init', '--help'], root, { manifest, exists: () => false });

    expect(plan).toStrictEqual({
      kind: 'published',
      spec: '@jumentix/cli-init@0.1.0',
      command: 'npx',
      args: ['--yes', '--package=@jumentix/cli-init@0.1.0', 'jumentix', 'init', '--help']
    });
  });

  it('delegates when dist exists but a runtime dependency is unbuilt', () => {
    expect.hasAssertions();
    const resolve = () => {
      throw new Error('Cannot find module \'@jumentix/designer-core\'');
    };

    expect(localCliReady(root, { manifest, exists: () => true, resolve })).toBe(false);
  });

  it('runs the local build when it and its dependencies resolve', () => {
    expect.hasAssertions();

    const plan = planLaunch([], root, {
      manifest, exists: () => true, resolve: (id: string) => id
    });

    expect(plan).toStrictEqual({ kind: 'local', cliPath: path.join(root, 'dist', 'cli.js') });
  });

  it('forwards the delegated exit code', async () => {
    expect.hasAssertions();
    const previous = process.exitCode;
    const calls: unknown[][] = [];
    const spawn = (...args: unknown[]) => {
      calls.push(args);
      return { status: 3 };
    };
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await launch(['doctor'], { manifest, exists: () => false, spawn });

      expect(process.exitCode).toBe(3);
      expect(calls[0][1]).toStrictEqual([
        '--yes', '--package=@jumentix/cli-init@0.1.0', 'jumentix', 'doctor'
      ]);
    } finally {
      errorSpy.mockRestore();
      process.exitCode = previous;
    }
  });

  it('fails with exit 2 when npx cannot start', async () => {
    expect.hasAssertions();
    const previous = process.exitCode;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await launch([], { manifest, exists: () => false, spawn: () => ({ error: new Error('ENOENT') }) });

      expect(process.exitCode).toBe(2);
    } finally {
      errorSpy.mockRestore();
      process.exitCode = previous;
    }
  });

  it('exposes a bin named after the package so `npx @jumentix/cli-init` resolves', () => {
    expect.hasAssertions();
    const pkg = JSON.parse(require('node:fs').readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

    // npx runs the bin whose name equals the unscoped package name when a
    // package declares several; without it `npx @jumentix/cli-init init` fails.
    expect(pkg.bin['cli-init']).toBe(pkg.bin.jumentix);
  });
});
