/* eslint-disable @typescript-eslint/no-var-requires */
import fs from 'fs';
import os from 'os';
import path from 'path';

const {
  mergeLcovFiles,
  rebaseRecordFile,
  splitRecords
} = require('../../../../../ci-cd/merge-coverage-reports');

const RECORD_A = ['SF:src/a.ts', 'DA:1,1', 'DA:2,0', 'end_of_record'].join('\n');
const RECORD_B = ['SF:src/b.ts', 'DA:1,1', 'end_of_record'].join('\n');

const makeTmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'merge-lcov-'));

describe('merge-coverage-reports', () => {
  it('merges every input without duplicating a file seen twice', () => {
    expect.hasAssertions();
    const dir = makeTmp();
    const first = path.join(dir, 'one.info');
    const second = path.join(dir, 'two.info');
    const output = path.join(dir, 'merged.info');
    fs.writeFileSync(first, `${RECORD_A}\n${RECORD_B}\n`);
    fs.writeFileSync(second, `${RECORD_A.replace('DA:1,1', 'DA:1,9')}\n`);

    const stats = mergeLcovFiles([first, second, path.join(dir, 'absent.info')], output);

    expect(stats.records).toBe(2);
    expect(stats.skippedDuplicates).toBe(1);
    const merged = fs.readFileSync(output, 'utf8');
    expect(merged).toContain('SF:src/a.ts\nDA:1,1');
    expect(merged).toContain('SF:src/b.ts');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rebases SF paths with the input prefix and keeps absolute paths untouched', () => {
    expect.hasAssertions();
    const relative = ['SF:src/useXCrud.ts', 'DA:1,1', 'end_of_record'].join('\n');
    const rebased = rebaseRecordFile(relative, 'apps/frontend/');
    expect(rebased).toContain('SF:apps/frontend/src/useXCrud.ts');

    const absolute = ['SF:/repo/apps/frontend/src/useXCrud.ts', 'DA:1,1', 'end_of_record'].join('\n');
    expect(rebaseRecordFile(absolute, 'apps/frontend/')).toContain('SF:/repo/apps/frontend/src/useXCrud.ts');
  });

  it('splits records on end_of_record and ignores trailing text', () => {
    expect.hasAssertions();
    const records = splitRecords(`${RECORD_A}\n${RECORD_B}\n`);
    expect(records).toHaveLength(2);
    expect(records[0]).toContain('SF:src/a.ts');
    expect(records[1]).toContain('SF:src/b.ts');
  });
});
