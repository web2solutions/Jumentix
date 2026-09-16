/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/*
 * processDiskIo platform backends: Linux /proc/<pid>/io reads and failures,
 * the Darwin FFI result with its 1s cache, the Windows PowerShell JSON
 * contract, and the invalid-pid guard.
 *
 * Portable across both runners of this repository (Requirement 106): builtin
 * modules are NOT replaced — `jest.mock('fs')` intercepts nothing under
 * `bun test` and `mock.module` does not reach node builtins either. What both
 * runners honor is `jest.spyOn` on the real module objects. Because
 * processDiskIo destructures `execFile` and `readDarwinDiskIo` at require
 * time, the spies are installed before the module under test is required.
 * No /proc reads, no spawned processes, no wall-clock waits (the Darwin cache
 * clock is driven by a Date.now spy).
 */

const processDiskIoFs = require('fs');
const processDiskIoChildProcess = require('child_process');
const darwinProcessDiskIoModule = require('../../src/runtime/darwinProcessDiskIo');

const mockReadFileSync = jest.spyOn(processDiskIoFs, 'readFileSync') as jest.Mock;
const mockExecFile = jest.spyOn(processDiskIoChildProcess, 'execFile') as unknown as jest.Mock;
const mockReadDarwinDiskIoNative = jest.spyOn(darwinProcessDiskIoModule, 'readDarwinDiskIo') as jest.Mock;

const {
  attachProcessDiskIo,
  parseLinuxIoText,
  readProcessDiskIo,
  DEFAULT_TIMEOUT_MS,
  DARWIN_CACHE_TTL_MS
} = require('../../src/runtime/processDiskIo');

type ExecCallback = (error: unknown, stdout?: string, stderr?: string) => void;

type ExecFileFake = (
  command: string, args: string[], options: { timeout: number }, callback: ExecCallback
) => void;

function execFileSucceedingWith(stdout: string): ExecFileFake {
  return (_command, _args, _options, callback) => {
    callback(null, stdout, '');
  };
}

function execFileCapturingOptions(
  stdout: string,
  sink: { options?: { timeout: number } }
): ExecFileFake {
  return (_command, _args, options, callback) => {
    // eslint-disable-next-line no-param-reassign
    sink.options = options;
    callback(null, stdout, '');
  };
}

function execFileFailingWith(error: unknown): ExecFileFake {
  return (_command, _args, _options, callback) => {
    callback(error, undefined, undefined);
  };
}

// Spies are never restored: both runners isolate per file (jest per-file
// module registry, bun --isolate), and processDiskIo captured the spied
// bindings at require time — restoring mid-file would silently detach them.
function resetBackendSpies() {
  mockReadFileSync.mockReset();
  mockExecFile.mockReset();
  mockReadDarwinDiskIoNative.mockReset();
}

describe('service-management processDiskIo Linux backend', () => {
  beforeEach(resetBackendSpies);

  it('reads /proc/<pid>/io for the requested pid and reports every counter', async () => {
    expect.hasAssertions();
    mockReadFileSync.mockReturnValue([
      'rchar: 10',
      'wchar: 20',
      'syscr: 1',
      'syscw: 2',
      'read_bytes: 4096',
      'write_bytes: 8192',
      'cancelled_write_bytes: 3'
    ].join('\n'));
    const result = await readProcessDiskIo(42, { platform: 'linux' });
    expect(mockReadFileSync.mock.calls[0][0]).toBe('/proc/42/io');
    expect(result).toMatchObject({
      supported: true,
      platform: 'linux',
      readBytes: 4096,
      writeBytes: 8192,
      rchar: 10,
      wchar: 20,
      syscr: 1,
      syscw: 2
    });
  });

  it('reports the read failure with the filesystem error code', async () => {
    expect.hasAssertions();
    mockReadFileSync.mockImplementation(() => {
      const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    });
    const result = await readProcessDiskIo(42, { platform: 'linux' });
    expect(result).toMatchObject({
      supported: true,
      platform: 'linux',
      error: 'ENOENT: no such file or directory',
      code: 'ENOENT'
    });
    expect(result.readBytes).toBeUndefined();
  });

  it('falls back to LINUX_IO_READ_ERROR when the failure carries no error code', async () => {
    expect.hasAssertions();
    mockReadFileSync.mockImplementation(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'disk gone';
    });
    const result = await readProcessDiskIo(42, { platform: 'linux' });
    expect(result).toMatchObject({
      supported: true,
      platform: 'linux',
      error: 'disk gone',
      code: 'LINUX_IO_READ_ERROR'
    });
  });
});

describe('service-management processDiskIo parseLinuxIoText edge cases', () => {
  beforeEach(resetBackendSpies);

  it('ignores malformed lines and defaults every missing counter to zero', () => {
    expect.hasAssertions();
    const parsed = parseLinuxIoText([
      'not a field',
      'read_bytes: 7 trailing garbage',
      'write_bytes: 64'
    ].join('\n'));
    expect(parsed).toMatchObject({
      supported: true,
      platform: 'linux',
      readBytes: 0,
      writeBytes: 64,
      rchar: 0,
      wchar: 0,
      syscr: 0,
      syscw: 0
    });
  });

  it('treats empty or missing text as an all-zero sample', () => {
    expect.hasAssertions();
    expect(parseLinuxIoText('').readBytes).toBe(0);
    expect(parseLinuxIoText(null).writeBytes).toBe(0);
  });
});

describe('service-management processDiskIo pid guard', () => {
  beforeEach(resetBackendSpies);

  it.each([0, -3, 'abc', NaN])('refuses pid %s as INVALID_PID without touching any backend', async (pid) => {
    expect.hasAssertions();
    const result = await readProcessDiskIo(pid, { platform: 'linux' });
    expect(result).toMatchObject({
      supported: false,
      platform: 'linux',
      error: 'pid required',
      code: 'INVALID_PID'
    });
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('reports the host platform when no platform override is given', async () => {
    expect.hasAssertions();
    const result = await readProcessDiskIo(undefined);
    expect(result.supported).toBe(false);
    expect(result.platform).toBe(process.platform);
  });
});

describe('service-management processDiskIo Darwin backend and cache', () => {
  beforeEach(resetBackendSpies);

  it('serves a fresh read within the TTL from cache and re-reads after it expires', async () => {
    expect.hasAssertions();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    try {
      mockReadDarwinDiskIoNative.mockReturnValue({
        supported: true, platform: 'darwin', readBytes: 111, writeBytes: 222
      });

      const first = await readProcessDiskIo(7, { platform: 'darwin' });
      const second = await readProcessDiskIo(7, { platform: 'darwin' });
      expect(first).toMatchObject({ readBytes: 111, writeBytes: 222 });
      expect(second).toMatchObject({ readBytes: 111, writeBytes: 222 });
      expect(mockReadDarwinDiskIoNative).toHaveBeenCalledTimes(1);

      mockReadDarwinDiskIoNative.mockReturnValue({
        supported: true, platform: 'darwin', readBytes: 333, writeBytes: 444
      });
      nowSpy.mockReturnValue(1_000_000 + DARWIN_CACHE_TTL_MS + 1);
      const third = await readProcessDiskIo(7, { platform: 'darwin' });
      expect(third).toMatchObject({ readBytes: 333, writeBytes: 444 });
      expect(mockReadDarwinDiskIoNative).toHaveBeenCalledTimes(2);
    } finally {
      nowSpy.mockRestore();
    }
  });
});

describe('service-management processDiskIo Windows backend', () => {
  beforeEach(resetBackendSpies);

  it('parses the PowerShell JSON payload into unified fields', async () => {
    expect.hasAssertions();
    const sink: { options?: { timeout: number } } = {};
    mockExecFile.mockImplementation(execFileCapturingOptions(JSON.stringify({
      supported: true, platform: 'win32', readBytes: 5000, writeBytes: 6000
    }), sink));
    const result = await readProcessDiskIo(99, { platform: 'win32', timeoutMs: 25 });
    expect(sink.options?.timeout).toBe(25);
    expect(result).toMatchObject({
      supported: true, platform: 'win32', readBytes: 5000, writeBytes: 6000
    });
  });

  it('uses DEFAULT_TIMEOUT_MS when the caller does not pass timeoutMs', async () => {
    expect.hasAssertions();
    const sink: { options?: { timeout: number } } = {};
    mockExecFile.mockImplementation(execFileCapturingOptions('{"readBytes": 1, "writeBytes": 2}', sink));
    await readProcessDiskIo(99, { platform: 'win32' });
    expect(sink.options?.timeout).toBe(DEFAULT_TIMEOUT_MS);
  });

  it('coerces missing or non-numeric payload counters to zero', async () => {
    expect.hasAssertions();
    mockExecFile.mockImplementation(execFileSucceedingWith('{"readBytes": "oops", "writeBytes": 12}'));
    const partial = await readProcessDiskIo(99, { platform: 'win32' });
    expect(partial).toMatchObject({ readBytes: 0, writeBytes: 12 });

    mockExecFile.mockImplementation(execFileSucceedingWith('null'));
    const empty = await readProcessDiskIo(99, { platform: 'win32' });
    expect(empty).toMatchObject({
      supported: true, platform: 'win32', readBytes: 0, writeBytes: 0
    });
  });

  it('surfaces the powershell failure message and error code', async () => {
    expect.hasAssertions();
    const failure = Object.assign(new Error('operation timed out'), { code: 'ETIMEDOUT' });
    mockExecFile.mockImplementation(execFileFailingWith(failure));
    const result = await readProcessDiskIo(99, { platform: 'win32' });
    expect(result).toMatchObject({
      supported: true,
      platform: 'win32',
      error: 'operation timed out',
      code: 'ETIMEDOUT'
    });
  });

  it('falls back to EXEC_ERROR when the failure is not an Error with a code', async () => {
    expect.hasAssertions();
    mockExecFile.mockImplementation(execFileFailingWith('spawn powershell ENOENT'));
    const result = await readProcessDiskIo(99, { platform: 'win32' });
    expect(result.supported).toBe(true);
    expect(result.platform).toBe('win32');
    expect(result.code).toBe('EXEC_ERROR');
    expect(String(result.error)).toContain('spawn powershell ENOENT');
  });

  it('treats empty powershell output as an empty payload with zeroed counters', async () => {
    expect.hasAssertions();
    mockExecFile.mockImplementation(execFileSucceedingWith(''));
    const result = await readProcessDiskIo(99, { platform: 'win32' });
    expect(result).toMatchObject({
      supported: true, platform: 'win32', readBytes: 0, writeBytes: 0
    });
  });

  it('stringifies a non-Error JSON.parse failure and reports the raw stdout', async () => {
    expect.hasAssertions();
    // Defensive branch: JSON.parse normally throws SyntaxError, but the module
    // must still produce a clean result if a non-Error ever escapes.
    const parseSpy = jest.spyOn(JSON, 'parse').mockImplementation(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'weird parse failure';
    });
    try {
      mockExecFile.mockImplementation(execFileSucceedingWith(''));
      const result = await readProcessDiskIo(99, { platform: 'win32' });
      expect(result).toMatchObject({
        supported: true,
        platform: 'win32',
        error: 'weird parse failure',
        code: 'JSON_PARSE_ERROR'
      });
    } finally {
      parseSpy.mockRestore();
    }
  });

  it('reports JSON_PARSE_ERROR when powershell answers non-JSON', async () => {
    expect.hasAssertions();
    mockExecFile.mockImplementation(execFileSucceedingWith('not json at all'));
    const result = await readProcessDiskIo(99, { platform: 'win32' });
    expect(result.supported).toBe(true);
    expect(result.platform).toBe('win32');
    expect(result.code).toBe('JSON_PARSE_ERROR');
    expect(String(result.error).length).toBeGreaterThan(0);
  });
});

describe('service-management processDiskIo attachProcessDiskIo', () => {
  beforeEach(resetBackendSpies);

  it('attaches a diskIo sample to every entry, including failures per entry', async () => {
    expect.hasAssertions();
    mockReadFileSync.mockReturnValue('read_bytes: 100\nwrite_bytes: 200\n');
    const attached = await attachProcessDiskIo([
      null,
      { name: 'api', pid: 1 },
      { name: 'pidless' }
    ], { platform: 'linux' });
    expect(attached).toHaveLength(3);
    expect(attached[0].diskIo).toMatchObject({ supported: false, code: 'INVALID_PID' });
    expect(attached[1]).toMatchObject({ name: 'api', pid: 1 });
    expect(attached[1].diskIo).toMatchObject({ readBytes: 100, writeBytes: 200 });
    expect(attached[2].diskIo).toMatchObject({ supported: false, code: 'INVALID_PID' });
  });

  it('returns an empty list when the input is not an array', async () => {
    expect.hasAssertions();
    await expect(attachProcessDiskIo(undefined)).resolves.toStrictEqual([]);
    await expect(attachProcessDiskIo('nope')).resolves.toStrictEqual([]);
  });
});

// Module marker: keeps the file out of the shared script scope (TS2451).
// eslint-disable-next-line jest/no-export
export {};
