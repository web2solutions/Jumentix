/* eslint-disable @typescript-eslint/no-var-requires, global-require, jest/max-expects */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { builtModuleList, ensureDesignerCoreBuilt } from './helpers/build-artifact';

/**
 * Packaging contract for `@jumentix/designer-core` (JUM-493), in the style of
 * the cana packaging suite (JUM-416) — the pattern this repo established for
 * publishable packages.
 *
 * The failure mode both suites exist to catch is the same: the workspace
 * resolves every first-party import straight to source, so the entire test
 * suite passes whether or not the published tarball would work for anyone
 * else. These assertions are the only thing standing between a correct build
 * and a package that installs and then cannot be imported — or that installs
 * and ships the DOM half of the designer.
 */

const packageRoot = path.resolve(__dirname, '..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
) as {
  name: string;
  version: string;
  type?: string;
  main: string;
  types: string;
  license: string;
  sideEffects: boolean;
  files: string[];
  exports: Record<string, unknown>;
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
  publishConfig?: { access?: string };
  repository?: { type?: string; url?: string; directory?: string };
  private?: boolean;
};

const exists = (relative: string): boolean => fs.existsSync(path.join(packageRoot, relative));

const readDist = (relative: string): string => fs.readFileSync(path.join(packageRoot, 'dist', relative), 'utf8');

/** Paths that must never appear in the published tarball. */
const isNonArtifactPath = (file: string): boolean => file.startsWith('src/')
  || file.startsWith('test/')
  || file.startsWith('scripts/')
  || file.endsWith('tsconfig.build.json');

const runtimeDependencies = Object.keys(manifest.dependencies ?? {});

/** Whether a script command publishes for real (anything but `--dry-run`). */
const isRealPublishCommand = (command: string): boolean => command.includes('publish')
  && !command.includes('--dry-run');

const listDistFiles = (): string[] => {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(path.join(packageRoot, 'dist'), full).replace(/\\/g, '/'));
    }
  };
  walk(path.join(packageRoot, 'dist'));
  return out.sort();
};

describe('designer-core packaging manifest', () => {
  it('is named and versioned as the public @jumentix package', () => {
    expect.hasAssertions();
    expect(manifest.name).toBe('@jumentix/designer-core');
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('points every entry point at built output, not at source', () => {
    expect.hasAssertions();
    // Publishing source produces a package that installs cleanly and then
    // fails at the first import for anyone not inside this workspace.
    expect(manifest.main).toBe('dist/index.js');
    expect(manifest.types).toBe('dist/index.d.ts');
  });

  it('never points an entry point into src or back into the app tree', () => {
    expect.hasAssertions();
    for (const entry of [manifest.main, manifest.types]) {
      expect(entry).not.toContain('src/');
      expect(entry).not.toContain('apps/');
    }
    expect(manifest.types).toMatch(/\.d\.ts$/);
    expect(manifest.main).toMatch(/\.js$/);
  });

  it('declares an exports map with types resolving first', () => {
    expect.hasAssertions();
    // Order matters in an exports map: a `types` condition after `default` is
    // never reached, and consumers silently lose the declarations.
    const root = manifest.exports['.'] as Record<string, string>;

    expect(Object.keys(root)[0]).toBe('types');
    expect(root.types).toBe('./dist/index.d.ts');
  });

  it('is browser-safe ESM end to end', () => {
    expect.hasAssertions();
    // The issue's scope line is "browser-safe ESM": the package is
    // `type: module`, the artifact is ESM, and no CommonJS entry pretends
    // otherwise.
    const root = manifest.exports['.'] as Record<string, string>;

    expect(manifest.type).toBe('module');
    expect(root.import).toBe('./dist/index.js');
    expect(root.default).toBe('./dist/index.js');
  });

  it('ships the built output, the READMEs and the licence', () => {
    expect.hasAssertions();
    expect(manifest.files).toContain('dist');
    expect(manifest.files).toContain('README.md');
    expect(manifest.files).toContain('README.pt-BR.md');
    expect(manifest.files).toContain('LICENSE.md');
  });

  it('does not ship source, build tooling or tests', () => {
    expect.hasAssertions();
    expect(manifest.files).not.toContain('src');
    expect(manifest.files).not.toContain('scripts');
    expect(manifest.files).not.toContain('test');
  });

  it('has the files it promises to publish', () => {
    expect.hasAssertions();
    // `files` naming something absent produces a tarball missing it, with no
    // warning at pack time.
    expect(exists('README.md')).toBe(true);
    expect(exists('README.pt-BR.md')).toBe(true);
    expect(exists('LICENSE.md')).toBe(true);
  });

  it('declares a licence that matches the file it ships', () => {
    expect.hasAssertions();
    const licence = fs.readFileSync(path.join(packageRoot, 'LICENSE.md'), 'utf8');

    expect(manifest.license).toBe('MIT');
    expect(licence).toContain('MIT');
  });

  it('carries provenance metadata pointing at the monorepo location', () => {
    expect.hasAssertions();
    expect(manifest.repository?.type).toBe('git');
    expect(manifest.repository?.url).toContain('github.com/XpertMinds/Jumentix');
    expect(manifest.repository?.directory).toBe('packages/designer-core');
  });

  it('has no runtime dependencies — and no Cana in particular', () => {
    expect.hasAssertions();
    // The issue is explicit: the core must not depend on Cana or on any
    // storage implementation. A dependency appearing here would mean one was
    // pulled in without the decision being made.
    expect(runtimeDependencies).toStrictEqual([]);
  });

  it('is marked side-effect free so bundlers can tree-shake it', () => {
    expect.hasAssertions();
    expect(manifest.sideEffects).toBe(false);
  });

  it('builds before publishing rather than trusting a stale dist', () => {
    expect.hasAssertions();
    // Without this a publish can ship whatever happened to be in `dist` from
    // an earlier, possibly different, commit.
    expect(manifest.scripts.prepublishOnly).toContain('build');
    expect(manifest.scripts.prepublishOnly).toContain('clean');
    expect(manifest.scripts.prepublishOnly).toContain('bun run');
  });

  it('builds through the pinned Bun toolchain, per Requirement 096', () => {
    expect.hasAssertions();
    expect(manifest.scripts.build).toContain('bun');
  });

  it('runs its own suites from its own test script', () => {
    expect.hasAssertions();
    // A `test` script that quietly typechecks, echoes, or defers elsewhere is
    // the JUM-557 false green: it passes while nothing runs. `--isolate` is
    // required because Bun shares one process across files otherwise (JUM-583).
    expect(manifest.scripts.test).toContain('bun test');
    expect(manifest.scripts.test).toContain('--isolate');
    expect(manifest.scripts.test).not.toContain('typecheck');
    expect(manifest.scripts.test).not.toContain('echo');
  });

  it('is publishable and public — but only ever through the dry-run surface', () => {
    expect.hasAssertions();
    expect(manifest.publishConfig?.access).toBe('public');
    expect(manifest.private).toBeUndefined();
    // Req 070: no automatic publish. No script in this manifest may publish
    // for real; the only publish verb allowed anywhere is a dry run.
    const realPublishScripts = Object.entries(manifest.scripts)
      .filter(([, command]) => isRealPublishCommand(command));
    expect(realPublishScripts).toStrictEqual([]);
  });

  it('keeps the barrel and the module tree in lockstep', () => {
    expect.hasAssertions();
    // The barrel is what consumers import; `src/` is what the build ships.
    // If they drift, the published entry stops naming part of the package —
    // or names a module that is not there.
    const barrel = fs.readFileSync(path.join(packageRoot, 'src', 'index.js'), 'utf8');
    const barrelModules = [...barrel.matchAll(/export \* from '\.\/([a-z]+\/[A-Za-z0-9]+\.js)'/g)]
      .map((match) => match[1]).sort();

    expect(barrelModules).toStrictEqual([...builtModuleList(packageRoot)].sort());
  });
});

describe('designer-core built output', () => {
  // Built here rather than assumed — a suite that branches on whether `dist`
  // exists reports green in a fresh clone where nothing was built. The build
  // is deterministic; the helper serializes the three suites that all need it.
  beforeAll(async () => {
    await ensureDesignerCoreBuilt(packageRoot);
  }, 180_000);

  it('emits the entry point and its declarations', () => {
    expect.hasAssertions();
    expect(exists('dist/index.js')).toBe(true);
    expect(exists('dist/index.d.ts')).toBe(true);
  });

  it('emits every module of the DOM-free closure, each with declarations', () => {
    expect.hasAssertions();
    for (const rel of builtModuleList(packageRoot)) {
      expect(exists(`dist/${rel}`)).toBe(true);
      expect(exists(`dist/${rel.replace(/\.js$/, '.d.ts')}`)).toBe(true);
    }
  });

  it('contains exactly the declared closure — nothing more, nothing less', () => {
    expect.hasAssertions();
    // This is the assertion that keeps a DOM module out of the tarball: the
    // artifact's file set is enumerated, not sampled.
    const expected = builtModuleList(packageRoot)
      .flatMap((rel) => [rel, rel.replace(/\.js$/, '.d.ts')])
      .concat(['index.js', 'index.d.ts'])
      .sort();

    expect(listDistFiles()).toStrictEqual(expected);
  });

  it('never ships the DOM or storage halves of the designer', () => {
    expect.hasAssertions();
    // The issue's "out" list, restated as an absence proof on the artifact.
    const excludedNeedles = [
      'ui/', 'pwa/', 'script.js',
      'designerSync', 'catalogSyncClient',
      'CanaDesignerStore', 'canaMigration', 'designerStoreFactory'
    ];
    const shipped = listDistFiles();

    for (const needle of excludedNeedles) {
      expect(shipped.some((file) => file.includes(needle))).toBe(false);
    }
    // And no module left inside the closure may import across the boundary.
    // Specifiers only, not raw text: the modules' own doc comments mention
    // `src/ui/` and Cana to explain the boundary, and a text scan cannot tell
    // prose from code (the AST-level proof lives in dom-free.test.ts).
    for (const rel of builtModuleList(packageRoot)) {
      const source = readDist(rel);
      const specifiers = [...source.matchAll(/(?:import|export)[^'"]*?from\s*'([^']+)'/g)]
        .map((match) => match[1]);
      for (const specifier of specifiers) {
        for (const needle of excludedNeedles) {
          expect(specifier).not.toContain(needle);
        }
        expect(specifier.toLowerCase()).not.toContain('cana');
      }
    }
  });

  it('emits an ESM entry that is genuinely ESM', () => {
    expect.hasAssertions();
    const entry = readDist('index.js');

    expect(entry).toContain('export');
    expect(entry).not.toContain('module.exports');
  });

  it('ships a barrel whose every specifier resolves inside the artifact', () => {
    expect.hasAssertions();
    // The barrel ships verbatim (src/ is canonical), so this is the check
    // that no workspace-only path survives into the artifact — the
    // "installs, then cannot be imported" failure this suite exists to
    // catch. Specifiers are extracted from `export … from` statements so the
    // barrel's doc comment is not mistaken for code.
    const entry = readDist('index.js');
    const specifiers = [...entry.matchAll(/export \* from '([^']+)'/g)].map((match) => match[1]);

    expect(specifiers).toHaveLength(builtModuleList(packageRoot).length);
    for (const specifier of specifiers) {
      expect(specifier.startsWith('./')).toBe(true);
      expect(specifier).not.toContain('apps/service-management');
      expect(exists(path.join('dist', specifier))).toBe(true);
    }
  });
});

describe('designer-core publish dry run', () => {
  beforeAll(async () => {
    await ensureDesignerCoreBuilt(packageRoot);
  }, 180_000);

  it('packs a tarball whose contents are asserted, not assumed (Req 070)', () => {
    expect.hasAssertions();
    // The CI dry-run surface (`bun run npm:publish:dry-run:packages`) proves
    // the publish command succeeds; this assertion proves WHAT would be
    // published. `npm pack --dry-run` assembles the exact tarball file list
    // without writing or uploading anything — the repo's npm org check
    // (ci-cd/check-npm-org-integration.js) already assumes npm is available.
    const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: packageRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const [packument] = JSON.parse(output) as Array<{
      name: string;
      files: Array<{ path: string }>;
    }>;
    const packed = packument.files.map((file) => file.path);

    expect(packument.name).toBe('@jumentix/designer-core');
    const requiredPaths = [
      'dist/index.js', 'dist/index.d.ts',
      'README.md', 'README.pt-BR.md', 'LICENSE.md', 'package.json'
    ];
    for (const required of requiredPaths) {
      expect(packed).toContain(required);
    }
    for (const moduleRel of builtModuleList(packageRoot)) {
      expect(packed).toContain(`dist/${moduleRel}`);
    }
    // Nothing outside the artifact: no sources, no tests, no build tooling.
    expect(packed.some(isNonArtifactPath)).toBe(false);
  });
});
