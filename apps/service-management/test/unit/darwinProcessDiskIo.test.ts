/* eslint-disable jest/prefer-expect-assertions, jest/max-expects */
/*
 * darwinProcessDiskIo — per-process disk I/O via libproc.proc_pid_rusage
 * (bun:ffi). bun:ffi does not exist under Node/Jest, so it is replaced by a
 * virtual fake whose dlopen/proc_pid_rusage behavior each test programs. The
 * buffer handed to the fake symbol is the real rusage_info_v2 buffer the
 * reader parses — values written at the documented offsets must surface as
 * readBytes/writeBytes. The `jest.mock(..., { virtual: true })` registration
 * is honored by Jest (virtual module) and by bun:test (which maps it onto
 * mock.module for bun builtins); module state (cached bindings / cached load
 * error) is reset per test via jest.resetModules under Jest and a
 * query-suffixed require under Bun.
 */

const mockDlopen = jest.fn();

jest.mock('bun:ffi', () => ({
  dlopen: (...args: unknown[]) => mockDlopen(...args),
  FFIType: { i32: 'i32', ptr: 'ptr' }
}), { virtual: true });

const {
  RUSAGE_INFO_V2,
  RUSAGE_INFO_V2_SIZE,
  OFFSET_DISKIO_BYTESREAD,
  OFFSET_DISKIO_BYTESWRITTEN
} = (() => {
  const mod = require('../../src/runtime/darwinProcessDiskIo');
  return {
    RUSAGE_INFO_V2: 2,
    RUSAGE_INFO_V2_SIZE: mod.RUSAGE_INFO_V2_SIZE,
    OFFSET_DISKIO_BYTESREAD: mod.OFFSET_DISKIO_BYTESREAD,
    OFFSET_DISKIO_BYTESWRITTEN: mod.OFFSET_DISKIO_BYTESWRITTEN
  };
})();

const moduleInstance = { counter: 0 };

function loadModule() {
  // Fresh copy per test: libprocBindings / libprocLoadError are module state.
  // `jest.resetModules` has no bun:test equivalent; Bun hands a fresh module
  // instance to a query-suffixed require instead, so each runner gets the
  // reset through its own mechanism (Requirement 106 portability).
  if (process.versions.bun) {
    moduleInstance.counter += 1;
    return require(`../../src/runtime/darwinProcessDiskIo.js?case=${moduleInstance.counter}`);
  }
  // eslint-disable-next-line jest/require-hook
  jest.resetModules();
  return require('../../src/runtime/darwinProcessDiskIo');
}

describe('service-management darwinProcessDiskIo', () => {
  beforeEach(() => {
    mockDlopen.mockReset();
  });

  it('reads disk counters from the rusage_info_v2 buffer at the documented offsets', () => {
    expect.hasAssertions();
    const seen: Array<{ pid: number; flavor: number; size: number }> = [];
    mockDlopen.mockReturnValue({
      symbols: {
        proc_pid_rusage: (pid: number, flavor: number, buffer: Buffer) => {
          seen.push({ pid, flavor, size: buffer.length });
          buffer.writeBigUInt64LE(BigInt(123456789), OFFSET_DISKIO_BYTESREAD);
          buffer.writeBigUInt64LE(BigInt(987654321), OFFSET_DISKIO_BYTESWRITTEN);
          return 0;
        }
      }
    });
    const { readDarwinDiskIo } = loadModule();
    const result = readDarwinDiskIo(4242);
    expect(result).toMatchObject({
      supported: true,
      platform: 'darwin',
      readBytes: 123456789,
      writeBytes: 987654321
    });
    expect(result.collectedAt).toStrictEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
    expect(seen).toStrictEqual([{ pid: 4242, flavor: RUSAGE_INFO_V2, size: RUSAGE_INFO_V2_SIZE }]);
  });

  it('reports PROC_PID_RUSAGE_FAILED when the syscall returns non-zero', () => {
    expect.hasAssertions();
    mockDlopen.mockReturnValue({
      symbols: { proc_pid_rusage: () => -1 }
    });
    const { readDarwinDiskIo } = loadModule();
    const result = readDarwinDiskIo(1);
    expect(result).toMatchObject({
      supported: true,
      platform: 'darwin',
      error: 'proc_pid_rusage failed (-1)',
      code: 'PROC_PID_RUSAGE_FAILED'
    });
    expect(result.readBytes).toBeUndefined();
  });

  it('marks the collector unavailable when libproc cannot be dlopened', () => {
    expect.hasAssertions();
    mockDlopen.mockImplementation(() => {
      throw new Error('dlopen(/usr/lib/libproc.dylib, 0x0001): image not found');
    });
    const { readDarwinDiskIo } = loadModule();
    const result = readDarwinDiskIo(1);
    expect(result).toMatchObject({
      supported: false,
      platform: 'darwin',
      code: 'DARWIN_FFI_UNAVAILABLE'
    });
    expect(result.error).toContain('dlopen');
  });

  it('marks the collector unavailable when bun:ffi itself is missing', () => {
    expect.hasAssertions();
    mockDlopen.mockImplementation(() => {
      throw new Error('Cannot find module \'bun:ffi\'');
    });
    const { readDarwinDiskIo } = loadModule();
    const result = readDarwinDiskIo(1);
    expect(result).toMatchObject({
      supported: false,
      platform: 'darwin',
      code: 'DARWIN_FFI_UNAVAILABLE'
    });
  });

  it('keeps supported=true for errors unrelated to FFI availability', () => {
    expect.hasAssertions();
    mockDlopen.mockImplementation(() => {
      throw new Error('operation not permitted');
    });
    const { readDarwinDiskIo } = loadModule();
    const result = readDarwinDiskIo(1);
    expect(result).toMatchObject({
      supported: true,
      platform: 'darwin',
      error: 'operation not permitted',
      code: 'DARWIN_IO_ERROR'
    });
  });

  it('stringifies non-Error throws from the FFI layer', () => {
    expect.hasAssertions();
    mockDlopen.mockImplementation(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'ffi exploded';
    });
    const { readDarwinDiskIo } = loadModule();
    const result = readDarwinDiskIo(1);
    expect(result).toMatchObject({
      supported: true,
      platform: 'darwin',
      error: 'ffi exploded',
      code: 'DARWIN_IO_ERROR'
    });
  });

  it('stringifies non-Error throws from the proc_pid_rusage symbol itself', () => {
    expect.hasAssertions();
    mockDlopen.mockReturnValue({
      symbols: {
        proc_pid_rusage: () => {
          // eslint-disable-next-line no-throw-literal
          throw 'symbol exploded';
        }
      }
    });
    const { readDarwinDiskIo } = loadModule();
    const result = readDarwinDiskIo(1);
    expect(result).toMatchObject({
      supported: true,
      platform: 'darwin',
      error: 'symbol exploded',
      code: 'DARWIN_IO_ERROR'
    });
  });

  it('does not retry dlopen after a load failure — the error is cached', () => {
    expect.hasAssertions();
    mockDlopen.mockImplementation(() => {
      throw new Error('operation not permitted');
    });
    const { readDarwinDiskIo } = loadModule();
    const first = readDarwinDiskIo(1);
    mockDlopen.mockReturnValue({
      symbols: { proc_pid_rusage: () => 0 }
    });
    const second = readDarwinDiskIo(1);
    expect(second).toStrictEqual(first);
    expect(second.code).toBe('DARWIN_IO_ERROR');
    expect(mockDlopen).toHaveBeenCalledTimes(1);
  });

  it('reuses the dlopened bindings across reads', () => {
    expect.hasAssertions();
    mockDlopen.mockReturnValue({
      symbols: {
        proc_pid_rusage: (pid: number, _flavor: number, buffer: Buffer) => {
          buffer.writeBigUInt64LE(BigInt(pid), OFFSET_DISKIO_BYTESREAD);
          buffer.writeBigUInt64LE(BigInt(pid * 10), OFFSET_DISKIO_BYTESWRITTEN);
          return 0;
        }
      }
    });
    const { readDarwinDiskIo } = loadModule();
    const firstRead = readDarwinDiskIo(10);
    const secondRead = readDarwinDiskIo(20);
    expect(firstRead).toMatchObject({ readBytes: 10, writeBytes: 100 });
    expect(secondRead).toMatchObject({ readBytes: 20, writeBytes: 200 });
    expect(mockDlopen).toHaveBeenCalledTimes(1);
  });

  it('falls back to readUInt32LE pairs when readBigUInt64LE is unavailable', () => {
    expect.hasAssertions();
    mockDlopen.mockReturnValue({
      symbols: {
        proc_pid_rusage: (_pid: number, _flavor: number, buffer: Buffer) => {
          // Old runtimes lack readBigUInt64LE: force the fallback path.
          Object.defineProperty(buffer, 'readBigUInt64LE', { value: undefined });
          // 0x00000001_00000005 = 4294967301
          buffer.writeUInt32LE(5, OFFSET_DISKIO_BYTESREAD);
          buffer.writeUInt32LE(1, OFFSET_DISKIO_BYTESREAD + 4);
          buffer.writeUInt32LE(42, OFFSET_DISKIO_BYTESWRITTEN);
          buffer.writeUInt32LE(0, OFFSET_DISKIO_BYTESWRITTEN + 4);
          return 0;
        }
      }
    });
    const { readDarwinDiskIo } = loadModule();
    const result = readDarwinDiskIo(1);
    expect(result).toMatchObject({ readBytes: 4294967301, writeBytes: 42 });
  });
});

// Module marker: keeps the file out of the shared script scope (TS2451).
// eslint-disable-next-line jest/no-export
export {};
