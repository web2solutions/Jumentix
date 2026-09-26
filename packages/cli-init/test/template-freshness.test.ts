/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-var-requires, jest/require-hook, jest/no-conditional-in-test */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const {
  DEFAULT_EXCLUSIONS,
  buildTemplates,
  collectExpectedFiles,
  isExcluded,
  matchGlob,
  resolveSourceCommit,
  run: runBuildTemplates,
  stripExcludedFromTree
} = require('../scripts/build-templates');
const {
  run: runFreshnessCheck,
  validateTemplateFreshness
} = require('../scripts/check-template-freshness');

function writeFile(root: string, relative: string, contents: string) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, contents, 'utf8');
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jum845-templates-'));
  writeFile(root, 'apps/backend-template/package.json', '{"name":"backend-seed"}\n');
  writeFile(root, 'apps/backend-template/src/index.ts', 'export const backend = 1;\n');
  writeFile(root, 'apps/backend-template/OASdoc/index.html', '<html>skip</html>\n');
  writeFile(root, 'apps/backend-template/seed/accounts-api-large.json', '{"heavy":true}\n');
  writeFile(root, 'apps/frontend/package.json', '{"name":"frontend-seed"}\n');
  writeFile(root, 'apps/frontend/src/main.ts', 'export const frontend = 1;\n');
  writeFile(root, 'apps/frontend/node_modules/left-pad/index.js', 'module.exports = 1;\n');
  writeFile(root, 'apps/frontend/cypress/videos/run.mp4', 'fake-video\n');
  writeFile(root, 'apps/frontend/template/leftover.ts', 'export {}\n');
  return root;
}

/**
 * Jest can drive the scripts' `require.main?.filename === __filename` entry
 * guard: `require.main` is the shared main-module object and the registry
 * mocks exist. bun:test provides neither (no isolateModules/doMock, and
 * worker-isolated runs have no main module), so there the honest assertion is
 * the guard's negative half: requiring the script must not execute the entry
 * body. The same suite file runs under both runners (jest for coverage,
 * bun:test in the quality gate).
 */
function entryPointDrivableWithJest(): boolean {
  return typeof jest !== 'undefined'
    && typeof (jest as any).isolateModules === 'function'
    && typeof (jest as any).doMock === 'function';
}

function requireFresh(scriptPath: string): void {
  const cache = (require as any).cache as Record<string, unknown> | undefined;
  if (cache && Object.prototype.hasOwnProperty.call(cache, scriptPath)) {
    delete cache[scriptPath];
  }
  require(scriptPath);
}

/**
 * The guard's negative half, asserted under bun:test: requiring the script
 * must not execute the entry body, so no exit code is set.
 */
function expectRequireOnlyLoads(scriptPath: string): void {
  const previousExitCode = process.exitCode;
  requireFresh(scriptPath);
  expect(process.exitCode ?? previousExitCode).toBe(previousExitCode);
}

describe('template packaging exclusions (JUM-845)', () => {
  it('matches OASdoc and Cypress video exclusion globs', () => {
    expect.hasAssertions();
    expect(matchGlob('**/OASdoc/**', 'OASdoc/index.html')).toBe(true);
    expect(matchGlob('**/cypress/videos/**', 'cypress/videos/run.mp4')).toBe(true);
    expect(matchGlob('**/seed/*-large.json', 'seed/accounts-api-large.json')).toBe(true);
    expect(isExcluded('src/index.ts', DEFAULT_EXCLUSIONS)).toBe(false);
    expect(isExcluded('OASdoc/index.html', DEFAULT_EXCLUSIONS)).toBe(true);
  });

  it('excludes node_modules and frontend template leftovers', () => {
    expect.hasAssertions();
    expect(isExcluded('node_modules/left-pad/index.js', DEFAULT_EXCLUSIONS)).toBe(true);
    expect(isExcluded('template/leftover.ts', DEFAULT_EXCLUSIONS)).toBe(true);
  });
});

describe('template freshness gate (JUM-845)', () => {
  it('passes after a clean build against the fixture seeds', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      const built = buildTemplates(root, { sourceCommit: 'fixture-commit' });
      expect(built.fileCount).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(root, 'packages/cli-init/templates/backend/package.json'))).toBe(true);
      expect(fs.existsSync(path.join(root, 'packages/cli-init/templates/backend/OASdoc/index.html'))).toBe(false);
      expect(
        validateTemplateFreshness(root, { sourceCommit: 'fixture-commit' })
      ).toStrictEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('omits node_modules and Cypress videos from the packaged tree', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      buildTemplates(root, { sourceCommit: 'fixture-commit' });
      expect(
        fs.existsSync(path.join(root, 'packages/cli-init/templates/frontend/node_modules/left-pad/index.js'))
      ).toBe(false);
      expect(
        fs.existsSync(path.join(root, 'packages/cli-init/templates/frontend/cypress/videos/run.mp4'))
      ).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when a packaged template drifts from the seed (red path)', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      buildTemplates(root, { sourceCommit: 'fixture-commit' });

      const drifted = path.join(
        root,
        'packages/cli-init/templates/backend/src/index.ts'
      );
      fs.writeFileSync(drifted, 'export const backend = "stale";\n', 'utf8');

      const failures = validateTemplateFreshness(root, { sourceCommit: 'fixture-commit' });
      const joined = failures.join('\n');

      expect(failures.length).toBeGreaterThan(0);
      expect(joined).toContain('hash drift');
      expect(joined).toContain('backend/src/index.ts');
      expect(joined).toContain('bun run cli:build-templates');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports malformed manifests without echoing their contents', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      buildTemplates(root, { sourceCommit: 'fixture-commit' });
      fs.writeFileSync(
        path.join(root, 'packages/cli-init/templates.manifest.json'),
        '{"token":"must-not-be-logged"',
        'utf8'
      );

      const failures = validateTemplateFreshness(root, { sourceCommit: 'fixture-commit' });
      expect(failures).toContain('[cli-init template-freshness] unreadable templates.manifest.json');
      expect(failures.join('\n')).not.toContain('must-not-be-logged');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when a seed is missing', () => {
    expect.hasAssertions();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jum845-templates-'));
    try {
      writeFile(root, 'apps/backend-template/package.json', '{"name":"backend-seed"}\n');

      const failures = validateTemplateFreshness(root);
      expect(failures).toStrictEqual([
        '[cli-init template-freshness] missing seed: apps/frontend'
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports a seed-walk error without a stack trace', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      // A dangling symlink passes the walk (it is a directory entry) but
      // fails the hash read — the failure line carries the error message.
      fs.symlinkSync(
        path.join(root, 'apps/backend-template/no-such-target'),
        path.join(root, 'apps/backend-template/src/dangling.ts')
      );

      const failures = validateTemplateFreshness(root, { sourceCommit: 'fixture-commit' });
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain('[cli-init template-freshness]');
      expect(failures[0]).toContain('ENOENT');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('ignores excluded files that appear inside the packaged tree', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      buildTemplates(root, { sourceCommit: 'fixture-commit' });
      // A tool (or the OS) dropped an excluded file into the packaged tree;
      // the freshness read must skip it instead of flagging it as unexpected.
      writeFile(root, 'packages/cli-init/templates/backend/.DS_Store', 'junk');

      expect(validateTemplateFreshness(root, { sourceCommit: 'fixture-commit' })).toStrictEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports packaged files missing after the build', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      buildTemplates(root, { sourceCommit: 'fixture-commit' });
      fs.rmSync(path.join(root, 'packages/cli-init/templates/backend/src/index.ts'));

      const failures = validateTemplateFreshness(root, { sourceCommit: 'fixture-commit' });
      expect(failures).toStrictEqual([
        '[cli-init template-freshness] missing packaged file: templates/backend/src/index.ts'
        + ' — run `bun run cli:build-templates`'
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports packaged files the seeds do not produce', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      buildTemplates(root, { sourceCommit: 'fixture-commit' });
      writeFile(root, 'packages/cli-init/templates/backend/extra.txt', 'stray');

      const failures = validateTemplateFreshness(root, { sourceCommit: 'fixture-commit' });
      expect(failures).toStrictEqual([
        '[cli-init template-freshness] unexpected packaged file: templates/backend/extra.txt'
        + ' — run `bun run cli:build-templates`'
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports a missing manifest', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      buildTemplates(root, { sourceCommit: 'fixture-commit' });
      fs.rmSync(path.join(root, 'packages/cli-init/templates.manifest.json'));

      const failures = validateTemplateFreshness(root, { sourceCommit: 'fixture-commit' });
      expect(failures).toStrictEqual([
        '[cli-init template-freshness] missing packages/cli-init/templates.manifest.json'
        + ' — run `bun run cli:build-templates`'
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports a manifest without a files map', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      buildTemplates(root, { sourceCommit: 'fixture-commit' });
      writeFile(root, 'packages/cli-init/templates.manifest.json', '{"schemaVersion":1}');

      const failures = validateTemplateFreshness(root, { sourceCommit: 'fixture-commit' });
      expect(failures).toStrictEqual([
        '[cli-init template-freshness] templates.manifest.json missing files map'
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports manifest entries the build no longer produces', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      buildTemplates(root, { sourceCommit: 'fixture-commit' });
      const manifestPath = path.join(root, 'packages/cli-init/templates.manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      delete manifest.files['backend/src/index.ts'];
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

      const failures = validateTemplateFreshness(root, { sourceCommit: 'fixture-commit' });
      expect(failures).toStrictEqual([
        '[cli-init template-freshness] manifest missing entry: backend/src/index.ts'
        + ' — run `bun run cli:build-templates`'
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports manifest hashes that drift from the seeds', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      buildTemplates(root, { sourceCommit: 'fixture-commit' });
      const manifestPath = path.join(root, 'packages/cli-init/templates.manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest.files['backend/src/index.ts'].sha256 = '0'.repeat(64);
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

      const failures = validateTemplateFreshness(root, { sourceCommit: 'fixture-commit' });
      expect(failures).toStrictEqual([
        '[cli-init template-freshness] manifest hash drift: backend/src/index.ts'
        + ' — run `bun run cli:build-templates`'
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports @jumentix/* version drift so generated pins stay publishable (JUM-902)', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      writeFile(root, 'packages/cana/package.json', '{"name":"@jumentix/cana","version":"0.1.0"}\n');
      writeFile(root, 'packages/secret/package.json', '{"name":"@jumentix/secret","version":"1.0.0","private":true}\n');
      buildTemplates(root, { sourceCommit: 'fixture-commit' });
      const manifestPath = path.join(root, 'packages/cli-init/templates.manifest.json');

      expect(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).packageVersions).toStrictEqual({ '@jumentix/cana': '0.1.0' });

      writeFile(root, 'packages/cana/package.json', '{"name":"@jumentix/cana","version":"0.2.0"}\n');

      expect(validateTemplateFreshness(root, { sourceCommit: 'fixture-commit' })).toStrictEqual([
        '[cli-init template-freshness] package version drift: @jumentix/cana (manifest 0.1.0, source 0.2.0)'
        + ' — run `bun run cli:build-templates`'
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports stale manifest entries', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    try {
      buildTemplates(root, { sourceCommit: 'fixture-commit' });
      const manifestPath = path.join(root, 'packages/cli-init/templates.manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest.files['backend/stale.txt'] = { sha256: 'x', source: 'stale' };
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

      const failures = validateTemplateFreshness(root, { sourceCommit: 'fixture-commit' });
      expect(failures).toStrictEqual([
        '[cli-init template-freshness] manifest has stale entry: backend/stale.txt'
        + ' — run `bun run cli:build-templates`'
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('prints the pass line and exits 0 on green, exits 1 with the failures on drift', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      buildTemplates(root, { sourceCommit: 'fixture-commit' });
      expect(runFreshnessCheck(root, { sourceCommit: 'fixture-commit' })).toBe(0);
      expect(logSpy.mock.calls.flat().join('\n'))
        .toContain('CLI template freshness check passed');

      writeFile(root, 'packages/cli-init/templates/backend/extra.txt', 'stray');
      expect(runFreshnessCheck(root, { sourceCommit: 'fixture-commit' })).toBe(1);
      expect(errorSpy.mock.calls.flat().join('\n')).toContain('unexpected packaged file');
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs the freshness check from the entry point and sets an exit code', () => {
    expect.hasAssertions();
    const scriptPath = require.resolve('../scripts/check-template-freshness');
    if (!entryPointDrivableWithJest()) {
      // bun:test: no registry mocks and no main module on worker-isolated
      // runs — assert the guard's negative half instead.
      expectRequireOnlyLoads(scriptPath);
      return;
    }
    const mainModule = (require as any).main;
    const originalFilename = mainModule.filename;
    const previousExitCode = process.exitCode;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // The committed templates are the "actual" side; an empty expectation
      // makes every one of them an unexpected file, so the check fails closed
      // (exit 1) without touching the seeds. `require.main.filename` is
      // writable and shared with every required module, so swapping it makes
      // the script's entry-point guard see this file as the entry.
      mainModule.filename = scriptPath;
      jest.isolateModules(() => {
        jest.doMock('../scripts/build-templates', () => {
          const actual = jest.requireActual('../scripts/build-templates');
          return { ...actual, collectExpectedFiles: () => new Map() };
        });
        require('../scripts/check-template-freshness');
      });
    } finally {
      mainModule.filename = originalFilename;
      jest.dontMock('../scripts/build-templates');
      errorSpy.mockRestore();
    }
    expect([0, 1]).toContain(process.exitCode);
    process.exitCode = previousExitCode;
  });

  it('fails closed from the entry point when the check itself throws', () => {
    expect.hasAssertions();
    const scriptPath = require.resolve('../scripts/check-template-freshness');
    if (!entryPointDrivableWithJest()) {
      // bun:test: no registry mocks and no main module on worker-isolated
      // runs — assert the guard's negative half instead.
      expectRequireOnlyLoads(scriptPath);
      return;
    }
    const mainModule = (require as any).main;
    const originalFilename = mainModule.filename;
    const previousExitCode = process.exitCode;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mainModule.filename = scriptPath;
      jest.isolateModules(() => {
        jest.doMock('../scripts/build-templates', () => {
          const actual = jest.requireActual('../scripts/build-templates');
          return {
            ...actual,
            collectExpectedFiles: () => new Map(),
            buildManifest: () => {
              throw new Error('manifest-boom');
            }
          };
        });
        require('../scripts/check-template-freshness');
      });
    } finally {
      mainModule.filename = originalFilename;
      jest.dontMock('../scripts/build-templates');
      errorSpy.mockRestore();
    }
    expect(process.exitCode).toBe(1);
    process.exitCode = previousExitCode;
  });
});

describe('template build script edges (JUM-845)', () => {
  it('resolves the source commit from git, falling back to unknown', () => {
    expect.hasAssertions();
    const { REPO_ROOT } = require('../scripts/build-templates');
    expect(resolveSourceCommit(REPO_ROOT)).toMatch(/^[0-9a-f]{40}$/);
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'jum845-no-git-'));
    try {
      expect(resolveSourceCommit(bare)).toBe('unknown');
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });

  it('throws from collectExpectedFiles when a seed is missing', () => {
    expect.hasAssertions();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jum845-templates-'));
    try {
      writeFile(root, 'apps/backend-template/package.json', '{"name":"backend-seed"}\n');
      expect(() => collectExpectedFiles(root)).toThrow('missing seed: apps/frontend');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('strips excluded files back out of a packaged tree', () => {
    expect.hasAssertions();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jum845-templates-'));
    try {
      const templatesDir = path.join(root, 'templates');
      writeFile(root, 'templates/backend/package.json', '{"name":"backend-seed"}\n');
      writeFile(root, 'templates/backend/.DS_Store', 'junk');
      writeFile(root, 'templates/frontend/coverage/lcov.info', 'junk');

      stripExcludedFromTree(templatesDir);

      expect(fs.existsSync(path.join(templatesDir, 'backend/package.json'))).toBe(true);
      expect(fs.existsSync(path.join(templatesDir, 'backend/.DS_Store'))).toBe(false);
      expect(fs.existsSync(path.join(templatesDir, 'frontend/coverage/lcov.info'))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('prints the build summary and exits 0 from the runner', () => {
    expect.hasAssertions();
    const root = fixtureRoot();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(runBuildTemplates(root)).toBe(0);
      const output = logSpy.mock.calls.flat().join('\n');
      expect(output).toContain('[cli-init templates] wrote');
      expect(output).toContain('templates.manifest.json');
    } finally {
      logSpy.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('builds from the entry point without touching the checkout (writes mocked)', () => {
    expect.hasAssertions();
    const scriptPath = require.resolve('../scripts/build-templates');
    if (!entryPointDrivableWithJest()) {
      // bun:test: no registry mocks and no main module on worker-isolated
      // runs — assert the guard's negative half instead.
      expectRequireOnlyLoads(scriptPath);
      return;
    }
    const mainModule = (require as any).main;
    const originalFilename = mainModule.filename;
    const previousExitCode = process.exitCode;
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      mainModule.filename = scriptPath;
      jest.isolateModules(() => {
        // The real seeds are hashed read-only; every write is captured so the
        // entry point exercises run() end to end without rewriting the
        // checkout's templates tree.
        jest.doMock('node:fs', () => {
          const actual = jest.requireActual('node:fs');
          return {
            ...actual,
            rmSync: jest.fn(),
            mkdirSync: jest.fn(),
            copyFileSync: jest.fn(),
            writeFileSync: jest.fn(),
            existsSync: (target: string) => (
              target.includes(`${path.sep}apps${path.sep}`)
                ? actual.existsSync(target)
                : false
            )
          };
        });
        require('../scripts/build-templates');
      });
    } finally {
      mainModule.filename = originalFilename;
      jest.dontMock('node:fs');
      logSpy.mockRestore();
    }
    expect(process.exitCode).toBe(0);
    process.exitCode = previousExitCode;
  });

  it('fails closed from the entry point when the build throws', () => {
    expect.hasAssertions();
    const scriptPath = require.resolve('../scripts/build-templates');
    if (!entryPointDrivableWithJest()) {
      // bun:test: no registry mocks and no main module on worker-isolated
      // runs — assert the guard's negative half instead.
      expectRequireOnlyLoads(scriptPath);
      return;
    }
    const mainModule = (require as any).main;
    const originalFilename = mainModule.filename;
    const previousExitCode = process.exitCode;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mainModule.filename = scriptPath;
      jest.isolateModules(() => {
        // No seed exists anywhere, so collectExpectedFiles throws and the
        // entry point must report the failure instead of crashing.
        jest.doMock('node:fs', () => {
          const actual = jest.requireActual('node:fs');
          return { ...actual, existsSync: () => false };
        });
        require('../scripts/build-templates');
      });
    } finally {
      mainModule.filename = originalFilename;
      jest.dontMock('node:fs');
      errorSpy.mockRestore();
    }
    expect(process.exitCode).toBe(1);
    process.exitCode = previousExitCode;
  });
});
