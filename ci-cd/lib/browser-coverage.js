/**
 * Coverage for the browser suites (Requirement 112 §4).
 *
 * §4 says the coverage contract is met by the browser run, not by the browser
 * run and a Node run together. So the browser run has to produce a real
 * Istanbul report, and it has to be attributed to the TypeScript sources rather
 * than to the bundle the browser actually executed.
 *
 * The route is:
 *
 *   1. Bun bundles the spec with an inline source map.
 *   2. Istanbul instruments the bundle. It counts statements in the *bundled*
 *      file, which is not useful on its own.
 *   3. The browser runs it and leaves `window.__coverage__` behind; the support
 *      file writes that out through a Cypress task.
 *   4. The map is used to put every counter back on the file it came from, and
 *      everything that is not this repository's own source is dropped — a
 *      bundle contains the spec and its dependencies, and neither is a subject.
 *
 * The alternative was instrumenting the sources before bundling, which needs a
 * TypeScript-aware instrumenter and a second build of every file. Instrumenting
 * once, at the end, is fewer moving parts and the source map is already there.
 */

const fs = require('node:fs');
const path = require('node:path');
const { createInstrumenter } = require('istanbul-lib-instrument');
const libCoverage = require('istanbul-lib-coverage');
const { createSourceMapStore } = require('istanbul-lib-source-maps');

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, '.browser-tests', '.coverage');
const OUTPUT_DIR = path.join(ROOT, 'coverage', 'browser');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'coverage-final.json');

/** The inline source map Bun appended, as an object. */
function readInlineSourceMap(code) {
  const marker = '//# sourceMappingURL=data:application/json;base64,';
  const at = code.lastIndexOf(marker);
  if (at < 0) return undefined;

  const encoded = code.slice(at + marker.length).trim();
  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch {
    return undefined;
  }
}

/**
 * Instruments a bundle in place, and keeps its source map beside it.
 *
 * The map is written out rather than left inline because the remapping step
 * runs in a separate process, after the browser has gone.
 */
function instrumentBundle(bundleFile, readFile = fs.readFileSync, writeFile = fs.writeFileSync) {
  const code = String(readFile(bundleFile, 'utf8'));
  const map = readInlineSourceMap(code);

  const instrumenter = createInstrumenter({
    esModules: false,
    compact: false,
    produceSourceMap: false,
    coverageGlobalScope: 'window',
    coverageGlobalScopeFunc: false
  });

  const instrumented = instrumenter.instrumentSync(code, bundleFile, map);

  writeFile(bundleFile, instrumented);
  if (map) writeFile(`${bundleFile}.map.json`, JSON.stringify(map));

  return { instrumented: true, hasSourceMap: Boolean(map) };
}

/**
 * The repository path a remapped coverage key refers to.
 *
 * A source map's `sources` are relative to the bundle, so remapping produces
 * `.browser-tests/<package>/packages/cana/src/core/errors.ts` — a path that
 * exists nowhere. The real file is what follows the build directory.
 */
function toRepositoryPath(file, root = ROOT) {
  const marker = `${path.sep}.browser-tests${path.sep}`;
  const at = file.indexOf(marker);
  if (at < 0) return file;

  const afterBuildDir = file.slice(at + marker.length);
  const parts = afterBuildDir.split(path.sep);
  // The first segment is the package the bundle belongs to, not part of the
  // source path.
  return path.join(root, parts.slice(1).join(path.sep));
}

/** Only this repository's own TypeScript sources are coverage subjects. */
function isSubject(file, root = ROOT) {
  if (!file.startsWith(root)) return false;
  const relative = path.relative(root, file);
  if (relative.startsWith('..')) return false;
  if (relative.includes('node_modules')) return false;
  if (relative.includes(`${path.sep}cypress${path.sep}`)) return false;
  if (relative.startsWith('.browser-tests')) return false;
  return relative.endsWith('.ts') && !relative.endsWith('.d.ts');
}

/**
 * Turns what the browser left behind into a report keyed by source file.
 *
 * Returns `ok: false` when nothing was collected. A browser run that produced
 * no coverage is not a browser run that covered everything, and the difference
 * has to reach the gate rather than be smoothed over with an empty report.
 */
async function collect(rawDir = RAW_DIR) {
  if (!fs.existsSync(rawDir)) {
    return { ok: false, message: 'The browser run left no coverage behind.' };
  }

  const files = fs.readdirSync(rawDir).filter((name) => name.endsWith('.json'));
  if (files.length === 0) {
    return { ok: false, message: 'The browser run left no coverage behind.' };
  }

  const map = libCoverage.createCoverageMap({});
  for (const name of files) {
    map.merge(JSON.parse(fs.readFileSync(path.join(rawDir, name), 'utf8')));
  }

  // Back onto the TypeScript files, through the maps written beside each bundle.
  const store = createSourceMapStore({});
  for (const bundleFile of map.files()) {
    const mapFile = `${bundleFile}.map.json`;
    if (fs.existsSync(mapFile)) {
      store.registerMap(bundleFile, JSON.parse(fs.readFileSync(mapFile, 'utf8')));
    }
  }

  const remapped = await store.transformCoverage(map);

  const subjects = libCoverage.createCoverageMap({});
  for (const file of remapped.files()) {
    const repositoryPath = toRepositoryPath(file);
    if (!isSubject(repositoryPath)) continue;
    if (!fs.existsSync(repositoryPath)) continue;

    const data = JSON.parse(JSON.stringify(remapped.fileCoverageFor(file).toJSON()));
    data.path = repositoryPath;
    subjects.addFileCoverage(data);
  }

  return { ok: true, coverage: subjects };
}

function writeBrowserCoverage(options = {}) {
  const rawDir = options.rawDir || RAW_DIR;
  const output = options.output || OUTPUT_FILE;

  // Synchronous by necessity: the runner's `run()` is synchronous, and the
  // remap is the only asynchronous step. `deasync` is not a dependency worth
  // having, so the remap runs in a child of this process.
  const { spawnSync } = require('node:child_process');
  const result = spawnSync(
    'bun',
    [path.join(__dirname, 'browser-coverage-write.js'), rawDir, output],
    { stdio: 'pipe', encoding: 'utf8' }
  );

  if (result.status !== 0) {
    return { ok: false, message: `Browser coverage failed:\n${result.stderr || result.stdout}` };
  }

  return { ok: true, message: String(result.stdout).trim() };
}

module.exports = {
  OUTPUT_FILE,
  toRepositoryPath,
  RAW_DIR,
  collect,
  instrumentBundle,
  isSubject,
  readInlineSourceMap,
  writeBrowserCoverage
};
