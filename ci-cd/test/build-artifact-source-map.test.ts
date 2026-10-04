import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const {
  decodeVlq,
  firstOriginalLinePerGeneratedLine,
  loadDistSourceMap,
  parseDaLine,
  remapDistLcovRecord
} = require('../lib/build-artifact-source-map.js');

/**
 * A 5-generated-line file compiled from a 3-line source, built by hand from
 * the source-map-v3 VLQ spec rather than a real `tsc` run, so the fixture's
 * shape (a boilerplate line with no mapping, and two generated lines folding
 * back onto the same source line) is exact and doesn't depend on whatever a
 * compiler happens to emit today.
 *
 * Generated line 1: no segment (unmapped boilerplate, e.g. `"use strict"`).
 * Generated line 2 → source line 1. Generated line 3 → source line 2.
 * Generated line 4 → source line 3. Generated line 5 → source line 3 again
 * (a second statement folded onto the same source line).
 */
const FIXTURE_MAPPINGS = ';AAAA;AACA;AACA;AAAA';

function writeFixture(dir: string) {
  const jsPath = path.join(dir, 'thing.js');
  const mapPath = `${jsPath}.map`;
  fs.writeFileSync(jsPath, '// generated, not read directly by these tests\n');
  fs.writeFileSync(
    mapPath,
    JSON.stringify({
      version: 3,
      sources: ['../src/thing.ts'],
      mappings: FIXTURE_MAPPINGS
    })
  );
  return { jsPath, mapPath };
}

describe('decodeVlq', () => {
  it('decodes a single zero-value field', () => {
    expect.hasAssertions();
    expect(decodeVlq('A', 0)).toStrictEqual({ value: 0, endAt: 1 });
  });

  it('decodes positive and negative values via zig-zag', () => {
    expect.hasAssertions();
    expect(decodeVlq('C', 0).value).toBe(1);
    expect(decodeVlq('D', 0).value).toBe(-1);
  });

  it('continues past the 5-bit boundary for a value that needs two digits', () => {
    expect.hasAssertions();
    // zigzag(16) = 32 = 0b100000: digit0 = (32 & 31) | continuation = 32 → 'g',
    // digit1 = 32 >> 5 = 1, no continuation → 'B'. "gB" therefore decodes to +16.
    expect(decodeVlq('gB', 0)).toStrictEqual({ value: 16, endAt: 2 });
    // A trailing field starts exactly where the two-digit one ended.
    expect(decodeVlq('gBA', 2)).toStrictEqual({ value: 0, endAt: 3 });
  });

  it('throws on a character outside the base64 VLQ alphabet', () => {
    expect.hasAssertions();
    expect(() => decodeVlq('!', 0)).toThrow('Invalid base64 VLQ character at offset 0');
  });
});

describe('firstOriginalLinePerGeneratedLine', () => {
  it('maps each generated line to its first segment’s source line, dropping unmapped lines', () => {
    expect.hasAssertions();
    const table = firstOriginalLinePerGeneratedLine(FIXTURE_MAPPINGS);

    expect(table.has(1)).toBe(false);
    expect(table.get(2)).toStrictEqual({ sourceIndex: 0, sourceLine: 1 });
    expect(table.get(3)).toStrictEqual({ sourceIndex: 0, sourceLine: 2 });
    expect(table.get(4)).toStrictEqual({ sourceIndex: 0, sourceLine: 3 });
    expect(table.get(5)).toStrictEqual({ sourceIndex: 0, sourceLine: 3 });
  });

  it('returns an empty table for an empty mappings string', () => {
    expect.hasAssertions();
    expect(firstOriginalLinePerGeneratedLine('').size).toBe(0);
  });

  it('skips an empty segment from a doubled comma without losing the segment after it', () => {
    expect.hasAssertions();
    const table = firstOriginalLinePerGeneratedLine('AAAA,,AECA');
    expect(table.get(1)).toStrictEqual({ sourceIndex: 0, sourceLine: 1 });
  });

  it('ignores a generated-only segment (no source fields) and keeps looking on the same line', () => {
    expect.hasAssertions();
    // "A" is one VLQ field (generated column only) — no source to record.
    // "AAAA" right after it is the line's first segment that actually maps.
    const table = firstOriginalLinePerGeneratedLine('A,AAAA');
    expect(table.get(1)).toStrictEqual({ sourceIndex: 0, sourceLine: 1 });
  });

  it('decodes a 5-field segment (with a name index) as fully as a 4-field one', () => {
    expect.hasAssertions();
    const table = firstOriginalLinePerGeneratedLine('AAAAA');
    expect(table.get(1)).toStrictEqual({ sourceIndex: 0, sourceLine: 1 });
  });
});

describe('parseDaLine', () => {
  it('parses a DA record into its line and hit count', () => {
    expect.hasAssertions();
    expect(parseDaLine('DA:12,34')).toStrictEqual({ line: 12, hits: 34 });
  });

  it('returns null for a non-DA line or an unparseable one', () => {
    expect.hasAssertions();
    expect(parseDaLine('SF:foo.ts')).toBeNull();
    expect(parseDaLine('DA:not-a-number,3')).toBeNull();
  });
});

describe('loadDistSourceMap', () => {
  it('resolves the sidecar map to a repo-relative .ts source path', () => {
    expect.hasAssertions();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-source-map-'));
    fs.mkdirSync(path.join(dir, 'dist'));
    fs.mkdirSync(path.join(dir, 'src'));
    const { jsPath } = writeFixture(path.join(dir, 'dist'));
    fs.writeFileSync(path.join(dir, 'src', 'thing.ts'), '// source\n');

    const result = loadDistSourceMap(jsPath, dir);

    expect(result?.sourcePath).toBe('src/thing.ts');
    expect(result?.generatedToOriginal.get(2)).toStrictEqual({ sourceIndex: 0, sourceLine: 1 });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when there is no sidecar .map file', () => {
    expect.hasAssertions();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-source-map-'));
    const jsPath = path.join(dir, 'thing.js');
    fs.writeFileSync(jsPath, '// no map alongside this one\n');

    expect(loadDistSourceMap(jsPath, dir)).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for an unparseable map file', () => {
    expect.hasAssertions();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-source-map-'));
    const jsPath = path.join(dir, 'thing.js');
    fs.writeFileSync(jsPath, '// generated\n');
    fs.writeFileSync(`${jsPath}.map`, 'not json');

    expect(loadDistSourceMap(jsPath, dir)).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for a multi-source map rather than guess which source a line belongs to', () => {
    expect.hasAssertions();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-source-map-'));
    const jsPath = path.join(dir, 'bundle.js');
    fs.writeFileSync(jsPath, '// generated\n');
    fs.writeFileSync(
      `${jsPath}.map`,
      JSON.stringify({
        version: 3,
        sources: ['a.ts', 'b.ts'],
        mappings: FIXTURE_MAPPINGS
      })
    );

    expect(loadDistSourceMap(jsPath, dir)).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when the mapped source is not a .ts file', () => {
    expect.hasAssertions();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-source-map-'));
    const jsPath = path.join(dir, 'copy.js');
    fs.writeFileSync(jsPath, '// generated\n');
    fs.writeFileSync(
      `${jsPath}.map`,
      JSON.stringify({
        version: 3,
        sources: ['./copy-source.js'],
        mappings: FIXTURE_MAPPINGS
      })
    );

    expect(loadDistSourceMap(jsPath, dir)).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when the mapped source resolves outside the repository root', () => {
    expect.hasAssertions();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-source-map-'));
    const repoRoot = path.join(dir, 'repo');
    fs.mkdirSync(repoRoot);
    const jsPath = path.join(repoRoot, 'escapee.js');
    fs.writeFileSync(jsPath, '// generated\n');
    fs.writeFileSync(
      `${jsPath}.map`,
      JSON.stringify({
        version: 3,
        // Escapes repoRoot entirely rather than landing under it.
        sources: ['../outside/escapee.ts'],
        mappings: FIXTURE_MAPPINGS
      })
    );

    expect(loadDistSourceMap(jsPath, repoRoot)).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('remapDistLcovRecord', () => {
  describe('remapping SF and DA to the original source', () => {
    const RECORD = [
      'SF:dist/thing.js',
      'FNF:1',
      'FNH:1',
      'FN:2,thing',
      'FNDA:5,thing',
      'DA:1,0',
      'DA:2,5',
      'DA:3,5',
      'DA:4,3',
      'DA:5,7',
      'BRDA:2,0,0,5',
      'LF:4',
      'LH:4',
      'end_of_record'
    ].join('\n');

    function remapFixtureRecord() {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-source-map-'));
      fs.mkdirSync(path.join(dir, 'dist'));
      fs.mkdirSync(path.join(dir, 'src'));
      writeFixture(path.join(dir, 'dist'));
      fs.writeFileSync(path.join(dir, 'src', 'thing.ts'), '// source\n');
      const lines = remapDistLcovRecord(RECORD, dir).split('\n');
      fs.rmSync(dir, { recursive: true, force: true });
      return lines;
    }

    it('points SF at the original .ts source and keeps the record terminator', () => {
      expect.hasAssertions();
      const lines = remapFixtureRecord();

      expect(lines[0]).toBe('SF:src/thing.ts');
      expect(lines[lines.length - 1]).toBe('end_of_record');
    });

    it('drops the unremapped FN:/FNDA:/BRDA: lines but keeps the FNF:/FNH: totals', () => {
      expect.hasAssertions();
      const lines = remapFixtureRecord();

      expect(lines).toContain('FNF:1');
      expect(lines).toContain('FNH:1');
      expect(lines.some((line: string) => /^FN:|^FNDA:|^BRDA:/.test(line))).toBe(false);
    });

    it('takes the max hit count when two generated lines fold onto one source line', () => {
      expect.hasAssertions();
      const lines = remapFixtureRecord();

      expect(lines).toContain('DA:1,5');
      expect(lines).toContain('DA:2,5');
      // Generated lines 4 (hits=3) and 5 (hits=7) both fold onto source line 3.
      expect(lines).toContain('DA:3,7');
      expect(lines).toContain('LF:3');
      expect(lines).toContain('LH:3');
    });
  });

  it('resolves an already-absolute SF path as-is', () => {
    expect.hasAssertions();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-source-map-'));
    fs.mkdirSync(path.join(dir, 'dist'));
    fs.mkdirSync(path.join(dir, 'src'));
    const { jsPath } = writeFixture(path.join(dir, 'dist'));
    fs.writeFileSync(path.join(dir, 'src', 'thing.ts'), '// source\n');

    const record = [`SF:${jsPath}`, 'DA:2,9', 'end_of_record'].join('\n');
    const remapped = remapDistLcovRecord(record, dir);

    expect(remapped).toContain('SF:src/thing.ts');
    expect(remapped).toContain('DA:1,9');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns the record unchanged when there is no sidecar map', () => {
    expect.hasAssertions();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-source-map-'));
    const record = ['SF:src/plain.ts', 'DA:1,1', 'end_of_record'].join('\n');

    expect(remapDistLcovRecord(record, dir)).toBe(record);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns the record unchanged when it has no SF line', () => {
    expect.hasAssertions();
    const record = ['DA:1,1', 'end_of_record'].join('\n');

    expect(remapDistLcovRecord(record, process.cwd())).toBe(record);
  });

  it('returns the record unchanged when every generated line is unmapped boilerplate', () => {
    expect.hasAssertions();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-source-map-'));
    fs.mkdirSync(path.join(dir, 'dist'));
    fs.mkdirSync(path.join(dir, 'src'));
    const jsPath = path.join(dir, 'dist', 'empty.js');
    fs.writeFileSync(jsPath, '"use strict";\n');
    fs.writeFileSync(
      `${jsPath}.map`,
      JSON.stringify({
        version: 3,
        sources: ['../src/empty.ts'],
        mappings: ''
      })
    );
    fs.writeFileSync(path.join(dir, 'src', 'empty.ts'), '');
    const record = ['SF:dist/empty.js', 'DA:1,0', 'end_of_record'].join('\n');

    expect(remapDistLcovRecord(record, dir)).toBe(record);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
