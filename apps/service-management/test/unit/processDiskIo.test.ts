/* eslint-disable jest/prefer-expect-assertions */
const fs = require('fs');
const path = require('path');
const {
  parseLinuxIoText,
  readProcessDiskIo
} = require('../../src/runtime/processDiskIo');

describe('service-management processDiskIo', () => {
  it('parses Linux /proc io text into unified fields', () => {
    expect.hasAssertions();
    const parsed = parseLinuxIoText([
      'rchar: 100',
      'wchar: 200',
      'syscr: 3',
      'syscw: 4',
      'read_bytes: 1024',
      'write_bytes: 2048'
    ].join('\n'));
    expect(parsed).toMatchObject({
      supported: true,
      platform: 'linux',
      readBytes: 1024,
      writeBytes: 2048,
      rchar: 100,
      wchar: 200
    });
  });

  it('returns unsupported for unknown platforms without inventing zeros', async () => {
    expect.hasAssertions();
    const result = await readProcessDiskIo(1234, { platform: 'aix' });
    expect(result.supported).toBe(false);
    expect(result.code).toBe('UNSUPPORTED_PLATFORM');
    expect(result.readBytes).toBeUndefined();
  });

  it('does not spawn python3 for Darwin collection', () => {
    expect.hasAssertions();
    const source = fs.readFileSync(
      path.join(__dirname, '../../src/runtime/processDiskIo.js'),
      'utf8'
    );
    expect(source).not.toContain('python3');
    expect(source).not.toContain('darwinProcessDiskIo.py');
    expect(source).toContain('darwinProcessDiskIo');
  });
});
