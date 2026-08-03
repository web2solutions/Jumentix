/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

/**
 * The browser-matrix merge must be a union, never a sum of files and never a
 * single engine's view (JUM-417).
 *
 * The same instrumented bundle runs on every engine, so the counter identities
 * are identical. What differs is *which* lines each engine reaches: WebKit
 * exercises the storage paths Chrome does not, and Firefox its own. A merge
 * that keeps one engine's report throws those away; a merge that concatenates
 * the two files double-counts the overlap. The only honest merge is a union —
 * a location hit on any engine is covered, and the totals reflect what the
 * matrix measured, not what one browser happened to reach.
 */

const repoRoot = path.resolve(__dirname, '../../../../..');
const {
  parseLcov,
  serializeRecords,
  mergeEngineReports,
  engineLcovPath
} = require(path.join(repoRoot, 'ci-cd', 'merge-browser-coverage.js'));

interface DaLine {
  line: number;
  hits: number;
}

function lcovFor(lines: DaLine[]): string {
  return [
    'TN:',
    'SF:packages/cana/src/core/storage.ts',
    'FN:1,open',
    'FNDA:3,open',
    'FNF:1',
    'FNH:1',
    'BRDA:10,0,0,1',
    'BRDA:10,0,1,0',
    'BRF:2',
    'BRH:1',
    ...lines.map((l) => `DA:${l.line},${l.hits}`),
    `LF:${lines.length}`,
    `LH:${lines.filter((l) => l.hits > 0).length}`,
    'end_of_record'
  ].join('\n');
}

/**
 * A minimal but valid Istanbul file-coverage object. `createCoverageMap` is
 * strict about the shape it merges, so the fixture carries real statement and
 * branch maps rather than the counters alone.
 */
function istanbulJsonFor(file: string, lines: DaLine[]): Record<string, unknown> {
  const statementMap: Record<string, unknown> = {};
  const s: Record<string, number> = {};
  lines.forEach((entry, index) => {
    statementMap[String(index)] = {
      start: { line: entry.line, column: 0 },
      end: { line: entry.line, column: 10 }
    };
    s[String(index)] = entry.hits;
  });

  return {
    [file]: {
      path: file,
      statementMap,
      fnMap: {},
      branchMap: {},
      s,
      f: {},
      b: {}
    }
  };
}

/** A two-engine coverage tree under a temporary root. */
function writeEngine(
  root: string,
  engine: string,
  lcov: string,
  json?: Record<string, unknown>
): void {
  const engineDir = engine === 'chrome' ? 'browser' : `browser-${engine}`;
  const dir = path.join(root, 'coverage', engineDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'lcov.info'), lcov);
  if (json) fs.writeFileSync(path.join(dir, 'coverage-final.json'), JSON.stringify(json));
}

describe('merge-browser-coverage', () => {
  it('unions DA counters across engines so a line hit anywhere is covered', () => {
    expect.hasAssertions();
    const chrome = [{ line: 5, hits: 4 }, { line: 6, hits: 0 }];
    const webkit = [{ line: 5, hits: 0 }, { line: 6, hits: 2 }];

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cana-merge-'));
    fs.mkdirSync(path.join(root, 'coverage', 'browser'), { recursive: true });
    fs.mkdirSync(path.join(root, 'coverage', 'browser-webkit'), { recursive: true });
    fs.writeFileSync(path.join(root, 'coverage', 'browser', 'lcov.info'), lcovFor(chrome));
    fs.writeFileSync(path.join(root, 'coverage', 'browser-webkit', 'lcov.info'), lcovFor(webkit));

    const result = mergeEngineReports(root);
    const merged = fs.readFileSync(result.output, 'utf8');
    const da = merged.split('\n').filter((line: string) => line.startsWith('DA:'));
    const lh = merged.split('\n').find((line: string) => line.startsWith('LH:'));

    expect(result).toMatchObject({ ok: true, merged: true });
    expect(result.engines.sort()).toStrictEqual(['chrome', 'webkit']);
    expect(da).toStrictEqual(expect.arrayContaining(['DA:5,4', 'DA:6,2']));
    expect(lh).toBe('LH:2');
  });

  it('treats a single engine as the canonical report without rewriting it', () => {
    expect.hasAssertions();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cana-merge-single-'));
    const dir = path.join(root, 'coverage', 'browser');
    fs.mkdirSync(dir, { recursive: true });
    const lcov = lcovFor([{ line: 1, hits: 1 }]);
    fs.writeFileSync(path.join(dir, 'lcov.info'), lcov);

    const result = mergeEngineReports(root);

    expect(result).toMatchObject({ ok: true, merged: false, engines: ['chrome'] });
    expect(fs.readFileSync(result.output, 'utf8')).toBe(lcov);
  });

  it('promotes a lone non-chrome engine onto the canonical paths', () => {
    expect.hasAssertions();
    // The failure mode from review: `--from-dir` finds only WebKit, and the
    // merge returned WebKit's own path — leaving Sonar and the gate to grade
    // whatever a previous run left on `coverage/browser/`. One engine is the
    // whole matrix, so its report must land where consumers read it.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cana-merge-promote-'));
    const lcov = lcovFor([{ line: 3, hits: 5 }]);
    const json = istanbulJsonFor('/repo/packages/cana/src/core/storage.ts', [{ line: 3, hits: 5 }]);
    writeEngine(root, 'webkit', lcov, json);

    const result = mergeEngineReports(root, [
      {
        engine: 'webkit',
        lcov: path.join(root, 'coverage', 'browser-webkit', 'lcov.info'),
        json: path.join(root, 'coverage', 'browser-webkit', 'coverage-final.json')
      }
    ]);

    expect(result).toMatchObject({ ok: true, merged: false, engines: ['webkit'] });
    expect(result.output).toBe(path.join(root, 'coverage', 'browser', 'lcov.info'));
    expect(fs.readFileSync(result.output, 'utf8')).toBe(lcov);
    expect(
      JSON.parse(fs.readFileSync(path.join(root, 'coverage', 'browser', 'coverage-final.json'), 'utf8'))
    ).toStrictEqual(json);
  });

  it('never copies a report onto itself when --from-dir is relative', () => {
    expect.hasAssertions();
    // CI invokes `merge-browser-coverage.js --from-dir coverage` with a
    // relative directory. A relative input path compared against the absolute
    // canonical output always looks "different", and copyFileSync of a file
    // onto itself is not a no-op on macOS — it unlinks the report. The inputs
    // are resolved to absolute at the boundary so the equality check is real.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cana-merge-relative-'));
    const lcov = lcovFor([{ line: 1, hits: 1 }]);
    const json = istanbulJsonFor('/repo/packages/cana/src/core/storage.ts', [{ line: 1, hits: 1 }]);
    writeEngine(root, 'chrome', lcov, json);

    const previousCwd = process.cwd();
    process.chdir(root);
    let result;
    try {
      const { artifactInputs } = require(path.join(repoRoot, 'ci-cd', 'merge-browser-coverage.js'));
      result = mergeEngineReports(root, artifactInputs('coverage'));
    } finally {
      process.chdir(previousCwd);
    }

    expect(result).toMatchObject({ ok: true, merged: false, engines: ['chrome'] });
    expect(fs.readFileSync(path.join(root, 'coverage', 'browser', 'lcov.info'), 'utf8')).toBe(lcov);
    expect(
      JSON.parse(fs.readFileSync(path.join(root, 'coverage', 'browser', 'coverage-final.json'), 'utf8'))
    ).toStrictEqual(json);
  });

  it('unions the per-engine Istanbul JSON so the gate grades the matrix', () => {
    expect.hasAssertions();
    // The LCOV union feeds Sonar; the threshold gate reads coverage-final.json,
    // which every engine overwrites with its own view. Without this union the
    // gate grades whichever engine ran last instead of the matrix (JUM-417).
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cana-merge-json-'));
    const file = '/repo/packages/cana/src/core/storage.ts';
    const chromeJson = istanbulJsonFor(file, [{ line: 5, hits: 4 }, { line: 6, hits: 0 }]);
    const webkitJson = istanbulJsonFor(file, [{ line: 5, hits: 0 }, { line: 6, hits: 2 }]);
    writeEngine(root, 'chrome', lcovFor([{ line: 5, hits: 4 }]), chromeJson);
    writeEngine(root, 'webkit', lcovFor([{ line: 6, hits: 2 }]), webkitJson);

    const result = mergeEngineReports(root);

    expect(result).toMatchObject({ ok: true, merged: true });
    expect(result.json).toMatchObject({ enginesWithJson: 2, files: 1 });

    const merged = JSON.parse(fs.readFileSync(result.json.output, 'utf8'));
    // A union, not a sum: line 5 was hit only by chrome, line 6 only by
    // webkit, and both must read as covered rather than one engine's zeros.
    expect(merged[file].s).toStrictEqual({ 0: 4, 1: 2 });
  });

  it('skips the JSON union when no engine left a JSON report', () => {
    expect.hasAssertions();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cana-merge-nojson-'));
    writeEngine(root, 'chrome', lcovFor([{ line: 1, hits: 1 }]));
    writeEngine(root, 'webkit', lcovFor([{ line: 1, hits: 2 }]));

    const result = mergeEngineReports(root);

    expect(result).toMatchObject({ ok: true, merged: true });
    expect(result.json).toBeNull();
  });

  it('fails closed when no engine produced a report', () => {
    expect.hasAssertions();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cana-merge-empty-'));
    const result = mergeEngineReports(root);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/No browser LCOV/);
  });

  it('round-trips records so a re-serialized single file keeps its counters', () => {
    expect.hasAssertions();
    const source = lcovFor([{ line: 9, hits: 7 }, { line: 11, hits: 0 }]);
    const out = serializeRecords(parseLcov(source));
    expect(out).toStrictEqual(expect.stringContaining('DA:9,7'));
    expect(out).toStrictEqual(expect.stringContaining('DA:11,0'));
    expect(out).toStrictEqual(expect.stringContaining('BRF:2'));
    expect(out).toStrictEqual(expect.stringContaining('LH:1'));
  });

  it('keeps the chrome engine on the historical coverage/browser path', () => {
    expect.hasAssertions();
    expect(engineLcovPath('/r/coverage', 'chrome')).toBe(path.join('/r/coverage', 'browser', 'lcov.info'));
    expect(engineLcovPath('/r/coverage', 'webkit')).toBe(path.join('/r/coverage', 'browser-webkit', 'lcov.info'));
  });
});
