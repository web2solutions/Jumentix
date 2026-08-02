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
