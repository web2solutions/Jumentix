/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/max-expects */
import fs from 'fs';
import os from 'os';
import path from 'path';

const {
  hasBranchData,
  mergeLcovFiles,
  rebaseRecordFile,
  splitRecords
} = require('../merge-coverage-reports');

const RECORD_A = ['SF:src/a.ts', 'DA:1,1', 'DA:2,0', 'end_of_record'].join('\n');
const RECORD_B = ['SF:src/b.ts', 'DA:1,1', 'end_of_record'].join('\n');
const RECORD_WITH_BRANCH = ['SF:src/branch.ts', 'DA:1,1', 'BRDA:1,0,0,1', 'BRF:1', 'end_of_record'].join('\n');

const makeTmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'merge-lcov-'));

describe('merge-coverage-reports', () => {
  it('merges every input without duplicating a file seen twice', () => {
    expect.hasAssertions();
    const dir = makeTmp();
    const first = path.join(dir, 'one.info');
    const second = path.join(dir, 'two.info');
    const output = path.join(dir, 'merged.info');
    fs.writeFileSync(first, `${RECORD_A}\n${RECORD_B}\n${RECORD_WITH_BRANCH}\n`);
    fs.writeFileSync(second, `${RECORD_A.replace('DA:1,1', 'DA:1,9')}\n`);

    const stats = mergeLcovFiles([first, second, path.join(dir, 'absent.info')], output);

    expect(stats.records).toBe(3);
    expect(stats.skippedDuplicates).toBe(1);
    expect(stats.withBranches).toBe(1);
    const merged = fs.readFileSync(output, 'utf8');
    expect(merged).toContain('SF:src/a.ts\nDA:1,1');
    expect(merged).toContain('SF:src/b.ts');
    expect(merged).toContain('SF:src/branch.ts');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rebases SF paths with the input prefix and keeps absolute paths untouched', () => {
    expect.hasAssertions();
    const relative = ['SF:src/useXCrud.ts', 'DA:1,1', 'end_of_record'].join('\n');
    const rebased = rebaseRecordFile(relative, 'apps/frontend/');
    expect(rebased).toContain('SF:apps/frontend/src/useXCrud.ts');

    const absolute = ['SF:/repo/apps/frontend/src/useXCrud.ts', 'DA:1,1', 'end_of_record'].join('\n');
    expect(rebaseRecordFile(absolute, 'apps/frontend/')).toContain('SF:/repo/apps/frontend/src/useXCrud.ts');
    expect(rebaseRecordFile(['DA:1,1', 'end_of_record'].join('\n'), 'apps/frontend/')).toBe('DA:1,1\nend_of_record');
  });

  it('splits records on end_of_record and ignores trailing text', () => {
    expect.hasAssertions();
    const records = splitRecords(`${RECORD_A}\n${RECORD_B}\n`);
    expect(records).toHaveLength(2);
    expect(records[0]).toContain('SF:src/a.ts');
    expect(records[1]).toContain('SF:src/b.ts');
    expect(splitRecords('')).toStrictEqual([]);
    expect(hasBranchData(RECORD_WITH_BRANCH)).toBe(true);
    expect(hasBranchData(RECORD_A)).toBe(false);
  });

  it('rebases prefixed inputs and ignores records without source files', () => {
    expect.hasAssertions();
    const dir = makeTmp();
    const input = path.join(dir, 'frontend.info');
    const output = path.join(dir, 'merged.info');
    fs.writeFileSync(input, [
      'DA:1,1',
      'end_of_record',
      RECORD_A
    ].join('\n'));

    const stats = mergeLcovFiles([{ path: input, pathPrefix: 'apps/frontend/' }], output);

    expect(stats).toMatchObject({ inputs: 1, records: 1, skippedDuplicates: 0 });
    expect(fs.readFileSync(output, 'utf8')).toContain('SF:apps/frontend/src/a.ts');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('entry point', () => {
    const script = path.resolve(__dirname, '../merge-coverage-reports.js');

    const runScript = (cwd: string, env: Record<string, string>) => {
      const { spawnSync } = require('node:child_process');
      return spawnSync(process.execPath, [script], {
        cwd,
        env: { ...process.env, ...env },
        encoding: 'utf8'
      });
    };

    it('honours JUMENTIX_MERGED_LCOV for the merged output path', () => {
      expect.hasAssertions();
      const dir = makeTmp();
      const output = path.join(dir, 'custom-merged.info');

      const result = runScript(dir, { JUMENTIX_MERGED_LCOV: output });

      expect(result.status).toBe(0);
      expect(fs.existsSync(output)).toBe(true);
      expect(fs.readFileSync(path.join(dir, 'artifacts', 'ci', 'coverage-merge.json'), 'utf8'))
        .toContain(output);
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('defaults the merged output to coverage/merged/lcov.info under the cwd', () => {
      expect.hasAssertions();
      const dir = makeTmp();

      const result = runScript(dir, { JUMENTIX_MERGED_LCOV: '' });

      expect(result.status).toBe(0);
      expect(fs.existsSync(path.join(dir, 'coverage', 'merged', 'lcov.info'))).toBe(true);
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });
});
