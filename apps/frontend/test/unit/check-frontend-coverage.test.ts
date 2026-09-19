import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../..');
const {
  EXCLUDED,
  THRESHOLDS,
  isSubject,
  parseLcov,
  run,
  summarize
} = require(path.join(repoRoot, 'apps/frontend/scripts/check-coverage.js'));

/**
 * Requirement 135 §3 — the frontend coverage gate ships with the failures it
 * prevents: a missing report, a threshold miss, and an untouched source file
 * that would otherwise vanish from the number.
 */
interface LcovEntry {
  file: string;
  lf: number;
  lh: number;
  fnf: number;
  fnh: number;
}

const lcov = (entries: LcovEntry[]): string => entries
  .map((e) => `TN:\nSF:${e.file}\nFNF:${e.fnf}\nFNH:${e.fnh}\nLF:${e.lf}\nLH:${e.lh}\nend_of_record`)
  .join('\n');

describe('check-frontend-coverage', () => {
  it('fails closed when the lcov report is missing', () => {
    expect.hasAssertions();
    const result = run({ reportPath: path.join(os.tmpdir(), 'does-not-exist.lcov') });
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toContain('does not exist');
  });

  it('parses lcov records relative to the app root and keeps the excluded wiring out of scope', () => {
    expect.hasAssertions();
    const files = parseLcov(lcov([{
      file: 'src/_nav.ts', lf: 10, lh: 9, fnf: 1, fnh: 1
    }]));
    const [only] = [...files.keys()];
    expect(only.endsWith(path.join('apps', 'frontend', 'src', '_nav.ts'))).toBe(true);
    expect(isSubject(only)).toBe(true);
    expect(isSubject(only.replace('_nav.ts', 'main.ts'))).toBe(false);
    expect(EXCLUDED.some((pattern: RegExp) => pattern.test('/x/src/router/index.ts'))).toBe(true);
  });

  it('counts an untouched source at zero hits instead of dropping it', () => {
    expect.hasAssertions();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-cov-'));
    const touched = path.join(dir, 'touched.ts');
    const untouched = path.join(dir, 'untouched.ts');
    fs.writeFileSync(touched, 'export const a = 1;\n');
    fs.writeFileSync(untouched, 'export const b = 1;\nexport const c = 2;\n');
    const files = new Map([[touched, {
      path: touched, lf: 4, lh: 4, fnf: 2, fnh: 2
    }]]);
    const { totals, untouched: missing } = summarize(files, [touched, untouched]);
    expect(totals.lines).toStrictEqual({ found: 6, hit: 4 });
    expect(totals.functions).toStrictEqual({ found: 2, hit: 2 });
    expect(missing).toHaveLength(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports the real report against the thresholds with branches marked unmeasured', () => {
    expect.hasAssertions();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fe-cov-'));
    const report = path.join(dir, 'lcov.info');
    fs.writeFileSync(report, lcov([{
      file: 'src/_nav.ts', lf: 10, lh: 1, fnf: 1, fnh: 0
    }]));
    const result = run({ reportPath: report, thresholds: { lines: 99, functions: 99 } });
    expect(result.ok).toBe(false);
    expect(result.messages.some((m: string) => m.includes('FAIL'))).toBe(true);
    expect(result.messages.some((m: string) => m.includes('branches   unmeasured'))).toBe(true);
    expect(THRESHOLDS.lines).toBeGreaterThan(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
