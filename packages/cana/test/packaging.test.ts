/* eslint-disable @typescript-eslint/no-var-requires, global-require */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Packaging contract for `@jumentix/cana` (JUM-416).
 *
 * A packaging mistake is invisible to every other test in this repo: the
 * workspace resolves `@jumentix/cana` through a tsconfig path straight to
 * `src/`, so the whole suite passes whether or not the published tarball would
 * work for anyone else. These assertions are the only thing standing between a
 * correct build and a package that installs and then cannot be imported.
 *
 * The specific failure this guards against was real. The manifest pointed
 * `main`, `types` and `exports` at `src/index.ts` — raw TypeScript, unloadable
 * by any plain consumer — while `files` shipped `src` and never the `dist` the
 * build script produced.
 */

// One level up, now that the suite sits inside the package it describes. It
// previously climbed five directories and then named the package from outside —
// the kind of path that breaks silently the moment anything moves, as this one
// did.
const packageRoot = path.resolve(__dirname, '..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
) as {
  name: string;
  version: string;
  main: string;
  module: string;
  types: string;
  license: string;
  sideEffects: boolean;
  files: string[];
  exports: Record<string, unknown>;
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
  publishConfig?: { access?: string };
};

const exists = (relative: string): boolean => fs.existsSync(path.join(packageRoot, relative));

const runtimeDependencies = Object.keys(manifest.dependencies ?? {});

/** The text of every `export { … }` statement in an ESM bundle. */
const exportStatements = (bundle: string): string[] => [...bundle.matchAll(/export\s*\{([^}]*)\}/gs)].map((statement) => statement[1]);

/** One entry of an export clause, whitespace and empties removed. */
const exportEntries = (statement: string): string[] => statement
  .split(',')
  .map((part) => part.trim())
  .filter((name) => name !== '');

/** The local binding an export entry references: `x` for `x`, `y` for `y as x`. */
const localBindingOf = (entry: string): string => /^([\w$]+)\s+as\s+[\w$]+$/.exec(entry)?.[1] ?? entry;

/** The name a consumer sees for an export entry: `x` for `x`, `x` for `y as x`. */
const exportedNameOf = (entry: string): string => /^[\w$]+\s+as\s+([\w$]+)$/.exec(entry)?.[1] ?? entry;

const localBindingsOf = (bundle: string): string[] => {
  const entries = exportStatements(bundle).flatMap(exportEntries);
  return entries.map(localBindingOf);
};

const exportedNamesOf = (bundle: string): string[] => {
  const entries = exportStatements(bundle).flatMap(exportEntries);
  return entries.map(exportedNameOf);
};

/**
 * Whether a binding's definition survived bundling: a defined local occurs at
 * least twice (definition plus export reference), a dangling one exactly once.
 */
const isDefinedIn = (bundle: string, name: string): boolean => (bundle.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length >= 2;

const expectedEsmSurface = [
  'canaError', 'translateError', 'requestToPromise',
  'isCanaError', 'isCanaErrorCode',
  'StorageDurability', 'browserStorageEnvironment', 'classifyOpen',
  'applySchema', 'assertSchema', 'keyStrategyOf', 'validateSchema',
  'openDatabase', 'closeDatabase', 'deleteDatabase',
  'createClient', 'Client', 'createTable', 'createCanaDatabaseClient',
  'runTransaction', 'runQuery', 'runCount', 'toKeyRange', 'planQuery',
  'applyBeforeWrite', 'notifyCommitted', 'notifyRolledBack',
  'assessDurability', 'requiresUserAttention', 'DEFAULT_DURABILITY_POLICY',
  'withLedgerStore', 'recordOperation', 'resolveOutcome', 'pruneLedger',
  'OPERATION_LEDGER_STORE', 'DEFAULT_LEDGER_HORIZON_MS',
  'createRouter', 'isBroadcast', 'DEFAULT_REQUEST_TIMEOUT_MS',
  'createWorkerHost', 'createWorkerClient', 'serve',
  'runConformance', 'describeCoverage',
  'createChangeBuffer', 'abortWithReason'
];

describe('cana packaging manifest', () => {
  it('points every entry point at built output, not at TypeScript source', () => {
    expect.hasAssertions();
    // Publishing `src/index.ts` produces a package that installs cleanly and
    // then fails at the first import for anyone not compiling it themselves.
    expect(manifest.main).toBe('dist/index.js');
    expect(manifest.types).toBe('dist/index.d.ts');
  });

  it('never points an entry point into src', () => {
    expect.hasAssertions();
    // Declarations legitimately end in .d.ts; what must not appear is source.
    expect(manifest.main).not.toContain('src/');
    expect(manifest.types).not.toContain('src/');
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

  it('ships both module formats, with ESM for browsers', () => {
    expect.hasAssertions();
    // Cana is a browser library. A CommonJS-only package cannot be loaded by a
    // native `import` at all — the conformance page proved that concretely —
    // so the ESM build is not an optimisation, it is the primary consumer path.
    const root = manifest.exports['.'] as Record<string, string>;

    expect(root.import).toBe('./dist/index.mjs');
    expect(root.require).toBe('./dist/index.js');
    expect(manifest.module).toBe('dist/index.mjs');
  });

  it('builds the ESM bundle with bun, per Requirement 096', () => {
    expect.hasAssertions();
    expect(manifest.scripts['build:esm']).toContain('bun build');
    expect(manifest.scripts.build).toContain('bun run build:esm');
  });

  it('ships the built output and the licence, and does not ship source', () => {
    expect.hasAssertions();
    expect(manifest.files).toContain('dist');
    expect(manifest.files).toContain('README.md');
    expect(manifest.files).toContain('LICENSE.md');
    expect(manifest.files).not.toContain('src');
  });

  it('has the files it promises to publish', () => {
    expect.hasAssertions();
    // `files` naming something absent produces a tarball missing it, with no
    // warning at pack time.
    expect(exists('README.md')).toBe(true);
    expect(exists('LICENSE.md')).toBe(true);
  });

  it('declares a licence that matches the file it ships', () => {
    expect.hasAssertions();
    const licence = fs.readFileSync(path.join(packageRoot, 'LICENSE.md'), 'utf8');

    expect(manifest.license).toBe('MIT');
    expect(licence).toContain('MIT');
  });

  it('has no runtime dependencies', () => {
    expect.hasAssertions();
    // Cana is a from-scratch engine. A runtime dependency appearing here would
    // mean something was pulled in without the decision being made — Dexie in
    // particular is a dev-time oracle only and must never reach this list.
    expect(runtimeDependencies).toStrictEqual([]);
  });

  it('is marked side-effect free so bundlers can tree-shake it', () => {
    expect.hasAssertions();
    expect(manifest.sideEffects).toBe(false);
  });

  it('builds before publishing rather than trusting a stale dist', () => {
    expect.hasAssertions();
    // Without this a publish can ship whatever happened to be in `dist` from an
    // earlier, possibly different, commit.
    expect(manifest.scripts.prepublishOnly).toContain('build');
    expect(manifest.scripts.prepublishOnly).toContain('clean');
  });

  it('runs its build through bun, per Requirement 096', () => {
    expect.hasAssertions();
    // Bun is the sole internal runtime. `prepublishOnly` chains through
    // `bun run`, and the build itself is the pinned toolchain's tsc.
    expect(manifest.scripts.prepublishOnly).toContain('bun run');
    expect(manifest.scripts.build).toContain('tsc');
  });

  it('runs its own suites from its own test script', () => {
    expect.hasAssertions();
    // The suites live in this package now, so `bun test` here executes them —
    // the script no longer points somewhere else, and no longer needs to.
    //
    // A `test` script that quietly typechecks, echoes, or defers to another
    // package is the JUM-557 false green: it passes while nothing runs. Both
    // shapes are rejected here, and `--isolate` is required because Bun shares
    // one process across files otherwise, which is what let mocked modules leak
    // between suites (JUM-583).
    expect(manifest.scripts.test).toContain('bun test');
    expect(manifest.scripts.test).toContain('--isolate');
    expect(manifest.scripts.test).not.toContain('typecheck');
    expect(manifest.scripts.test).not.toContain('echo');
  });

  it('is publishable and public', () => {
    expect.hasAssertions();
    expect(manifest.publishConfig?.access).toBe('public');
    expect((manifest as { private?: boolean }).private).toBeUndefined();
  });
});

describe('cana built output', () => {
  // Built here rather than assumed. An earlier version branched on whether
  // `dist` happened to exist, which reported green in a fresh clone where
  // nothing had been built — the exact failure mode this file exists to catch.
  // The build is deterministic and takes a couple of seconds; that is a fair
  // price for an assertion that is always real.
  beforeAll(() => {
    execFileSync('bun', ['run', 'build'], { cwd: packageRoot, stdio: 'pipe' });
  }, 120_000);

  it('emits both entry points and declarations', () => {
    expect.hasAssertions();
    expect(exists('dist/index.js')).toBe(true);
    expect(exists('dist/index.mjs')).toBe(true);
    expect(exists('dist/index.d.ts')).toBe(true);
  });

  it('emits an ESM bundle that is genuinely ESM', () => {
    expect.hasAssertions();
    // A file named .mjs that contains  would load nowhere.
    const bundle = fs.readFileSync(path.join(packageRoot, 'dist/index.mjs'), 'utf8');

    expect(bundle).toContain('export');
    expect(bundle).not.toContain('module.exports');
  });

  it('emits an ESM bundle with no dangling export bindings', () => {
    expect.hasAssertions();
    // JUM-629: bun 1.3.14 tree-shakes named re-exports out of a
    // `sideEffects: false` package — the `export { x }` statement survives
    // while the definition of `x` is dropped. Node and bun parse the export
    // list lazily enough to look healthy; WebKit refuses to link the module
    // at all. Every other assertion in this file passed on the broken bundle,
    // which is how the defect shipped.
    //
    // The check is deliberately mechanical: every local name referenced by an
    // export statement must occur somewhere else in the bundle (its
    // definition). A dangling binding occurs exactly once — in the export
    // list itself. bun's non-minified output always spells a definition with
    // the same identifier, so a second word-boundary occurrence is proof the
    // binding exists.
    const bundle = fs.readFileSync(path.join(packageRoot, 'dist/index.mjs'), 'utf8');
    const locals = localBindingsOf(bundle);

    expect(locals.length).toBeGreaterThan(0);
    expect(locals.filter((name) => !isDefinedIn(bundle, name))).toStrictEqual([]);
  });

  it('exports the full public surface from the ESM bundle', () => {
    expect.hasAssertions();
    // The barrel re-exports with `export *` (see src/index.ts for why), and a
    // name collision between two star-exported modules is silently dropped by
    // the module system rather than reported. Naming the surface here turns
    // that silent loss into a test failure.
    const bundle = fs.readFileSync(path.join(packageRoot, 'dist/index.mjs'), 'utf8');

    expect(exportedNamesOf(bundle)).toStrictEqual(expect.arrayContaining(expectedEsmSurface));
  });

  it('exports the client surface from the built entry', () => {
    expect.hasAssertions();
    // Loaded from the built artefact, not through the workspace alias — the only
    // assertion in the repo that exercises what a consumer actually receives.
    const compiled = require(path.join(packageRoot, 'dist/index.js')) as Record<string, unknown>;

    expect(typeof compiled.createClient).toBe('function');
    expect(typeof compiled.createCanaDatabaseClient).toBe('function');
    expect(typeof compiled.createWorkerHost).toBe('function');
  });

  it('exports the guards and helpers from the built entry', () => {
    expect.hasAssertions();
    const compiled = require(path.join(packageRoot, 'dist/index.js')) as Record<string, unknown>;

    expect(typeof compiled.isCanaError).toBe('function');
    expect(typeof compiled.validateSchema).toBe('function');
    expect(typeof compiled.assessDurability).toBe('function');
  });
});
